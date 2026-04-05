import { useEffect, useRef } from "react";
import {
  Canvas,
  PencilBrush,
  IText,
  Group,
  FabricObject,
} from "fabric";
import type { ToolType } from "./useToolState";
import {
  userRoughRect,
  userRoughEllipse,
} from "../lib/wobble";
import { getObjectColor } from "../lib/colors";
import { useShapeDrawing } from "./useShapeDrawing";
import { useClipboardAndDragDrop } from "./useClipboardAndDragDrop";

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
  const isReRenderingRef = useRef(false);

  const { onMouseDown, onMouseMove, onMouseUp, ghostRef, isDraggingRef, pendingSelectRef } = useShapeDrawing({
    getCanvas,
    activeTool,
    color,
    brushSize,
    spaceDownRef,
    selectTool,
    saveSnapshot,
  });

  const { onKeyDown, onPaste, onDragOver, onDrop } = useClipboardAndDragDrop({
    getCanvas,
    saveSnapshot,
  });

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
      } else if (activeTool === "marker") {
        brush.color = "rgba(255, 230, 0, 0.4)";
        brush.width = 16;
      }
    }

    // Only pointer and paint tools allow interacting with existing objects.
    // Drawing tools (shapes, lines, freehand) should draw through objects.
    const isPaint = activeTool === "paint";
    const canInteract = isPointer || isPaint;
    const paintCursor = isPaint ? makePaintCursor(resolvedTheme === "dark" ? "white" : "black") : undefined;
    canvas.forEachObject((obj) => {
      obj.selectable = canInteract;
      obj.evented = canInteract;
      obj.hoverCursor = paintCursor ?? null;
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
        saveSnapshot?.();
        pendingSelectRef.current = opt.path;
        selectTool("pointer");
      }
    };

    // Image drag-and-drop element
    const canvasEl = canvas.getSelectionElement();

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
  }, [getCanvas, activeTool, color, brushSize, spaceDownRef, selectTool, resolvedTheme, saveSnapshot, pauseHistory, resumeHistory, onKeyDown, onPaste, onDragOver, onDrop]);
}
