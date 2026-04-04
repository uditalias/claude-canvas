import { useEffect, useRef } from "react";
import {
  Canvas,
  PencilBrush,
  Rect,
  Ellipse,
  IText,
  Path,
  Group,
  FabricImage,
  FabricObject,
} from "fabric";
import type { ToolType } from "./useToolState";
import {
  userRoughRect,
  userRoughEllipse,
  hexToRgba,
} from "../lib/wobble";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";
import { getObjectColor } from "./useCanvas";

// Paint bucket cursor using Lucide paint-bucket icon
function makePaintCursor(strokeColor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>`;
  return `url("data:image/svg+xml;base64,${btoa(svg)}") 2 22, pointer`;
}

import type { ResolvedTheme } from "./useTheme";

interface UseDrawingToolsOptions {
  getCanvas: () => Canvas | null;
  activeTool: ToolType;
  color: string;
  brushSize: number;
  spaceDownRef: React.RefObject<boolean>;
  selectTool: (tool: ToolType) => void;
  resolvedTheme?: ResolvedTheme;
  saveSnapshot?: () => void;
  pauseHistory?: () => void;
  resumeHistory?: () => void;
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

function tagAsUser(obj: FabricObject, shapeType?: string, geo?: Record<string, unknown>): void {
  obj.set({ data: { layer: "user", ...(shapeType && { shapeType }), ...(geo && { geo }) } });
}

export function useDrawingTools({
  getCanvas,
  activeTool,
  color,
  brushSize,
  spaceDownRef,
  selectTool,
  resolvedTheme,
  saveSnapshot,
  pauseHistory,
  resumeHistory,
}: UseDrawingToolsOptions) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<FabricObject | null>(null);
  const isReRenderingRef = useRef(false);
  // Track if mouse:down landed on a user object (to suppress drawing)
  // Object to select after tool switch effect runs
  const pendingSelectRef = useRef<FabricObject | null>(null);

  // Fix #6: Apply color changes to selected user objects
  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (activeObj && isUserLayer(activeObj)) {
      if (activeObj instanceof IText) {
        activeObj.set({ fill: color });
        canvas.requestRenderAll();
      }
    }
  }, [color, getCanvas]);

  // Configure canvas mode when tool changes
  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const isDrawingTool = activeTool === "pencil" || activeTool === "marker";
    const isShapeTool = activeTool === "rect" || activeTool === "circle" || activeTool === "arrow" || activeTool === "line";
    const isPointer = activeTool === "pointer";
    const isHand = activeTool === "hand";

    // Reset state
    canvas.isDrawingMode = false;
    canvas.selection = isPointer;
    isDraggingRef.current = false;

    // Cursor hints per tool
    if (isPointer) {
      canvas.defaultCursor = "default";
    } else if (isHand) {
      canvas.defaultCursor = "grab";
      canvas.selection = false;
    } else if (isDrawingTool) {
      canvas.defaultCursor = "crosshair";
    } else if (isShapeTool) {
      canvas.defaultCursor = "crosshair";
    } else if (activeTool === "text") {
      canvas.defaultCursor = "text";
    } else if (activeTool === "paint") {
      canvas.defaultCursor = "pointer";
    }

    if (ghostRef.current) {
      canvas.remove(ghostRef.current);
      ghostRef.current = null;
    }

    // Select pending object or deselect all when switching tools
    if (pendingSelectRef.current) {
      canvas.setActiveObject(pendingSelectRef.current);
      pendingSelectRef.current = null;
    } else {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();

    // Set up drawing mode for freehand tools
    if (isDrawingTool) {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }
      const brush = canvas.freeDrawingBrush as PencilBrush;
      brush.color = color;
      brush.decimate = 4; // smoothing - simplify paths

      if (activeTool === "pencil") {
        brush.width = brushSize;
        brush.opacity = 1;
      } else if (activeTool === "marker") {
        brush.color = "rgba(255, 230, 0, 0.4)";
        brush.width = 16;
        brush.opacity = 1;
      }
    }

    // Only pointer and paint tools allow interacting with existing objects.
    // Drawing tools (shapes, lines, freehand) should draw through objects.
    const isPaint = activeTool === "paint";
    const canInteract = isPointer || isPaint;
    const paintCursor = isPaint ? makePaintCursor(resolvedTheme === "dark" ? "white" : "black") : undefined;
    canvas.forEachObject((obj) => {
      if (isUserLayer(obj)) {
        obj.selectable = canInteract;
        obj.evented = canInteract;
        obj.hoverCursor = paintCursor;
      }
    });

    // When text editing ends (blur, Escape, click outside), switch to pointer
    const onTextEditingExited = (opt: { target: FabricObject }) => {
      const textObj = opt.target as IText;
      // Remove empty text objects
      if (!textObj.text?.trim()) {
        canvas.remove(textObj);
        canvas.discardActiveObject();
      }
      if (activeTool === "text") {
        if (textObj.text?.trim()) {
          pendingSelectRef.current = textObj;
        }
        selectTool("pointer");
      }
    };

    // Tag paths created by freehand drawing, then switch to pointer
    const onPathCreated = (opt: { path: FabricObject }) => {
      if (opt.path) {
        tagAsUser(opt.path, "freehand");
        pendingSelectRef.current = opt.path;
        selectTool("pointer");
      }
    };

    // Shape drawing handlers
    const onMouseDown = (opt: { e: Event; target?: FabricObject; pointer: { x: number; y: number } }) => {
      if (spaceDownRef.current) return;
      if ((opt.e as MouseEvent).button === 2) return; // ignore right-click
      const canvas = getCanvas();
      if (!canvas) return;

      const pointer = canvas.getScenePoint(opt.e as MouseEvent);
      // Paint tool: recolor the clicked object
      if (activeTool === "paint") {
        const pointer = canvas.getScenePoint(opt.e as MouseEvent);
        const objects = canvas.getObjects().filter(o => isUserLayer(o));
        let hit: FabricObject | null = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (objects[i].containsPoint(pointer)) {
            hit = objects[i];
            break;
          }
        }
        if (hit) {
          if (hit instanceof RoughLineObject || hit instanceof RoughArrowObject) {
            (hit as RoughLineObject).strokeColor = color;
          } else if (hit instanceof IText) {
            hit.set({ fill: color });
          } else if (hit instanceof Path) {
            hit.set({ stroke: color });
          } else if (hit instanceof Group) {
            const fillLight = hexToRgba(color, 0.35);
            const children = hit.getObjects();
            for (const child of children) {
              if (child instanceof Path) {
                const currentStroke = child.stroke as string;
                const currentFill = child.fill as string;
                // Fill paths: hachure uses stroke, solid uses fill
                if (currentStroke && (currentStroke.startsWith("rgba") || currentStroke === "transparent")) {
                  child.set({ stroke: fillLight });
                  if (currentFill && currentFill.startsWith("rgba")) {
                    child.set({ fill: fillLight });
                  }
                } else {
                  // Outline stroke
                  child.set({ stroke: color });
                }
              }
            }
          }
          canvas.requestRenderAll();
          saveSnapshot?.();
        }
        return;
      }

      if (activeTool === "text") {
        // If already editing a text, exit editing and switch to pointer
        const active = canvas.getActiveObject();
        if (active instanceof IText && active.isEditing) {
          active.exitEditing();
          // Remove if empty
          if (!active.text?.trim()) {
            canvas.remove(active);
          }
          pendingSelectRef.current = active.text?.trim() ? active : null;
          selectTool("pointer");
          return;
        }

        const text = new IText("", {
          left: pointer.x,
          top: pointer.y,
          originX: "left",
          originY: "top",
          fontSize: 16 + brushSize * 2,
          fontFamily: "Patrick Hand, cursive",
          fill: color,
          selectable: true,
          hasControls: true,
        });
        tagAsUser(text, "text");
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.requestRenderAll();
        return;
      }

      if (!isShapeTool) return;

      isDraggingRef.current = true;
      dragStartRef.current = { x: pointer.x, y: pointer.y };

      // Create ghost preview
      if (activeTool === "rect") {
        const ghost = new Rect({
          left: pointer.x,
          top: pointer.y,
          originX: "left",
          originY: "top",
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      } else if (activeTool === "circle") {
        const ghost = new Ellipse({
          left: pointer.x,
          top: pointer.y,
          originX: "left",
          originY: "top",
          rx: 0,
          ry: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      } else if (activeTool === "line") {
        const ghost = new RoughLineObject([pointer.x, pointer.y, pointer.x, pointer.y], {
          strokeColor: color,
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      } else if (activeTool === "arrow") {
        const ghost = new RoughArrowObject([pointer.x, pointer.y, pointer.x, pointer.y], {
          strokeColor: color,
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      }
    };

    const onMouseMove = (opt: { e: Event }) => {
      if (!isDraggingRef.current || !ghostRef.current || spaceDownRef.current) return;
      const canvas = getCanvas();
      if (!canvas) return;

      const pointer = canvas.getScenePoint(opt.e as MouseEvent);
      const start = dragStartRef.current;

      const shiftKey = (opt.e as MouseEvent).shiftKey;

      if (activeTool === "rect") {
        const ghost = ghostRef.current as Rect;
        let w = Math.abs(pointer.x - start.x);
        let h = Math.abs(pointer.y - start.y);
        if (shiftKey) { const s = Math.max(w, h); w = s; h = s; }
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        ghost.set({ left, top, width: w, height: h });
      } else if (activeTool === "circle") {
        const ghost = ghostRef.current as Ellipse;
        let w = Math.abs(pointer.x - start.x);
        let h = Math.abs(pointer.y - start.y);
        if (shiftKey) { const s = Math.max(w, h); w = s; h = s; }
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        ghost.set({ left, top, rx: w / 2, ry: h / 2 });
      } else if (activeTool === "arrow" || activeTool === "line") {
        const ghost = ghostRef.current as RoughLineObject;
        let x2 = pointer.x;
        let y2 = pointer.y;
        if (shiftKey) {
          const adx = Math.abs(x2 - start.x);
          const ady = Math.abs(y2 - start.y);
          const angle = Math.atan2(ady, adx);
          const dist = Math.sqrt(adx * adx + ady * ady);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          x2 = start.x + Math.cos(snapped) * dist * Math.sign(x2 - start.x || 1);
          y2 = start.y + Math.sin(snapped) * dist * Math.sign(y2 - start.y || 1);
        }
        ghost.set({ x2, y2 });
        (ghost as any)._setWidthHeight();
        ghost.setCoords();
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = (opt: { e: Event }) => {
      if (!isDraggingRef.current || spaceDownRef.current) {
        isDraggingRef.current = false;
        return;
      }
      const canvas = getCanvas();
      if (!canvas) return;

      isDraggingRef.current = false;
      const pointer = canvas.getScenePoint(opt.e as MouseEvent);
      const start = dragStartRef.current;

      // Minimum drag distance
      const rawDx = pointer.x - start.x;
      const rawDy = pointer.y - start.y;
      if (Math.abs(rawDx) < 5 && Math.abs(rawDy) < 5) {
        // Too small — remove ghost
        if (ghostRef.current) {
          canvas.remove(ghostRef.current);
          ghostRef.current = null;
        }
        return;
      }

      // For lines/arrows, promote the ghost to the final object
      let createdShape: FabricObject | null = null;
      if ((activeTool === "line" || activeTool === "arrow") && ghostRef.current) {
        const shape = ghostRef.current as RoughLineObject;
        shape.set({ selectable: true, evented: true });
        tagAsUser(shape, activeTool);
        ghostRef.current = null;
        createdShape = shape;
      } else {
        // Remove ghost for rect/circle (they create a different final object)
        if (ghostRef.current) {
          canvas.remove(ghostRef.current);
          ghostRef.current = null;
        }

        const shiftKey = (opt.e as MouseEvent).shiftKey;
        let w = Math.abs(rawDx);
        let h = Math.abs(rawDy);
        if (shiftKey && (activeTool === "rect" || activeTool === "circle")) {
          const s = Math.max(w, h); w = s; h = s;
        }
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);

        if (activeTool === "rect") {
          const shape = userRoughRect(left, top, w, h, color);
          tagAsUser(shape, "rect", { x: left, y: top, width: w, height: h });
          canvas.add(shape);
          createdShape = shape;
        } else if (activeTool === "circle") {
          const shape = userRoughEllipse(left, top, w, h, color);
          tagAsUser(shape, "ellipse", { x: left, y: top, width: w, height: h });
          canvas.add(shape);
          createdShape = shape;
        }
      }

      canvas.requestRenderAll();

      // Auto-select pointer after drawing a shape
      if (createdShape) {
        pendingSelectRef.current = createdShape;
        selectTool("pointer");
      }
    };

    // Clipboard for copy/paste
    let clipboard: FabricObject[] = [];

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const canvas = getCanvas();
      if (!canvas) return;

      if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }

      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj as IText).isEditing) return;
        const selected = canvas.getActiveObjects().filter(isUserLayer);
        if (selected.length > 0) {
          clipboard = selected;
          e.preventDefault();
        }
        return;
      }

      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        if (clipboard.length === 0) return;
        e.preventDefault();
        const clonePromises = clipboard.map((obj) => obj.clone());
        Promise.all(clonePromises).then((clones) => {
          canvas.discardActiveObject();
          for (const cloned of clones) {
            cloned.set({
              left: (cloned.left ?? 0) + 20,
              top: (cloned.top ?? 0) + 20,
            });
            (cloned as any).data = { layer: "user" };
            canvas.add(cloned);
          }
          if (clones.length === 1) {
            canvas.setActiveObject(clones[0]);
          }
          canvas.requestRenderAll();
          // Update clipboard to the new clones so next paste offsets further
          clipboard = clones;
        });
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete when editing text
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj as IText).isEditing) return;

        const activeObjects = canvas.getActiveObjects();
        const userObjects = activeObjects.filter(isUserLayer);
        for (const obj of userObjects) {
          canvas.remove(obj);
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    };

    // Helper: load a File/Blob as a data URL and add to canvas
    const addImageToCanvas = (file: File | Blob, left: number, top: number) => {
      const canvas = getCanvas();
      if (!canvas) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const fImg = new FabricImage(img, {
            left,
            top,
            originX: "left",
            originY: "top",
          });
          tagAsUser(fImg);
          canvas.add(fImg);
          canvas.setActiveObject(fImg);
          canvas.requestRenderAll();
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };

    // Image paste from clipboard
    const onPaste = (e: ClipboardEvent) => {
      const canvas = getCanvas();
      if (!canvas) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          addImageToCanvas(blob, (canvas.width ?? 800) / 2, (canvas.height ?? 600) / 2);
          break;
        }
      }
    };

    // Image drag-and-drop
    const canvasEl = canvas.getSelectionElement();
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const canvas = getCanvas();
      if (!canvas) return;
      const files = e.dataTransfer?.files;
      if (!files) return;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const pointer = canvas.getScenePoint(e);
        addImageToCanvas(file, pointer.x, pointer.y);
      }
    };

    // Re-render rough.js shapes after resize to keep stroke width consistent
    const onObjectModified = (opt: { target: FabricObject }) => {
      if (isReRenderingRef.current) return;
      const target = opt.target;
      if (!(target instanceof Group) || !isUserLayer(target)) return;
      const data = (target as any).data;
      const shapeType = data?.shapeType;
      if (!shapeType || !["rect", "ellipse"].includes(shapeType)) return;

      // Only re-render if scaled (not just moved)
      const sx = target.scaleX ?? 1;
      const sy = target.scaleY ?? 1;
      if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return;

      isReRenderingRef.current = true;
      const canvas = getCanvas();
      if (!canvas) { isReRenderingRef.current = false; return; }

      // Calculate new dimensions from original geo * scale (avoids bounding rect inflation)
      const geo = data?.geo as Record<string, number> | undefined;
      const oldW = geo?.width ?? 100;
      const oldH = geo?.height ?? 100;
      const w = Math.round(oldW * sx);
      const h = Math.round(oldH * sy);
      const br = target.getBoundingRect();
      const left = Math.round(br.left);
      const top = Math.round(br.top);
      const objColor = getObjectColor(target) || color;
      const fillStyle = data?.fillStyle as string | undefined;

      let newShape: Group;
      if (shapeType === "rect") {
        newShape = userRoughRect(left, top, w, h, objColor, fillStyle);
      } else {
        newShape = userRoughEllipse(left, top, w, h, objColor, fillStyle);
      }

      // Preserve metadata
      newShape.set({
        data: { ...data, geo: { x: left, y: top, width: w, height: h } },
        opacity: target.opacity,
        selectable: true,
        evented: true,
        hasControls: true,
      });

      // Atomic swap
      pauseHistory?.();
      const idx = canvas.getObjects().indexOf(target);
      canvas.remove(target);
      canvas.insertAt(idx, newShape);
      resumeHistory?.();

      canvas.setActiveObject(newShape);
      canvas.requestRenderAll();
      isReRenderingRef.current = false;
      saveSnapshot?.();
    };

    // Attach listeners
    canvas.on("mouse:down", onMouseDown as any);
    canvas.on("mouse:move", onMouseMove as any);
    canvas.on("mouse:up", onMouseUp as any);
    canvas.on("text:editing:exited" as any, onTextEditingExited);
    canvas.on("object:modified", onObjectModified as any);

    if (isDrawingTool) {
      canvas.on("path:created" as any, onPathCreated);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    if (canvasEl) {
      canvasEl.addEventListener("dragover", onDragOver);
      canvasEl.addEventListener("drop", onDrop);
    }

    return () => {
      canvas.off("mouse:down", onMouseDown as any);
      canvas.off("mouse:move", onMouseMove as any);
      canvas.off("mouse:up", onMouseUp as any);
      canvas.off("text:editing:exited" as any, onTextEditingExited);
      canvas.off("object:modified", onObjectModified as any);
      if (isDrawingTool) {
        canvas.off("path:created" as any, onPathCreated);
      }
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
      if (canvasEl) {
        canvasEl.removeEventListener("dragover", onDragOver);
        canvasEl.removeEventListener("drop", onDrop);
      }
    };
  }, [getCanvas, activeTool, color, brushSize, spaceDownRef, selectTool, resolvedTheme, saveSnapshot, pauseHistory, resumeHistory]);
}
