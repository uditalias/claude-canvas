import { useEffect, useRef, useCallback } from "react";
import { Canvas, Path, FabricText, FabricObject, Point } from "fabric";
import type { DrawCommand } from "../lib/protocol";
import {
  wobbleRect,
  wobbleCircle,
  wobbleEllipse,
  wobbleLine,
  wobbleArrow,
  makeLabel,
  STROKE_COLOR,
  FILL_COLOR,
  STROKE_WIDTH,
  FONT_FAMILY,
} from "../lib/wobble";

export function useCanvas(
  canvasElRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const fabricRef = useRef<Canvas | null>(null);
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
    });
    fabricRef.current = canvas;

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
      if (spaceDownRef.current || e.button === 1) {
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
        canvas.defaultCursor = spaceDownRef.current ? "grab" : "default";
      }
    });

    // ── Resize ──────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      canvas.setDimensions({ width: cw, height: ch });
      canvas.renderAll();
    };
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [canvasElRef, containerRef]);

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
    canvas.backgroundColor = "#FAFAF7";
    canvas.renderAll();
  }, []);

  const takeScreenshot = useCallback((): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    // Temporarily set white background for export
    const prevBg = canvas.backgroundColor;
    canvas.backgroundColor = "#FAFAF7";
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    canvas.backgroundColor = prevBg;
    canvas.renderAll();
    return dataUrl;
  }, []);

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

  // ── Zoom controls ────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let zoom = canvas.getZoom() * 1.2;
    zoom = Math.min(10, zoom);
    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, zoom);
    canvas.requestRenderAll();
  }, []);

  const zoomOut = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let zoom = canvas.getZoom() / 1.2;
    zoom = Math.max(0.1, zoom);
    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, zoom);
    canvas.requestRenderAll();
  }, []);

  const fitToScreen = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
      const br = obj.getBoundingRect();
      minX = Math.min(minX, br.left);
      minY = Math.min(minY, br.top);
      maxX = Math.max(maxX, br.left + br.width);
      maxY = Math.max(maxY, br.top + br.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW === 0 || contentH === 0) return;
    const padding = 60;
    const vw = canvas.getWidth() - padding * 2;
    const vh = canvas.getHeight() - padding * 2;
    const zoom = Math.min(vw / contentW, vh / contentH, 3);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    canvas.zoomToPoint(new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), zoom);
    const vpt = canvas.viewportTransform!;
    vpt[4] = canvas.getWidth() / 2 - cx * zoom;
    vpt[5] = canvas.getHeight() / 2 - cy * zoom;
    canvas.requestRenderAll();
  }, []);

  const getZoom = useCallback((): number => {
    return fabricRef.current?.getZoom() ?? 1;
  }, []);

  return { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, fitToScreen, getZoom };
}

function tagAsClaude(obj: FabricObject): void {
  obj.set({
    selectable: false,
    evented: false,
    data: { layer: "claude" },
  });
}

// ── Render commands (standalone, supports recursion for groups) ───────────
function renderCommandsToCanvas(
  canvas: Canvas,
  commands: DrawCommand[]
): FabricObject[] {
  const added: FabricObject[] = [];

  for (const cmd of commands) {
    switch (cmd.type) {
      case "rect": {
        const shape = wobbleRect(cmd.x, cmd.y, cmd.width, cmd.height);
        tagAsClaude(shape);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x + 4, cmd.y + cmd.height / 2 - 7);
          tagAsClaude(lbl);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "circle": {
        const shape = wobbleCircle(cmd.x, cmd.y, cmd.radius);
        tagAsClaude(shape);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x - 20, cmd.y - 7);
          tagAsClaude(lbl);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "ellipse": {
        const shape = wobbleEllipse(cmd.x, cmd.y, cmd.width / 2, cmd.height / 2);
        tagAsClaude(shape);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x - 20, cmd.y - 7);
          tagAsClaude(lbl);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "line": {
        const shape = wobbleLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        tagAsClaude(shape);
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "arrow": {
        const shape = wobbleArrow(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        tagAsClaude(shape);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const mx = (cmd.x1 + cmd.x2) / 2;
          const my = (cmd.y1 + cmd.y2) / 2;
          const lbl = makeLabel(cmd.label, mx, my - 16);
          tagAsClaude(lbl);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "text": {
        const t = new FabricText(cmd.content, {
          left: cmd.x,
          top: cmd.y,
          fontSize: cmd.fontSize ?? 16,
          fontFamily: FONT_FAMILY,
          fill: FILL_COLOR,
          selectable: true,
          hasControls: false,
        });
        tagAsClaude(t);
        canvas.add(t);
        added.push(t);
        break;
      }
      case "freehand": {
        if (cmd.points.length < 2) break;
        const pathData = cmd.points
          .map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px} ${py}`)
          .join(" ");
        const p = new Path(pathData, {
          stroke: STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
          fill: "transparent",
          selectable: true,
          hasControls: false,
        });
        tagAsClaude(p);
        canvas.add(p);
        added.push(p);
        break;
      }
      case "group": {
        const groupObjects = renderCommandsToCanvas(canvas, cmd.commands);
        added.push(...groupObjects);
        break;
      }
      case "connector":
        break;
    }
  }

  return added;
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
