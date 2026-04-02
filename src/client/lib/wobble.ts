import { Path, FabricText, Group, FabricObject } from "fabric";
import type { RoughGenerator, Drawable, OpSet, Op } from "roughjs/bin/generator";

// ── Constants ───────────────────────────────────────────────────────────────
export const STROKE_COLOR = "#000000";
export const FILL_COLOR = "#B5651D";
export const FILL_COLOR_LIGHT = "rgba(181, 101, 29, 0.35)";
export const STROKE_WIDTH = 1.5;
export const FONT_FAMILY = "Patrick Hand, cursive";

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
      // Hachure fill lines
      objects.push(
        new Path(pathStr, {
          stroke: fillColorOverride || FILL_COLOR_LIGHT,
          strokeWidth: ROUGH_OPTS.fillWeight,
          fill: "transparent",
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

// ── Shape renderers (return Fabric.js Group with rough.js paths) ────────────

export function roughRect(x: number, y: number, w: number, h: number): Group {
  const seed = positionSeed(x, y, w, h);
  const drawable = gen().rectangle(x, y, w, h, { ...ROUGH_OPTS, seed });
  const objects = drawableToFabricObjects(drawable);
  return new Group(objects, { selectable: true, hasControls: false });
}

export function roughCircle(cx: number, cy: number, r: number): Group {
  const seed = positionSeed(cx, cy, r, r);
  // rough.js circle takes diameter, not radius
  const drawable = gen().circle(cx, cy, r * 2, { ...ROUGH_OPTS, seed });
  const objects = drawableToFabricObjects(drawable);
  return new Group(objects, { selectable: true, hasControls: false });
}

export function roughEllipse(cx: number, cy: number, rx: number, ry: number): Group {
  const seed = positionSeed(cx, cy, rx, ry);
  const drawable = gen().ellipse(cx, cy, rx * 2, ry * 2, { ...ROUGH_OPTS, seed });
  const objects = drawableToFabricObjects(drawable);
  return new Group(objects, { selectable: true, hasControls: false });
}

export function roughLine(x1: number, y1: number, x2: number, y2: number): Group {
  const seed = positionSeed(x1, y1, x2, y2);
  const drawable = gen().line(x1, y1, x2, y2, { ...LINE_ROUGH_OPTS, seed });
  const objects = drawableToFabricObjects(drawable);
  return new Group(objects, { selectable: true, hasControls: false });
}

export function roughArrow(x1: number, y1: number, x2: number, y2: number): Group {
  const seed = positionSeed(x1, y1, x2, y2);

  // Line body
  const lineDrawable = gen().line(x1, y1, x2, y2, { ...LINE_ROUGH_OPTS, seed });
  const lineObjects = drawableToFabricObjects(lineDrawable);

  // Arrowhead
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

  const headDrawable = gen().linearPath(
    [
      [x2, y2],
      [ax, ay],
    ],
    { ...LINE_ROUGH_OPTS, seed: seed + 1 }
  );
  const headDrawable2 = gen().linearPath(
    [
      [x2, y2],
      [bx, by],
    ],
    { ...LINE_ROUGH_OPTS, seed: seed + 2 }
  );

  const headObjects = [
    ...drawableToFabricObjects(headDrawable),
    ...drawableToFabricObjects(headDrawable2),
  ];

  return new Group([...lineObjects, ...headObjects], {
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

export function userRoughRect(left: number, top: number, w: number, h: number, fillColor: string): Group {
  const seed = positionSeed(left, top, w, h);
  const fillLight = hexToRgba(fillColor, 0.35);
  // Generate at origin so Group position is predictable
  const drawable = gen().rectangle(0, 0, w, h, {
    ...ROUGH_OPTS,
    fill: fillLight,
    seed,
  });
  const objects = drawableToFabricObjects(drawable, fillLight);
  return new Group(objects, { left, top, originX: "left", originY: "top", selectable: true, hasControls: true });
}

export function userRoughEllipse(left: number, top: number, w: number, h: number, fillColor: string): Group {
  const seed = positionSeed(left, top, w, h);
  const fillLight = hexToRgba(fillColor, 0.35);
  // Generate at origin so Group position is predictable
  const drawable = gen().ellipse(w / 2, h / 2, w, h, {
    ...ROUGH_OPTS,
    fill: fillLight,
    seed,
  });
  const objects = drawableToFabricObjects(drawable, fillLight);
  return new Group(objects, { left, top, originX: "left", originY: "top", selectable: true, hasControls: true });
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

