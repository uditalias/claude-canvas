import { Line, Control, Point, controlsUtils } from "fabric";
import type { RoughGenerator } from "roughjs/bin/generator";

// ── Lazy-init rough.js generator (shared with wobble.ts) ───────────────────
let _generatorSync: RoughGenerator | null = null;

export async function initRoughLineGenerator(): Promise<void> {
  const rough = await import("roughjs/bin/rough");
  _generatorSync = rough.default.generator();
}

function gen(): RoughGenerator {
  if (!_generatorSync) throw new Error("Call initRoughLineGenerator() first");
  return _generatorSync;
}

function positionSeed(x: number, y: number, w: number, h: number): number {
  return Math.abs(((x * 73856093) ^ (y * 19349663) ^ (w * 83492791) ^ (h * 44867)) | 0) % 2147483647 || 1;
}

// ── Endpoint controls ──────────────────────────────────────────────────────

function getAbsoluteEndpoints(line: RoughLineObject | RoughArrowObject) {
  const pts = line.calcLinePoints();
  const matrix = line.calcOwnMatrix();
  return {
    p1: new Point(pts.x1, pts.y1).transform(matrix),
    p2: new Point(pts.x2, pts.y2).transform(matrix),
  };
}

function makeEndpointControls() {
  return {
    p1: new Control({
      x: 0,
      y: 0,
      cursorStyle: "move",
      render: controlsUtils.renderCircleControl,
      positionHandler(_dim, finalMatrix, fabricObject) {
        const line = fabricObject as RoughLineObject;
        const pts = line.calcLinePoints();
        return new Point(pts.x1, pts.y1).transform(finalMatrix);
      },
      actionHandler(eventData, transform, _x, _y) {
        const line = transform.target as RoughLineObject;
        const canvas = line.canvas;
        if (!canvas) return false;
        const newP1 = canvas.getScenePoint(eventData as MouseEvent);
        const { p2: absP2 } = getAbsoluteEndpoints(line);
        line.x1 = newP1.x;
        line.y1 = newP1.y;
        line.x2 = absP2.x;
        line.y2 = absP2.y;
        (line as any)._setWidthHeight();
        line.setCoords();
        line.dirty = true;
        return true;
      },
    }),
    p2: new Control({
      x: 0,
      y: 0,
      cursorStyle: "move",
      render: controlsUtils.renderCircleControl,
      positionHandler(_dim, finalMatrix, fabricObject) {
        const line = fabricObject as RoughLineObject;
        const pts = line.calcLinePoints();
        return new Point(pts.x2, pts.y2).transform(finalMatrix);
      },
      actionHandler(eventData, transform, _x, _y) {
        const line = transform.target as RoughLineObject;
        const canvas = line.canvas;
        if (!canvas) return false;
        const newP2 = canvas.getScenePoint(eventData as MouseEvent);
        const { p1: absP1 } = getAbsoluteEndpoints(line);
        line.x1 = absP1.x;
        line.y1 = absP1.y;
        line.x2 = newP2.x;
        line.y2 = newP2.y;
        (line as any)._setWidthHeight();
        line.setCoords();
        line.dirty = true;
        return true;
      },
    }),
  };
}

// ── Convert rough ops to canvas draw calls ─────────────────────────────────

interface Op {
  op: string;
  data: number[];
}

function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  ctx.beginPath();
  for (const op of ops) {
    switch (op.op) {
      case "move":
        ctx.moveTo(op.data[0], op.data[1]);
        break;
      case "lineTo":
        ctx.lineTo(op.data[0], op.data[1]);
        break;
      case "bcurveTo":
        ctx.bezierCurveTo(op.data[0], op.data[1], op.data[2], op.data[3], op.data[4], op.data[5]);
        break;
    }
  }
  ctx.stroke();
}

function opsToSvgPath(ops: Op[]): string {
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

// ── RoughLineObject ────────────────────────────────────────────────────────

export class RoughLineObject extends Line {
  declare strokeColor: string;
  declare roughness: number;
  declare seed: number;

  constructor(
    points: [number, number, number, number],
    options: {
      strokeColor?: string;
      roughness?: number;
      seed?: number;
      [key: string]: any;
    } = {}
  ) {
    super(points, {
      ...options,
      stroke: "transparent",
      strokeWidth: 10,
      objectCaching: false, // prevent clipping of rough.js wobble
    });
    this.strokeColor = options.strokeColor ?? "#000000";
    this.roughness = options.roughness ?? 1.5;
    this.seed = options.seed ?? positionSeed(points[0], points[1], points[2], points[3]);
    this.controls = makeEndpointControls();
    this.hasBorders = false;
  }

  _render(ctx: CanvasRenderingContext2D) {
    const pts = this.calcLinePoints();
    const drawable = gen().line(pts.x1, pts.y1, pts.x2, pts.y2, {
      roughness: this.roughness,
      stroke: this.strokeColor,
      strokeWidth: 1.5,
      seed: this.seed,
    });

    ctx.save();
    for (const opSet of drawable.sets) {
      if (opSet.type === "path") {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = 1.5;
        drawOps(ctx, opSet.ops as Op[]);
      }
    }
    ctx.restore();
  }

  // @ts-expect-error — Fabric v7 generic constraint is too narrow for custom properties
  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([
      ...propertiesToInclude,
      "strokeColor",
      "roughness",
      "seed",
    ] as any);
  }

  toSVG(): string {
    const pts = this.calcLinePoints();
    const drawable = gen().line(pts.x1, pts.y1, pts.x2, pts.y2, {
      roughness: this.roughness,
      stroke: this.strokeColor,
      strokeWidth: 1.5,
      seed: this.seed,
    });
    let paths = "";
    for (const opSet of drawable.sets) {
      if (opSet.type === "path") {
        const d = opsToSvgPath(opSet.ops as Op[]);
        paths += `<path d="${d}" stroke="${this.strokeColor}" stroke-width="1.5" fill="none" />`;
      }
    }
    const matrix = this.calcOwnMatrix();
    return `<g transform="matrix(${matrix.join(" ")})">${paths}</g>`;
  }
}

// ── RoughArrowObject ───────────────────────────────────────────────────────

export class RoughArrowObject extends Line {
  declare strokeColor: string;
  declare roughness: number;
  declare seed: number;

  constructor(
    points: [number, number, number, number],
    options: {
      strokeColor?: string;
      roughness?: number;
      seed?: number;
      [key: string]: any;
    } = {}
  ) {
    super(points, {
      ...options,
      stroke: "transparent",
      strokeWidth: 10,
      objectCaching: false,
    });
    this.strokeColor = options.strokeColor ?? "#000000";
    this.roughness = options.roughness ?? 1.5;
    this.seed = options.seed ?? positionSeed(points[0], points[1], points[2], points[3]);
    this.controls = makeEndpointControls();
    this.hasBorders = false;
  }

  _render(ctx: CanvasRenderingContext2D) {
    const pts = this.calcLinePoints();

    const lineDrawable = gen().line(pts.x1, pts.y1, pts.x2, pts.y2, {
      roughness: this.roughness,
      stroke: this.strokeColor,
      strokeWidth: 1.5,
      seed: this.seed,
    });

    ctx.save();
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = 1.5;

    for (const opSet of lineDrawable.sets) {
      if (opSet.type === "path") {
        drawOps(ctx, opSet.ops as Op[]);
      }
    }

    // Draw arrowhead
    const dx = pts.x2 - pts.x1;
    const dy = pts.y2 - pts.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const headLen = 14;
    const headWidth = 7;

    const ax = pts.x2 - ux * headLen + (-uy) * headWidth;
    const ay = pts.y2 - uy * headLen + ux * headWidth;
    const bx = pts.x2 - ux * headLen + uy * headWidth;
    const by = pts.y2 - uy * headLen + (-ux) * headWidth;

    const h1 = gen().linearPath(
      [[pts.x2, pts.y2], [ax, ay]],
      { roughness: this.roughness, stroke: this.strokeColor, strokeWidth: 1.5, seed: this.seed + 1 }
    );
    const h2 = gen().linearPath(
      [[pts.x2, pts.y2], [bx, by]],
      { roughness: this.roughness, stroke: this.strokeColor, strokeWidth: 1.5, seed: this.seed + 2 }
    );

    for (const opSet of h1.sets) {
      if (opSet.type === "path") drawOps(ctx, opSet.ops as Op[]);
    }
    for (const opSet of h2.sets) {
      if (opSet.type === "path") drawOps(ctx, opSet.ops as Op[]);
    }

    ctx.restore();
  }

  // @ts-expect-error — Fabric v7 generic constraint is too narrow for custom properties
  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([
      ...propertiesToInclude,
      "strokeColor",
      "roughness",
      "seed",
    ] as any);
  }

  toSVG(): string {
    const pts = this.calcLinePoints();
    const lineDrawable = gen().line(pts.x1, pts.y1, pts.x2, pts.y2, {
      roughness: this.roughness,
      stroke: this.strokeColor,
      strokeWidth: 1.5,
      seed: this.seed,
    });
    let paths = "";
    for (const opSet of lineDrawable.sets) {
      if (opSet.type === "path") {
        const d = opsToSvgPath(opSet.ops as Op[]);
        paths += `<path d="${d}" stroke="${this.strokeColor}" stroke-width="1.5" fill="none" />`;
      }
    }
    const dx = pts.x2 - pts.x1;
    const dy = pts.y2 - pts.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const headLen = 14;
    const headWidth = 7;
    const ax = pts.x2 - ux * headLen + (-uy) * headWidth;
    const ay = pts.y2 - uy * headLen + ux * headWidth;
    const bx = pts.x2 - ux * headLen + uy * headWidth;
    const by = pts.y2 - uy * headLen + (-ux) * headWidth;
    const h1 = gen().linearPath([[pts.x2, pts.y2], [ax, ay]], { roughness: this.roughness, stroke: this.strokeColor, strokeWidth: 1.5, seed: this.seed + 1 });
    const h2 = gen().linearPath([[pts.x2, pts.y2], [bx, by]], { roughness: this.roughness, stroke: this.strokeColor, strokeWidth: 1.5, seed: this.seed + 2 });
    for (const opSet of h1.sets) {
      if (opSet.type === "path") {
        const d = opsToSvgPath(opSet.ops as Op[]);
        paths += `<path d="${d}" stroke="${this.strokeColor}" stroke-width="1.5" fill="none" />`;
      }
    }
    for (const opSet of h2.sets) {
      if (opSet.type === "path") {
        const d = opsToSvgPath(opSet.ops as Op[]);
        paths += `<path d="${d}" stroke="${this.strokeColor}" stroke-width="1.5" fill="none" />`;
      }
    }
    const matrix = this.calcOwnMatrix();
    return `<g transform="matrix(${matrix.join(" ")})">${paths}</g>`;
  }
}
