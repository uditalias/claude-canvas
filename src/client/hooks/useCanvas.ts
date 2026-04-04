import { useEffect, useRef, useCallback } from "react";
import { Canvas, Path, FabricText, FabricObject, Group, Point } from "fabric";
import type { DrawCommand } from "../lib/protocol";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";
import {
  wobbleRect,
  wobbleCircle,
  wobbleEllipse,
  wobbleLine,
  wobbleArrow,
  hexToRgba,
  STROKE_COLOR,
  FILL_COLOR,
  STROKE_WIDTH,
  FONT_FAMILY,
  removeFillFromGroup,
} from "../lib/wobble";

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
      const ctx = canvas.getContext("2d");
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
    // The after:render handler draws the background, so just export directly
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    return dataUrl;
  }, []);

  const exportSVG = useCallback((includeLabels = false): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    const tempLabels: FabricText[] = [];
    if (includeLabels) {
      for (const obj of canvas.getObjects()) {
        const label = (obj as any).data?.label as string | undefined;
        if (!label) continue;
        const bounds = obj.getBoundingRect();
        const t = new FabricText(label, {
          left: bounds.left + bounds.width / 2,
          top: bounds.top - 4,
          fontSize: 12,
          fontFamily: "sans-serif",
          fill: "rgba(0,0,0,0.5)",
          originX: "center",
          originY: "bottom",
          selectable: false,
          evented: false,
        });
        canvas.add(t);
        tempLabels.push(t);
      }
    }
    const svg = canvas.toSVG();
    for (const t of tempLabels) canvas.remove(t);
    return svg;
  }, []);

  const exportPNG = useCallback((includeLabels = false): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    const tempLabels: FabricText[] = [];
    if (includeLabels) {
      for (const obj of canvas.getObjects()) {
        const label = (obj as any).data?.label as string | undefined;
        if (!label) continue;
        const bounds = obj.getBoundingRect();
        const t = new FabricText(label, {
          left: bounds.left + bounds.width / 2,
          top: bounds.top - 4,
          fontSize: 12,
          fontFamily: "sans-serif",
          fill: "rgba(0,0,0,0.5)",
          originX: "center",
          originY: "bottom",
          selectable: false,
          evented: false,
        });
        canvas.add(t);
        tempLabels.push(t);
      }
    }
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    for (const t of tempLabels) canvas.remove(t);
    return dataUrl;
  }, []);

  const exportJSON = useCallback((): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "[]";
    const commands: DrawCommand[] = [];

    for (const obj of canvas.getObjects()) {
      const data = (obj as any).data as {
        layer?: string; shapeType?: string; label?: string;
      } | undefined;
      const shapeType = data?.shapeType;
      const label = data?.label as string | undefined;
      const opacity = obj.opacity !== undefined && obj.opacity !== 1 ? obj.opacity : undefined;

      // Extract color from object based on its type
      const color = getObjectColor(obj);

      // Read fillStyle from data (default is hachure)
      const fillStyle = (data as any)?.fillStyle as string | undefined;

      if (shapeType === "rect") {
        const br = obj.getBoundingRect();
        const cmd: any = { type: "rect", x: Math.round(br.left), y: Math.round(br.top), width: Math.round(br.width), height: Math.round(br.height) };
        if (label) cmd.label = label;
        if (fillStyle && fillStyle !== "hachure") cmd.fillStyle = fillStyle;
        if (color) cmd.color = color;
        if (opacity !== undefined) cmd.opacity = opacity;
        commands.push(cmd);
      } else if (shapeType === "circle") {
        const br = obj.getBoundingRect();
        const r = Math.round(Math.min(br.width, br.height) / 2);
        const cmd: any = { type: "circle", x: Math.round(br.left + br.width / 2), y: Math.round(br.top + br.height / 2), radius: r };
        if (label) cmd.label = label;
        if (fillStyle && fillStyle !== "hachure") cmd.fillStyle = fillStyle;
        if (color) cmd.color = color;
        if (opacity !== undefined) cmd.opacity = opacity;
        commands.push(cmd);
      } else if (shapeType === "ellipse") {
        const br = obj.getBoundingRect();
        const cmd: any = { type: "ellipse", x: Math.round(br.left), y: Math.round(br.top), width: Math.round(br.width), height: Math.round(br.height) };
        if (label) cmd.label = label;
        if (fillStyle && fillStyle !== "hachure") cmd.fillStyle = fillStyle;
        if (color) cmd.color = color;
        if (opacity !== undefined) cmd.opacity = opacity;
        commands.push(cmd);
      } else if (shapeType === "line" || shapeType === "arrow") {
        let x1: number, y1: number, x2: number, y2: number;
        if (obj instanceof RoughLineObject || obj instanceof RoughArrowObject) {
          const pts = obj.calcLinePoints();
          const matrix = obj.calcOwnMatrix();
          const p1 = new Point(pts.x1, pts.y1).transform(matrix);
          const p2 = new Point(pts.x2, pts.y2).transform(matrix);
          x1 = Math.round(p1.x); y1 = Math.round(p1.y);
          x2 = Math.round(p2.x); y2 = Math.round(p2.y);
        } else {
          // Group-based Claude line/arrow — use bounding rect as approximation
          const br = obj.getBoundingRect();
          x1 = Math.round(br.left); y1 = Math.round(br.top);
          x2 = Math.round(br.left + br.width); y2 = Math.round(br.top + br.height);
        }
        const cmd: any = { type: shapeType, x1, y1, x2, y2 };
        if (label) cmd.label = label;
        if (color) cmd.color = color;
        if (opacity !== undefined) cmd.opacity = opacity;
        commands.push(cmd);
      } else if (shapeType === "text") {
        const textObj = obj as FabricText;
        const align = (textObj.textAlign as "left" | "center" | "right") || "left";
        const cmd: any = {
          type: "text",
          x: Math.round(textObj.left ?? 0),
          y: Math.round(textObj.top ?? 0),
          content: textObj.text ?? "",
          fontSize: textObj.fontSize ?? 16,
        };
        if (align !== "left") cmd.textAlign = align;
        if (textObj.fontWeight && textObj.fontWeight !== "normal") cmd.fontWeight = textObj.fontWeight;
        if (textObj.fontStyle && textObj.fontStyle !== "normal") cmd.fontStyle = textObj.fontStyle;
        if ((textObj as any).underline) cmd.underline = true;
        if ((textObj as any).linethrough) cmd.linethrough = true;
        if (color) cmd.color = color;
        if (opacity !== undefined) cmd.opacity = opacity;
        commands.push(cmd);
      } else if (shapeType === "freehand" && obj instanceof Path) {
        const pathData = (obj as any).path as Array<(string | number)[]>;
        if (!pathData) continue;
        const matrix = obj.calcOwnMatrix();
        const points: [number, number][] = [];
        for (const seg of pathData) {
          if (seg[0] === "M" || seg[0] === "L") {
            const p = new Point(seg[1] as number, seg[2] as number).transform(matrix);
            points.push([Math.round(p.x), Math.round(p.y)]);
          } else if (seg[0] === "Q") {
            const p = new Point(seg[3] as number, seg[4] as number).transform(matrix);
            points.push([Math.round(p.x), Math.round(p.y)]);
          }
        }
        if (points.length >= 2) {
          const cmd: any = { type: "freehand", points };
          if (color) cmd.color = color;
          if (opacity !== undefined) cmd.opacity = opacity;
          commands.push(cmd);
        }
      }
    }

    return JSON.stringify({ commands }, null, 2);
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

  const resetZoom = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
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

  const onLabelsUpdate = useCallback((cb: (labels: { text: string; x: number; y: number }[]) => void) => {
    labelsCallbackRef.current = cb;
  }, []);

  return { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom, onLabelsUpdate, exportSVG, exportPNG, exportJSON };
}

/** Extract the primary color from a Fabric object */
export function getObjectColor(obj: FabricObject): string | undefined {
  if (obj instanceof RoughLineObject || obj instanceof RoughArrowObject) {
    return (obj as RoughLineObject).strokeColor;
  }
  if (obj instanceof FabricText) {
    return obj.fill as string || undefined;
  }
  if (obj instanceof Path) {
    return obj.stroke as string || undefined;
  }
  if (obj instanceof Group) {
    // Find the solid stroke color from child paths (not the rgba fill paths)
    for (const child of obj.getObjects()) {
      if (child instanceof Path) {
        const s = child.stroke as string;
        if (s && !s.startsWith("rgba") && s !== "transparent") {
          return s;
        }
      }
    }
  }
  return undefined;
}

/** Apply a color to a Fabric object (mirrors context menu onColorChange logic) */
export function applyColor(obj: FabricObject, color: string): void {
  if (obj instanceof Group) {
    const fillLight = hexToRgba(color, 0.35);
    for (const child of obj.getObjects()) {
      if (child instanceof Path) {
        const s = child.stroke as string;
        const f = child.fill as string;
        if (s && (s.startsWith("rgba") || s === "transparent")) {
          // Hachure/pattern fill path (color in stroke) or solid fill path (color in fill)
          child.set({ stroke: fillLight });
          if (f && f.startsWith("rgba")) {
            child.set({ fill: fillLight });
          }
        } else {
          child.set({ stroke: color });
        }
      }
    }
  }
}

function tagAsClaude(obj: FabricObject, shapeType: string, geo?: Record<string, unknown>): void {
  obj.set({
    selectable: false,
    evented: false,
    data: { layer: "claude", shapeType, ...(geo && { geo }) },
  });
}

// Resolve fillStyle: explicit fillStyle wins, then legacy fill:false → "none", default "hachure"
function resolveFillStyle(cmd: { fill?: boolean; fillStyle?: string }): string {
  if (cmd.fillStyle) return cmd.fillStyle;
  if (cmd.fill === false) return "none";
  return "hachure";
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
        const fs = resolveFillStyle(cmd);
        const shape = wobbleRect(cmd.x, cmd.y, cmd.width, cmd.height, fs);
        tagAsClaude(shape, "rect", { x: cmd.x, y: cmd.y, width: cmd.width, height: cmd.height });
        if (fs !== "hachure") (shape as any).data.fillStyle = fs;
        if (cmd.label) (shape as any).data.label = cmd.label;
        if (cmd.color) applyColor(shape, cmd.color);
        if (cmd.opacity !== undefined) shape.set({ opacity: cmd.opacity });
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "circle": {
        const fs = resolveFillStyle(cmd);
        const shape = wobbleCircle(cmd.x, cmd.y, cmd.radius, fs);
        tagAsClaude(shape, "circle", { x: cmd.x, y: cmd.y, radius: cmd.radius });
        if (fs !== "hachure") (shape as any).data.fillStyle = fs;
        if (cmd.label) (shape as any).data.label = cmd.label;
        if (cmd.color) applyColor(shape, cmd.color);
        if (cmd.opacity !== undefined) shape.set({ opacity: cmd.opacity });
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "ellipse": {
        const fs = resolveFillStyle(cmd);
        const shape = wobbleEllipse(cmd.x, cmd.y, cmd.width / 2, cmd.height / 2, fs);
        tagAsClaude(shape, "ellipse", { x: cmd.x, y: cmd.y, width: cmd.width, height: cmd.height });
        if (fs !== "hachure") (shape as any).data.fillStyle = fs;
        if (cmd.label) (shape as any).data.label = cmd.label;
        if (cmd.color) applyColor(shape, cmd.color);
        if (cmd.opacity !== undefined) shape.set({ opacity: cmd.opacity });
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "line": {
        const shape = wobbleLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        tagAsClaude(shape, "line");
        if (cmd.label) (shape as any).data.label = cmd.label;
        if (cmd.color) applyColor(shape, cmd.color);
        if (cmd.opacity !== undefined) shape.set({ opacity: cmd.opacity });
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "arrow": {
        const shape = wobbleArrow(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
        tagAsClaude(shape, "arrow");
        if (cmd.label) (shape as any).data.label = cmd.label;
        if (cmd.color) applyColor(shape, cmd.color);
        if (cmd.opacity !== undefined) shape.set({ opacity: cmd.opacity });
        canvas.add(shape);
        added.push(shape);
        break;
      }
      case "text": {
        const align = cmd.textAlign ?? "left";
        const t = new FabricText(cmd.content, {
          left: cmd.x,
          top: cmd.y,
          fontSize: cmd.fontSize ?? 16,
          fontFamily: FONT_FAMILY,
          fill: cmd.color ?? FILL_COLOR,
          textAlign: align,
          originX: align === "center" ? "center" : align === "right" ? "right" : "left",
          fontWeight: cmd.fontWeight ?? "normal",
          fontStyle: cmd.fontStyle ?? "normal",
          underline: cmd.underline ?? false,
          linethrough: cmd.linethrough ?? false,
          selectable: true,
          hasControls: false,
        });
        tagAsClaude(t, "text");
        if (cmd.opacity !== undefined) t.set({ opacity: cmd.opacity });
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
          stroke: cmd.color ?? STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
          fill: "transparent",
          selectable: true,
          hasControls: false,
        });
        tagAsClaude(p, "freehand");
        if (cmd.opacity !== undefined) p.set({ opacity: cmd.opacity });
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
