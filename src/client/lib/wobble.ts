import { Path, FabricText, Group } from "fabric";

// ── Constants ───────────────────────────────────────────────────────────────
export const STROKE_COLOR = "#B5651D";
export const STROKE_WIDTH = 2;
export const FONT_FAMILY = "Patrick Hand, cursive";

// ── Deterministic pseudo-random (seeded) ────────────────────────────────────
function seededRand(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function positionHash(x: number, y: number, w: number, h: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (w * 83492791) ^ (h * 44867)) | 0;
}

// ── Wobble shapes ───────────────────────────────────────────────────────────

export function wobbleRect(x: number, y: number, w: number, h: number): Path {
  const rand = seededRand(positionHash(x, y, w, h));
  const jitter = () => (rand() - 0.5) * 4;

  const tl = { x: x + jitter(), y: y + jitter() };
  const tr = { x: x + w + jitter(), y: y + jitter() };
  const br = { x: x + w + jitter(), y: y + h + jitter() };
  const bl = { x: x + jitter(), y: y + h + jitter() };

  const topMid = { x: (tl.x + tr.x) / 2 + jitter(), y: (tl.y + tr.y) / 2 + jitter() };
  const rightMid = { x: (tr.x + br.x) / 2 + jitter(), y: (tr.y + br.y) / 2 + jitter() };
  const botMid = { x: (br.x + bl.x) / 2 + jitter(), y: (br.y + bl.y) / 2 + jitter() };
  const leftMid = { x: (bl.x + tl.x) / 2 + jitter(), y: (bl.y + tl.y) / 2 + jitter() };

  const d = [
    `M ${tl.x} ${tl.y}`,
    `Q ${topMid.x} ${topMid.y} ${tr.x} ${tr.y}`,
    `Q ${rightMid.x} ${rightMid.y} ${br.x} ${br.y}`,
    `Q ${botMid.x} ${botMid.y} ${bl.x} ${bl.y}`,
    `Q ${leftMid.x} ${leftMid.y} ${tl.x} ${tl.y}`,
    "Z",
  ].join(" ");

  return new Path(d, {
    stroke: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
    fill: "rgba(255,255,255,0.05)",
    selectable: true,
    hasControls: false,
  });
}

export function wobbleCircle(cx: number, cy: number, r: number): Path {
  const rand = seededRand(positionHash(cx, cy, r, r));
  const points = 40;
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = 1 + (rand() - 0.5) * 0.12;
    const px = cx + r * jitter * Math.cos(angle);
    const py = cy + r * jitter * Math.sin(angle);
    pts.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
  }
  pts.push("Z");

  return new Path(pts.join(" "), {
    stroke: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
    fill: "rgba(255,255,255,0.05)",
    selectable: true,
    hasControls: false,
  });
}

export function wobbleEllipse(cx: number, cy: number, rx: number, ry: number): Path {
  const rand = seededRand(positionHash(cx, cy, rx, ry));
  const points = 40;
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = 1 + (rand() - 0.5) * 0.12;
    const px = cx + rx * jitter * Math.cos(angle);
    const py = cy + ry * jitter * Math.sin(angle);
    pts.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
  }
  pts.push("Z");

  return new Path(pts.join(" "), {
    stroke: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
    fill: "rgba(255,255,255,0.05)",
    selectable: true,
    hasControls: false,
  });
}

export function wobbleLine(x1: number, y1: number, x2: number, y2: number): Path {
  const rand = seededRand(positionHash(x1, y1, x2, y2));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;

  const numMid = 3;
  const pts: string[] = [`M ${x1} ${y1}`];
  for (let i = 1; i <= numMid; i++) {
    const t = i / (numMid + 1);
    const jitter = (rand() - 0.5) * Math.min(len * 0.04, 6);
    pts.push(`L ${x1 + dx * t + nx * jitter} ${y1 + dy * t + ny * jitter}`);
  }
  pts.push(`L ${x2} ${y2}`);

  return new Path(pts.join(" "), {
    stroke: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
    fill: "transparent",
    selectable: true,
    hasControls: false,
  });
}

export function wobbleArrow(x1: number, y1: number, x2: number, y2: number): Group {
  const line = wobbleLine(x1, y1, x2, y2);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 12;
  const headWidth = 6;

  const ax = x2 - ux * headLen + (-uy) * headWidth;
  const ay = y2 - uy * headLen + ux * headWidth;
  const bx = x2 - ux * headLen + uy * headWidth;
  const by = y2 - uy * headLen + (-ux) * headWidth;

  const headPath = new Path(`M ${x2} ${y2} L ${ax} ${ay} L ${bx} ${by} Z`, {
    stroke: STROKE_COLOR,
    strokeWidth: 1,
    fill: STROKE_COLOR,
    selectable: false,
  });

  return new Group([line, headPath], {
    selectable: true,
    hasControls: false,
  });
}

export function makeLabel(text: string, x: number, y: number): FabricText {
  return new FabricText(text, {
    left: x,
    top: y,
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    fill: STROKE_COLOR,
    selectable: false,
    hasControls: false,
  });
}
