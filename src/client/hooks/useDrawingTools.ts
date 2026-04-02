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
      const brush = canvas.freeDrawingBrush;
      brush.color = color;

      if (activeTool === "pencil") {
        brush.width = brushSize;
        (brush as PencilBrush).opacity = 1;
      } else if (activeTool === "marker") {
        brush.color = "rgba(255, 230, 0, 0.4)";
        brush.width = 16;
        (brush as PencilBrush).opacity = 1;
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
          stroke: "#888",
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
          stroke: "#888",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        ghostRef.current = ghost;
        canvas.add(ghost);
      } else if (activeTool === "arrow" || activeTool === "line") {
        const ghost = new FabricLine([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: "#888",
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

      // Figma-style: shape spans from click to pointer in any direction
      if (activeTool === "rect") {
        const ghost = ghostRef.current as Rect;
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const w = Math.abs(pointer.x - start.x);
        const h = Math.abs(pointer.y - start.y);
        ghost.set({ left, top, width: w, height: h });
      } else if (activeTool === "circle") {
        const ghost = ghostRef.current as Ellipse;
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const w = Math.abs(pointer.x - start.x);
        const h = Math.abs(pointer.y - start.y);
        ghost.set({ left, top, rx: w / 2, ry: h / 2 });
      } else if (activeTool === "arrow" || activeTool === "line") {
        const ghost = ghostRef.current as FabricLine;
        ghost.set({ x2: pointer.x, y2: pointer.y });
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
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

      const left = Math.min(start.x, pointer.x);
      const top = Math.min(start.y, pointer.y);
      const w = Math.abs(dx);
      const h = Math.abs(dy);

      if (activeTool === "rect") {
        const shape = userRoughRect(left, top, w, h, color);
        tagAsUser(shape);
        canvas.add(shape);
      } else if (activeTool === "circle") {
        const shape = userRoughEllipse(left, top, w, h, color);
        tagAsUser(shape);
        canvas.add(shape);
      } else if (activeTool === "line") {
        const shape = userRoughLine(start.x, start.y, pointer.x, pointer.y, color);
        tagAsUser(shape);
        canvas.add(shape);
      } else if (activeTool === "arrow") {
        const shape = userRoughArrow(start.x, start.y, pointer.x, pointer.y, color);
        tagAsUser(shape);
        canvas.add(shape);
      }

      canvas.requestRenderAll();
    };

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

    return () => {
      canvas.off("mouse:down:before" as any, onMouseDownBefore);
      canvas.off("mouse:down", onMouseDown as any);
      canvas.off("mouse:move", onMouseMove as any);
      canvas.off("mouse:up", onMouseUp as any);
      if (isDrawingTool) {
        canvas.off("path:created" as any, onPathCreated);
      }
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [getCanvas, activeTool, color, brushSize, spaceDownRef, selectTool]);
}
