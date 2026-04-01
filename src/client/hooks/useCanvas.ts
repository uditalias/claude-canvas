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
  STROKE_WIDTH,
  FONT_FAMILY,
} from "../lib/wobble";

export function useCanvas(
  canvasElRef: React.RefObject<HTMLCanvasElement | null>
) {
  const fabricRef = useRef<Canvas | null>(null);
  const spaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    el.width = window.innerWidth;
    el.height = window.innerHeight;

    const canvas = new Canvas(el, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#FAFAF7",
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
      canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
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
  }, [canvasElRef]);

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
    return canvas.toDataURL({ format: "png", multiplier: 1 });
  }, []);

  return { renderCommands, clear, takeScreenshot, autopan };
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
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x + 4, cmd.y + cmd.height / 2 - 7);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "circle": {
        const shape = wobbleCircle(cmd.x, cmd.y, cmd.radius);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x - 20, cmd.y - 7);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "ellipse": {
        const shape = wobbleEllipse(cmd.x, cmd.y, cmd.width / 2, cmd.height / 2);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const lbl = makeLabel(cmd.label, cmd.x - 20, cmd.y - 7);
          canvas.add(lbl);
          added.push(lbl);
        }
        break;
      }
      case "line": {
        const shape = wobbleLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "arrow": {
        const shape = wobbleArrow(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        canvas.add(shape);
        added.push(shape);
        if (cmd.label) {
          const mx = (cmd.x1 + cmd.x2) / 2;
          const my = (cmd.y1 + cmd.y2) / 2;
          const lbl = makeLabel(cmd.label, mx, my - 16);
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
          fill: STROKE_COLOR,
          selectable: true,
          hasControls: false,
        });
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
