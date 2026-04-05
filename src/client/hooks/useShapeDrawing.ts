import { useRef } from "react";
import {
  Canvas,
  Rect,
  Ellipse,
  IText,
  Path,
  Group,
  FabricObject,
} from "fabric";
import type { ToolType } from "./useToolState";
import {
  userRoughRect,
  userRoughEllipse,
  hexToRgba,
} from "../lib/wobble";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

function tagAsUser(obj: FabricObject, shapeType?: string, geo?: Record<string, unknown>): void {
  obj.set({ data: { layer: "user", ...(shapeType && { shapeType }), ...(geo && { geo }) } });
}

interface UseShapeDrawingOptions {
  getCanvas: () => Canvas | null;
  activeTool: ToolType;
  color: string;
  brushSize: number;
  spaceDownRef: React.RefObject<boolean>;
  selectTool: (tool: ToolType) => void;
  saveSnapshot?: () => void;
}

export function useShapeDrawing({
  getCanvas,
  activeTool,
  color,
  brushSize,
  spaceDownRef,
  selectTool,
  saveSnapshot,
}: UseShapeDrawingOptions) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<FabricObject | null>(null);
  const pendingSelectRef = useRef<FabricObject | null>(null);

  const isShapeTool = activeTool === "rect" || activeTool === "circle" || activeTool === "arrow" || activeTool === "line";

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
      saveSnapshot?.();
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

  return { onMouseDown, onMouseMove, onMouseUp, ghostRef, isDraggingRef, pendingSelectRef };
}
