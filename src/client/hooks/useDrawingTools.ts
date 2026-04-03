import { useEffect, useRef } from "react";
import {
  Canvas,
  PencilBrush,
  Rect,
  Ellipse,
  Line as FabricLine,
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
  userRoughLine,
  userRoughArrow,
  hexToRgba,
} from "../lib/wobble";

interface UseDrawingToolsOptions {
  getCanvas: () => Canvas | null;
  activeTool: ToolType;
  color: string;
  brushSize: number;
  spaceDownRef: React.RefObject<boolean>;
  selectTool: (tool: ToolType) => void;
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

function tagAsUser(obj: FabricObject): void {
  obj.set({ data: { layer: "user" } });
}

export function useDrawingTools({
  getCanvas,
  activeTool,
  color,
  brushSize,
  spaceDownRef,
  selectTool,
}: UseDrawingToolsOptions) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<FabricObject | null>(null);
  // Track if mouse:down landed on a user object (to suppress drawing)
  const hitUserObjectRef = useRef<FabricObject | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
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

    // Reset state
    canvas.isDrawingMode = false;
    canvas.selection = isPointer;
    isDraggingRef.current = false;
    hitUserObjectRef.current = null;

    // Cursor hints per tool
    if (isPointer) {
      canvas.defaultCursor = "default";
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

    // Keep user objects always selectable/evented so we can detect clicks on them
    canvas.forEachObject((obj) => {
      if (isUserLayer(obj)) {
        obj.selectable = true;
        obj.evented = true;
      }
    });

    // Tag paths created by freehand drawing
    const onPathCreated = (opt: { path: FabricObject }) => {
      if (opt.path) {
        tagAsUser(opt.path);
      }
    };

    // Shape drawing handlers
    const onMouseDown = (opt: { e: Event; target?: FabricObject; pointer: { x: number; y: number } }) => {
      if (spaceDownRef.current) return;
      if ((opt.e as MouseEvent).button === 2) return; // ignore right-click
      const canvas = getCanvas();
      if (!canvas) return;

      const pointer = canvas.getScenePoint(opt.e as MouseEvent);
      mouseDownPosRef.current = { x: pointer.x, y: pointer.y };

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
          if (hit instanceof IText) {
            hit.set({ fill: color });
          } else if (hit instanceof Path) {
            hit.set({ stroke: color });
          } else if (hit instanceof Group) {
            const fillLight = hexToRgba(color, 0.35);
            const children = hit.getObjects();
            for (const child of children) {
              if (child instanceof Path) {
                const currentStroke = child.stroke as string;
                // Hachure fill paths have lighter/transparent strokes
                if (currentStroke && (currentStroke.startsWith("rgba") || currentStroke === "transparent")) {
                  child.set({ stroke: fillLight });
                } else {
                  // Outline stroke
                  child.set({ stroke: color });
                }
              }
            }
          }
          canvas.requestRenderAll();
        }
        return;
      }

      // If clicking on a user object while a non-pointer tool is active:
      // DON'T draw, DON'T switch tool yet — just let Fabric handle the drag.
      // We'll decide on mouse:up whether it was a click (switch to pointer) or drag (just move).
      if (activeTool !== "pointer" && opt.target && isUserLayer(opt.target)) {
        hitUserObjectRef.current = opt.target;
        // Temporarily let Fabric handle this object for dragging
        return;
      }

      hitUserObjectRef.current = null;

      if (activeTool === "text") {
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
        tagAsUser(text);
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
      } else if (activeTool === "arrow" || activeTool === "line") {
        const ghost = new FabricLine([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      }
    };

    const onMouseMove = (opt: { e: Event }) => {
      if (hitUserObjectRef.current) return; // user is dragging an existing shape, don't draw
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
        const ghost = ghostRef.current as FabricLine;
        let x2 = pointer.x;
        let y2 = pointer.y;
        if (shiftKey) {
          // Snap to nearest 45-degree angle
          const adx = Math.abs(x2 - start.x);
          const ady = Math.abs(y2 - start.y);
          const angle = Math.atan2(ady, adx);
          const dist = Math.sqrt(adx * adx + ady * ady);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          x2 = start.x + Math.cos(snapped) * dist * Math.sign(x2 - start.x || 1);
          y2 = start.y + Math.sin(snapped) * dist * Math.sign(y2 - start.y || 1);
        }
        ghost.set({ x2, y2 });
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = (opt: { e: Event }) => {
      // Handle the case where mouse:down was on a user object
      if (hitUserObjectRef.current) {
        const canvas = getCanvas();
        const hitObj = hitUserObjectRef.current;
        hitUserObjectRef.current = null;

        if (canvas) {
          // Check if it was a click (no significant drag) — switch to pointer + select
          const pointer = canvas.getScenePoint(opt.e as MouseEvent);
          const dx = Math.abs(pointer.x - mouseDownPosRef.current.x);
          const dy = Math.abs(pointer.y - mouseDownPosRef.current.y);
          if (dx < 5 && dy < 5) {
            // Click: switch to pointer and select — store pending selection
            // so the effect doesn't discard it
            pendingSelectRef.current = hitObj;
            selectTool("pointer");
          } else {
            // Drag: Fabric already moved the object. Restore drawing mode if freehand tool.
            if (isDrawingTool) {
              canvas.isDrawingMode = true;
            }
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
        return;
      }

      if (!isDraggingRef.current || spaceDownRef.current) {
        isDraggingRef.current = false;
        return;
      }
      const canvas = getCanvas();
      if (!canvas) return;

      isDraggingRef.current = false;
      const pointer = canvas.getScenePoint(opt.e as MouseEvent);
      const start = dragStartRef.current;

      // Remove ghost
      if (ghostRef.current) {
        canvas.remove(ghostRef.current);
        ghostRef.current = null;
      }

      // Minimum drag distance
      const rawDx = pointer.x - start.x;
      const rawDy = pointer.y - start.y;
      if (Math.abs(rawDx) < 5 && Math.abs(rawDy) < 5) return;

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
        tagAsUser(shape);
        canvas.add(shape);
      } else if (activeTool === "circle") {
        const shape = userRoughEllipse(left, top, w, h, color);
        tagAsUser(shape);
        canvas.add(shape);
      } else if (activeTool === "line" || activeTool === "arrow") {
        let x2 = pointer.x;
        let y2 = pointer.y;
        if (shiftKey) {
          const adx = Math.abs(x2 - start.x);
          const ady = Math.abs(y2 - start.y);
          const dist = Math.sqrt(adx * adx + ady * ady);
          const angle = Math.atan2(ady, adx);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          x2 = start.x + Math.cos(snapped) * dist * Math.sign(x2 - start.x || 1);
          y2 = start.y + Math.sin(snapped) * dist * Math.sign(y2 - start.y || 1);
        }
        if (activeTool === "line") {
          const shape = userRoughLine(start.x, start.y, x2, y2, color);
          tagAsUser(shape);
          canvas.add(shape);
        } else {
          const shape = userRoughArrow(start.x, start.y, x2, y2, color);
          tagAsUser(shape);
          canvas.add(shape);
        }
      }

      canvas.requestRenderAll();
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

    // For freehand tools: intercept mouse:down before Fabric starts drawing
    // If on a user object, temporarily disable drawing mode so Fabric handles drag instead
    const onMouseDownBefore = (opt: { e: Event; target?: FabricObject }) => {
      if (isDrawingTool && opt.target && isUserLayer(opt.target)) {
        canvas.isDrawingMode = false;
        hitUserObjectRef.current = opt.target;
      }
    };

    // Attach listeners
    canvas.on("mouse:down:before" as any, onMouseDownBefore);
    canvas.on("mouse:down", onMouseDown as any);
    canvas.on("mouse:move", onMouseMove as any);
    canvas.on("mouse:up", onMouseUp as any);

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
      canvas.off("mouse:down:before" as any, onMouseDownBefore);
      canvas.off("mouse:down", onMouseDown as any);
      canvas.off("mouse:move", onMouseMove as any);
      canvas.off("mouse:up", onMouseUp as any);
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
  }, [getCanvas, activeTool, color, brushSize, spaceDownRef, selectTool]);
}
