import { useEffect, useRef, useCallback } from "react";
import { Canvas, FabricObject, Point } from "fabric";
import type { DrawCommand } from "../lib/protocol";
import { renderCommandsToCanvas, updateConnectorsForGroup } from "../lib/render-engine";
import { useCanvasExport } from "./useCanvasExport";
import { useCanvasZoom } from "./useCanvasZoom";

interface CanvasTheme {
  canvasBg: string;
  dotColor: string;
}

export function useCanvas(
  canvasElRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  activeToolRef?: React.RefObject<string>,
  theme?: CanvasTheme
) {
  const fabricRef = useRef<Canvas | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const labelsCallbackRef = useRef<((labels: { text: string; x: number; y: number }[]) => void) | null>(null);
  const spaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = canvasElRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    el.width = w;
    el.height = h;

    const canvas = new Canvas(el, {
      width: w,
      height: h,
      backgroundColor: "transparent",
      selection: true,
      stopContextMenu: false,
      fireRightClick: true,
    });
    fabricRef.current = canvas;

    // Expose for E2E testing
    (window as any).__fabricCanvas = canvas;

    // ── Zoom ──────────────────────────────────────────────────────────────
    canvas.on("mouse:wheel", (opt) => {
      const e = opt.e as WheelEvent;
      const delta = e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(10, Math.max(0.1, zoom));
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
      e.preventDefault();
      e.stopPropagation();
    });

    // ── Pan: Space+drag or middle-click drag ────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = true;
        canvas.defaultCursor = "grab";
        canvas.selection = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
        canvas.defaultCursor = "default";
        canvas.selection = true;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    canvas.on("mouse:down", (opt) => {
      const e = opt.e as MouseEvent;
      const isHand = activeToolRef?.current === "hand";
      if (spaceDownRef.current || e.button === 1 || (isHand && e.button === 0)) {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = "grabbing";
      }
    });

    canvas.on("mouse:move", (opt) => {
      if (!isPanningRef.current) return;
      const e = opt.e as MouseEvent;
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      const vpt = canvas.viewportTransform!;
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.requestRenderAll();
    });

    canvas.on("mouse:up", () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const isHand = activeToolRef?.current === "hand";
        canvas.defaultCursor = (spaceDownRef.current || isHand) ? "grab" : "default";
      }
    });

    // ── Resize (ResizeObserver handles both window resize and layout changes) ─
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        canvas.setDimensions({ width: cw, height: ch });
        canvas.renderAll();
      }
    });
    resizeObserver.observe(container);

    // ── Dot grid background (renders with viewport transform) ─────────
    const DOT_SPACING = 20;
    const DOT_RADIUS = 0.75;

    canvas.on("before:render", () => {
      const ctx = canvas.getContext();
      const vpt = canvas.viewportTransform;
      const zoom = vpt[0];
      const panX = vpt[4];
      const panY = vpt[5];

      const bg = themeRef.current?.canvasBg ?? "#FAFAF7";
      const dot = themeRef.current?.dotColor ?? "#d4d4d4";

      // Fill background in screen space
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.getWidth(), canvas.getHeight());
      ctx.restore();

      // Calculate visible area in world coordinates
      const startX = Math.floor(-panX / zoom / DOT_SPACING) * DOT_SPACING;
      const startY = Math.floor(-panY / zoom / DOT_SPACING) * DOT_SPACING;
      const endX = Math.ceil((canvas.getWidth() - panX) / zoom / DOT_SPACING) * DOT_SPACING;
      const endY = Math.ceil((canvas.getHeight() - panY) / zoom / DOT_SPACING) * DOT_SPACING;

      // Draw dots in world space (transformed by viewport)
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      ctx.fillStyle = dot;

      const scaledRadius = DOT_RADIUS / zoom;
      const minRadius = DOT_RADIUS * 0.5;
      const maxRadius = DOT_RADIUS * 2;
      const radius = Math.min(maxRadius, Math.max(minRadius, scaledRadius));

      for (let x = startX; x <= endX; x += DOT_SPACING) {
        for (let y = startY; y <= endY; y += DOT_SPACING) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // ── Dynamic connector re-routing when groups move ──────────────
    canvas.on("object:moving", (opt: { target: FabricObject }) => {
      const groupId = (opt.target as any).data?.groupId as string | undefined;
      if (groupId) {
        updateConnectorsForGroup(canvas, groupId);
        canvas.requestRenderAll();
      }
    });

    // ── Labels: collect label positions for React rendering ─────────
    canvas.on("after:render", () => {
      const vpt = canvas.viewportTransform;
      const zoom = vpt[0];
      const panX = vpt[4];
      const panY = vpt[5];

      const labels: { text: string; x: number; y: number }[] = [];
      for (const obj of canvas.getObjects()) {
        const label = (obj as any).data?.label as string | undefined;
        if (!label) continue;
        const bounds = obj.getBoundingRect();
        labels.push({
          text: label,
          x: bounds.left * zoom + panX + (bounds.width * zoom) / 2,
          y: bounds.top * zoom + panY - 20,
        });
      }
      labelsCallbackRef.current?.(labels);
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [canvasElRef, containerRef]);

  // Re-render canvas when theme changes
  useEffect(() => {
    fabricRef.current?.requestRenderAll();
  }, [theme]);

  const getCanvas = useCallback((): Canvas | null => {
    return fabricRef.current;
  }, []);

  // ── Auto-pan ────────────────────────────────────────────────────────────
  const autopan = useCallback((objects: FabricObject[]) => {
    const canvas = fabricRef.current;
    if (!canvas || objects.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const obj of objects) {
      const br = obj.getBoundingRect();
      minX = Math.min(minX, br.left);
      minY = Math.min(minY, br.top);
      maxX = Math.max(maxX, br.left + br.width);
      maxY = Math.max(maxY, br.top + br.height);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const vw = canvas.getWidth();
    const vh = canvas.getHeight();
    const vpt = canvas.viewportTransform!;
    const vcx = cx * vpt[0] + vpt[4];
    const vcy = cy * vpt[3] + vpt[5];

    const margin = 80;
    if (vcx < margin || vcx > vw - margin || vcy < margin || vcy > vh - margin) {
      const targetTx = vw / 2 - cx * vpt[0];
      const targetTy = vh / 2 - cy * vpt[3];
      animatePan(vpt[4], vpt[5], targetTx, targetTy, canvas, vpt);
    }
  }, []);

  // ── Render commands ─────────────────────────────────────────────────────
  const renderCommands = useCallback(
    (commands: DrawCommand[]): FabricObject[] => {
      const canvas = fabricRef.current;
      if (!canvas) return [];
      const added = renderCommandsToCanvas(canvas, commands);
      canvas.renderAll();
      return added;
    },
    []
  );

  const clear = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "transparent";
    canvas.renderAll();
  }, []);

  const takeScreenshot = useCallback((): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      return canvas.toDataURL({ format: "png", multiplier: 1 });
    }
    // Compute bounding box around all objects in screen space
    // getBoundingRect() returns coordinates already in the canvas pixel space
    const padding = 40;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
      const br = obj.getBoundingRect();
      minX = Math.min(minX, br.left);
      minY = Math.min(minY, br.top);
      maxX = Math.max(maxX, br.left + br.width);
      maxY = Math.max(maxY, br.top + br.height);
    }
    return canvas.toDataURL({
      format: "png",
      multiplier: 1,
      left: minX - padding,
      top: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    });
  }, []);

  const { exportSVG, exportPNG, exportJSON } = useCanvasExport(fabricRef);

  const clearLayer = useCallback((layer: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const toRemove = canvas.getObjects().filter(
      (obj) => (obj as unknown as { data?: { layer?: string } }).data?.layer === layer
    );
    for (const obj of toRemove) {
      canvas.remove(obj);
    }
    canvas.renderAll();
  }, []);

  const { zoomIn, zoomOut, resetZoom, fitToScreen, getZoom } = useCanvasZoom(fabricRef);

  const onLabelsUpdate = useCallback((cb: (labels: { text: string; x: number; y: number }[]) => void) => {
    labelsCallbackRef.current = cb;
  }, []);

  return { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom, onLabelsUpdate, exportSVG, exportPNG, exportJSON };
}


// ── Animate pan helper ────────────────────────────────────────────────────
function animatePan(
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
  c: Canvas,
  vpt: number[]
) {
  const duration = 400;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    vpt[4] = fromTx + (toTx - fromTx) * ease;
    vpt[5] = fromTy + (toTy - fromTy) * ease;
    c.requestRenderAll();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
