import { Path, FabricText, Group, FabricObject } from "fabric";
import type { RoughGenerator } from "roughjs/bin/generator";

// These types exist in roughjs internals but aren't exported from the type definitions
type Op = { op: string; data: number[] };
type OpSet = { type: string; ops: Op[] };
type Drawable = { sets: OpSet[]; shape: string; options: any };

// ── Constants ───────────────────────────────────────────────────────────────
export const STROKE_COLOR = "#000000";
export const FILL_COLOR = "#B5651D";
export const FILL_COLOR_LIGHT = "rgba(181, 101, 29, 0.35)";
export const STROKE_WIDTH = 1.5;
export const FONT_FAMILY = "Inter, sans-serif";
export const FILL_STYLES = ["hachure", "solid", "zigzag", "cross-hatch", "dots", "dashed", "zigzag-line", "none"] as const;

// ── Lazy-init rough.js generator ────────────────────────────────────────────
let _generator: RoughGenerator | null = null;

async function getGenerator(): Promise<RoughGenerator> {
  if (_generator) return _generator;
  const rough = await import("roughjs/bin/rough");
  _generator = rough.default.generator();
  return _generator;
}

// Synchronous access after first init
let _generatorSync: RoughGenerator | null = null;

export function initGenerator(): Promise<void> {
  return getGenerator().then((g) => {
    _generatorSync = g;
  });
}

function gen(): RoughGenerator {
  if (!_generatorSync) {
    throw new Error("Call initGenerator() before using wobble functions");
  }
  return _generatorSync;
}

// ── Convert rough.js ops to SVG path string ─────────────────────────────────
function opsToPath(ops: Op[]): string {
  let d = "";
  for (const op of ops) {
    switch (op.op) {
      case "move":
        d += `M ${op.data[0]} ${op.data[1]} `;
        break;
      case "lineTo":
        d += `L ${op.data[0]} ${op.data[1]} `;
        break;
      case "bcurveTo":
        d += `C ${op.data[0]} ${op.data[1]} ${op.data[2]} ${op.data[3]} ${op.data[4]} ${op.data[5]} `;
        break;
    }
  }
  return d.trim();
}

// ── Deterministic seed from position ────────────────────────────────────────
function positionSeed(x: number, y: number, w: number, h: number): number {
  return Math.abs(((x * 73856093) ^ (y * 19349663) ^ (w * 83492791) ^ (h * 44867)) | 0) % 2147483647 || 1;
}

// ── rough.js options ────────────────────────────────────────────────────────
const ROUGH_OPTS = {
  roughness: 1.5,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  fill: FILL_COLOR_LIGHT,
  fillStyle: "hachure" as const,
  fillWeight: 1,
  hachureGap: 5,
  hachureAngle: -41,
};

const LINE_ROUGH_OPTS = {
  roughness: 1.5,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
};

// ── Convert a Drawable to Fabric.js objects ──────────────────────────────────
function drawableToFabricObjects(drawable: Drawable, fillColorOverride?: string, strokeColorOverride?: string): FabricObject[] {
  const objects: FabricObject[] = [];

  for (const opSet of drawable.sets) {
    const pathStr = opsToPath(opSet.ops);
    if (!pathStr) continue;

    if (opSet.type === "fillSketch") {
      // Hachure/pattern fill lines
      objects.push(
        new Path(pathStr, {
          stroke: fillColorOverride || FILL_COLOR_LIGHT,
          strokeWidth: ROUGH_OPTS.fillWeight,
          fill: "transparent",
          selectable: false,
          evented: false,
        })
      );
    } else if (opSet.type === "fillPath") {
      // Solid fill path
      objects.push(
        new Path(pathStr, {
          stroke: "transparent",
          strokeWidth: 0,
          fill: fillColorOverride || FILL_COLOR_LIGHT,
          selectable: false,
          evented: false,
        })
      );
    } else if (opSet.type === "path") {
      // Outline stroke
      objects.push(
        new Path(pathStr, {
          stroke: strokeColorOverride || STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
          fill: "transparent",
          selectable: false,
          evented: false,
        })
      );
    }
  }

  return objects;
}

// ── Fill helpers ────────────────────────────────────────────────────────────

export function removeFillFromGroup(group: Group): void {
  for (const child of group.getObjects()) {
    if (child instanceof Path) {
      const s = child.stroke as string;
      const f = child.fill as string;
      if ((s && (s.startsWith("rgba") || s === "transparent")) || (f && f.startsWith("rgba"))) {
        child.visible = false;
      }
    }
  }
  group.dirty = true;
}

function buildFillOpts(fillStyle: string | undefined, strokeColor: string, fillColor: string, seed: number) {
  const base = { ...ROUGH_OPTS, stroke: strokeColor, fill: fillColor, seed };
  if (fillStyle && fillStyle !== "none" && fillStyle !== "hachure") {
    return { ...base, fillStyle };
  }
  return base;
}

// ── Generate rough.js fill/stroke paths for a shape (without wrapping in Group) ──

export function generateRectPaths(x: number, y: number, w: number, h: number, strokeColor: string, fillColor: string, fillStyle?: string): FabricObject[] {
  const seed = positionSeed(x, y, w, h);
  const fillLight = hexToRgba(fillColor, 0.35);
  const opts = buildFillOpts(fillStyle, strokeColor, fillLight, seed);
  const drawable = gen().rectangle(x, y, w, h, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, strokeColor);
  if (fillStyle === "none") {
    for (const obj of objects) {
      if (obj instanceof Path) {
        const s = obj.stroke as string;
        const f = obj.fill as string;
        if ((s && (s.startsWith("rgba") || s === "transparent")) || (f && f.startsWith("rgba"))) {
          obj.visible = false;
        }
      }
    }
  }
  return objects;
}

export function generateCirclePaths(cx: number, cy: number, r: number, strokeColor: string, fillColor: string, fillStyle?: string): FabricObject[] {
  const seed = positionSeed(cx, cy, r, r);
  const fillLight = hexToRgba(fillColor, 0.35);
  const opts = buildFillOpts(fillStyle, strokeColor, fillLight, seed);
  const drawable = gen().circle(cx, cy, r * 2, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, strokeColor);
  if (fillStyle === "none") {
    for (const obj of objects) {
      if (obj instanceof Path) {
        const s = obj.stroke as string;
        const f = obj.fill as string;
        if ((s && (s.startsWith("rgba") || s === "transparent")) || (f && f.startsWith("rgba"))) {
          obj.visible = false;
        }
      }
    }
  }
  return objects;
}

export function generateEllipsePaths(cx: number, cy: number, rx: number, ry: number, strokeColor: string, fillColor: string, fillStyle?: string): FabricObject[] {
  const seed = positionSeed(cx, cy, rx, ry);
  const fillLight = hexToRgba(fillColor, 0.35);
  const opts = buildFillOpts(fillStyle, strokeColor, fillLight, seed);
  const drawable = gen().ellipse(cx, cy, rx * 2, ry * 2, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, strokeColor);
  if (fillStyle === "none") {
    for (const obj of objects) {
      if (obj instanceof Path) {
        const s = obj.stroke as string;
        const f = obj.fill as string;
        if ((s && (s.startsWith("rgba") || s === "transparent")) || (f && f.startsWith("rgba"))) {
          obj.visible = false;
        }
      }
    }
  }
  return objects;
}

// ── Shape renderers (return Fabric.js Group with rough.js paths) ────────────

export function roughRect(x: number, y: number, w: number, h: number, fillStyle?: string): Group {
  const seed = positionSeed(x, y, w, h);
  const fillLight = hexToRgba(FILL_COLOR, 0.35);
  const opts = buildFillOpts(fillStyle, FILL_COLOR, fillLight, seed);
  const drawable = gen().rectangle(x, y, w, h, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, FILL_COLOR);
  const group = new Group(objects, { selectable: true, hasControls: false });
  if (fillStyle === "none") removeFillFromGroup(group);
  return group;
}

export function roughCircle(cx: number, cy: number, r: number, fillStyle?: string): Group {
  const seed = positionSeed(cx, cy, r, r);
  const fillLight = hexToRgba(FILL_COLOR, 0.35);
  const opts = buildFillOpts(fillStyle, FILL_COLOR, fillLight, seed);
  const drawable = gen().circle(cx, cy, r * 2, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, FILL_COLOR);
  const group = new Group(objects, { selectable: true, hasControls: false });
  if (fillStyle === "none") removeFillFromGroup(group);
  return group;
}

export function roughEllipse(cx: number, cy: number, rx: number, ry: number, fillStyle?: string): Group {
  const seed = positionSeed(cx, cy, rx, ry);
  const fillLight = hexToRgba(FILL_COLOR, 0.35);
  const opts = buildFillOpts(fillStyle, FILL_COLOR, fillLight, seed);
  const drawable = gen().ellipse(cx, cy, rx * 2, ry * 2, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, FILL_COLOR);
  const group = new Group(objects, { selectable: true, hasControls: false });
  if (fillStyle === "none") removeFillFromGroup(group);
  return group;
}

export function roughLine(x1: number, y1: number, x2: number, y2: number): Group {
  const seed = positionSeed(x1, y1, x2, y2);
  const drawable = gen().line(x1, y1, x2, y2, { ...LINE_ROUGH_OPTS, stroke: FILL_COLOR, seed });
  const objects = drawableToFabricObjects(drawable, undefined, FILL_COLOR);
  return new Group(objects, { selectable: true, hasControls: false });
}

export function roughArrow(x1: number, y1: number, x2: number, y2: number): Group {
  const seed = positionSeed(x1, y1, x2, y2);
  const opts = { ...LINE_ROUGH_OPTS, stroke: FILL_COLOR, seed };

  const lineDrawable = gen().line(x1, y1, x2, y2, opts);
  const lineObjects = drawableToFabricObjects(lineDrawable, undefined, FILL_COLOR);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 14;
  const headWidth = 7;

  const ax = x2 - ux * headLen + (-uy) * headWidth;
  const ay = y2 - uy * headLen + ux * headWidth;
  const bx = x2 - ux * headLen + uy * headWidth;
  const by = y2 - uy * headLen + (-ux) * headWidth;

  const h1 = gen().linearPath([[x2, y2], [ax, ay]], { ...opts, seed: seed + 1 });
  const h2 = gen().linearPath([[x2, y2], [bx, by]], { ...opts, seed: seed + 2 });

  return new Group([...lineObjects, ...drawableToFabricObjects(h1, undefined, FILL_COLOR), ...drawableToFabricObjects(h2, undefined, FILL_COLOR)], {
    selectable: true,
    hasControls: false,
  });
}

// ── Legacy aliases for useCanvas ─────────────────────────────────────────────
export const wobbleRect = roughRect;
export const wobbleCircle = roughCircle;
export const wobbleEllipse = roughEllipse;
export const wobbleLine = roughLine;
export const wobbleArrow = roughArrow;

// ── Color utility ───────────────────────────────────────────────────────────
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── User shape renderers (custom fill color) ────────────────────────────────

export function userRoughRect(left: number, top: number, w: number, h: number, fillColor: string, fillStyle?: string): Group {
  const seed = positionSeed(left, top, w, h);
  const fillLight = hexToRgba(fillColor, 0.35);
  const opts = buildFillOpts(fillStyle, fillColor, fillLight, seed);
  const drawable = gen().rectangle(0, 0, w, h, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, fillColor);
  const group = new Group(objects, { left, top, originX: "left", originY: "top", selectable: true, hasControls: true });
  if (fillStyle === "none") removeFillFromGroup(group);
  return group;
}

export function userRoughEllipse(left: number, top: number, w: number, h: number, fillColor: string, fillStyle?: string): Group {
  const seed = positionSeed(left, top, w, h);
  const fillLight = hexToRgba(fillColor, 0.35);
  const opts = buildFillOpts(fillStyle, fillColor, fillLight, seed);
  const drawable = gen().ellipse(w / 2, h / 2, w, h, opts);
  const objects = drawableToFabricObjects(drawable, fillLight, fillColor);
  const group = new Group(objects, { left, top, originX: "left", originY: "top", selectable: true, hasControls: true });
  if (fillStyle === "none") removeFillFromGroup(group);
  return group;
}

export function userRoughLine(x1: number, y1: number, x2: number, y2: number, strokeColor: string): Group {
  const seed = positionSeed(x1, y1, x2, y2);
  const opts = { ...LINE_ROUGH_OPTS, stroke: strokeColor, seed };
  const drawable = gen().line(x1, y1, x2, y2, opts);
  const objects = drawableToFabricObjects(drawable, undefined, strokeColor);
  return new Group(objects, { selectable: true, hasControls: true });
}

export function userRoughArrow(x1: number, y1: number, x2: number, y2: number, strokeColor: string): Group {
  const seed = positionSeed(x1, y1, x2, y2);
  const opts = { ...LINE_ROUGH_OPTS, stroke: strokeColor, seed };
  const lineDrawable = gen().line(x1, y1, x2, y2, opts);
  const lineObjects = drawableToFabricObjects(lineDrawable, undefined, strokeColor);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 14;
  const headWidth = 7;
  const ax = x2 - ux * headLen + (-uy) * headWidth;
  const ay = y2 - uy * headLen + ux * headWidth;
  const bx = x2 - ux * headLen + uy * headWidth;
  const by = y2 - uy * headLen + (-ux) * headWidth;

  const h1 = gen().linearPath([[x2, y2], [ax, ay]], { ...opts, seed: seed + 1 });
  const h2 = gen().linearPath([[x2, y2], [bx, by]], { ...opts, seed: seed + 2 });

  return new Group([...lineObjects, ...drawableToFabricObjects(h1, undefined, strokeColor), ...drawableToFabricObjects(h2, undefined, strokeColor)], {
    selectable: true,
    hasControls: true,
  });
}

export function makeLabel(text: string, x: number, y: number): FabricText {
  return new FabricText(text, {
    left: x,
    top: y,
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    fill: FILL_COLOR,
    selectable: false,
    hasControls: false,
  });
}

