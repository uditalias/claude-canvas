import type { DrawCommand, FillStyle, AskPayload, Question } from "../../protocol/types.js";
import type { ASTNode, Attrs, Coords, QuestionNode } from "./parser.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORIGIN_X = 50;
const ORIGIN_Y = 50;
const TEXT_CHAR_WIDTH_FACTOR = 0.6;
const TEXT_LINE_HEIGHT_FACTOR = 1.4;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_PAD = 10;
const TOP_LEVEL_GAP = 20;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Size {
  w: number;
  h: number;
}

interface PositionedNode {
  node: ASTNode;
  x: number;
  y: number;
  w: number;
  h: number;
  children?: PositionedNode[];
}

interface BoundingRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Pass 1 — Measure (bottom-up)
// ---------------------------------------------------------------------------

function measure(node: ASTNode): Size {
  switch (node.type) {
    case "box": {
      if (node.children && node.children.length > 0) {
        const pad = node.attrs.pad ?? DEFAULT_PAD;
        const childSizes = node.children.map(measure);
        const innerW = Math.max(...childSizes.map((s) => s.w));
        const innerH = childSizes.reduce((sum, s) => sum + s.h, 0);
        return { w: innerW + 2 * pad, h: innerH + 2 * pad };
      }
      return { w: node.size?.w ?? 100, h: node.size?.h ?? 100 };
    }
    case "circle":
      return { w: node.radius * 2, h: node.radius * 2 };
    case "ellipse":
      return { w: node.size.w, h: node.size.h };
    case "text": {
      const fontSize = node.attrs.size ?? DEFAULT_FONT_SIZE;
      return {
        w: node.content.length * fontSize * TEXT_CHAR_WIDTH_FACTOR,
        h: fontSize * TEXT_LINE_HEIGHT_FACTOR,
      };
    }
    case "row": {
      const childSizes = node.children.map(measure);
      const w = childSizes.reduce((sum, s) => sum + s.w, 0) + Math.max(0, childSizes.length - 1) * node.gap;
      const h = Math.max(...childSizes.map((s) => s.h), 0);
      return { w, h };
    }
    case "stack": {
      const childSizes = node.children.map(measure);
      const w = Math.max(...childSizes.map((s) => s.w), 0);
      const h = childSizes.reduce((sum, s) => sum + s.h, 0) + Math.max(0, childSizes.length - 1) * node.gap;
      return { w, h };
    }
    case "group": {
      const childSizes = node.children.map(measure);
      const w = Math.max(...childSizes.map((s) => s.w), 0);
      const h = childSizes.reduce((sum, s) => sum + s.h, 0);
      return { w, h };
    }
    case "line":
    case "arrow":
    case "connector":
    case "narration":
    case "animate":
      return { w: 0, h: 0 };
    case "ask":
      return { w: 0, h: 0 };
  }
}

// ---------------------------------------------------------------------------
// Pass 2 — Position (top-down)
// ---------------------------------------------------------------------------

function positionNodes(nodes: ASTNode[], x: number, y: number, asStack: boolean, gap: number): PositionedNode[] {
  const result: PositionedNode[] = [];
  const sizes = nodes.map(measure);

  if (asStack) {
    const stackW = Math.max(...sizes.map((s) => s.w), 0);
    let curY = y;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const size = sizes[i];
      // Zero-size nodes (arrows, connectors) don't consume space
      if (size.w === 0 && size.h === 0) {
        result.push(positionSingle(node, x, curY, size));
        continue;
      }
      const childX = x + (stackW - size.w) / 2;
      result.push(positionSingle(node, childX, curY, size));
      curY += size.h + gap;
    }
  } else {
    // Row
    const rowH = Math.max(...sizes.map((s) => s.h), 0);
    let curX = x;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const size = sizes[i];
      if (size.w === 0 && size.h === 0) {
        result.push(positionSingle(node, curX, y, size));
        continue;
      }
      const childY = y + (rowH - size.h) / 2;
      result.push(positionSingle(node, curX, childY, size));
      curX += size.w + gap;
    }
  }

  return result;
}

function positionSingle(node: ASTNode, x: number, y: number, size: Size): PositionedNode {
  switch (node.type) {
    case "box": {
      if (node.children && node.children.length > 0) {
        const pad = node.attrs.pad ?? DEFAULT_PAD;
        const children = positionNodes(node.children, x + pad, y + pad, true, 0);
        return { node, x, y, w: size.w, h: size.h, children };
      }
      return { node, x, y, w: size.w, h: size.h };
    }
    case "row":
      return {
        node,
        x,
        y,
        w: size.w,
        h: size.h,
        children: positionNodes(node.children, x, y, false, node.gap),
      };
    case "stack":
      return {
        node,
        x,
        y,
        w: size.w,
        h: size.h,
        children: positionNodes(node.children, x, y, true, node.gap),
      };
    case "group":
      return {
        node,
        x,
        y,
        w: size.w,
        h: size.h,
        children: positionNodes(node.children, x, y, true, 0),
      };
    default:
      return { node, x, y, w: size.w, h: size.h };
  }
}

// ---------------------------------------------------------------------------
// Pass 3 — Flatten to DrawCommand[]
// ---------------------------------------------------------------------------

function buildLabelMap(positioned: PositionedNode[], map: Map<string, BoundingRect>): void {
  for (const p of positioned) {
    const n = p.node;
    if ((n.type === "box" || n.type === "circle" || n.type === "ellipse") && n.label) {
      map.set(n.label, { x: p.x, y: p.y, w: p.w, h: p.h });
    }
    if (p.children) {
      buildLabelMap(p.children, map);
    }
  }
}

function flatten(positioned: PositionedNode[], labelMap: Map<string, BoundingRect>): DrawCommand[] {
  const commands: DrawCommand[] = [];
  for (const p of positioned) {
    commands.push(...flattenOne(p, labelMap));
  }
  return commands;
}

function applyShapeAttrs(cmd: Record<string, any>, attrs: Attrs): void {
  if (attrs.fill) {
    cmd.fillStyle = attrs.fill as FillStyle;
  }
  if (attrs.color) {
    cmd.color = attrs.color;
  }
  if (attrs.opacity !== undefined) {
    cmd.opacity = attrs.opacity;
  }
}

function flattenOne(p: PositionedNode, labelMap: Map<string, BoundingRect>): DrawCommand[] {
  const node = p.node;

  switch (node.type) {
    case "box": {
      const cmd: any = { type: "rect", x: p.x, y: p.y, width: p.w, height: p.h };
      if (node.label) cmd.label = node.label;
      applyShapeAttrs(cmd, node.attrs);
      const result: DrawCommand[] = [cmd];
      if (p.children) {
        result.push(...flatten(p.children, labelMap));
      }
      return result;
    }
    case "circle": {
      const cmd: any = {
        type: "circle",
        x: p.x + node.radius,
        y: p.y + node.radius,
        radius: node.radius,
      };
      if (node.label) cmd.label = node.label;
      applyShapeAttrs(cmd, node.attrs);
      return [cmd];
    }
    case "ellipse": {
      const cmd: any = {
        type: "ellipse",
        x: p.x + p.w / 2,
        y: p.y + p.h / 2,
        width: node.size.w,
        height: node.size.h,
      };
      if (node.label) cmd.label = node.label;
      applyShapeAttrs(cmd, node.attrs);
      return [cmd];
    }
    case "text": {
      const fontSize = node.attrs.size ?? DEFAULT_FONT_SIZE;
      const cmd: any = {
        type: "text",
        x: p.x,
        y: p.y,
        content: node.content,
        fontSize,
      };
      if (node.attrs.align === "center") {
        cmd.textAlign = "center";
        cmd.x = p.x + p.w / 2;
      } else if (node.attrs.align) {
        cmd.textAlign = node.attrs.align;
      }
      if (node.attrs.weight) cmd.fontWeight = node.attrs.weight;
      if (node.attrs.style) cmd.fontStyle = node.attrs.style;
      if (node.attrs.color) cmd.color = node.attrs.color;
      if (node.attrs.opacity !== undefined) cmd.opacity = node.attrs.opacity;
      return [cmd];
    }
    case "arrow":
    case "line": {
      if (isCoords(node.from) && isCoords(node.to)) {
        const cmd: any = {
          type: node.type,
          x1: (node.from as Coords).x,
          y1: (node.from as Coords).y,
          x2: (node.to as Coords).x,
          y2: (node.to as Coords).y,
        };
        if (node.label) cmd.label = node.label;
        applyShapeAttrs(cmd, node.attrs);
        return [cmd];
      }
      // Label-based — resolve in pass 4
      return [resolveArrow(node, labelMap)];
    }
    case "connector": {
      const cmd: any = { type: "connector", from: node.fromId, to: node.toId };
      if (node.label) cmd.label = node.label;
      return [cmd];
    }
    case "group": {
      const children = p.children ? flatten(p.children, labelMap) : [];
      return [{ type: "group", id: node.id, commands: children }];
    }
    case "row":
    case "stack": {
      return p.children ? flatten(p.children, labelMap) : [];
    }
    case "narration":
    case "animate":
    case "ask":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Pass 4 — Resolve label-based arrows
// ---------------------------------------------------------------------------

function isCoords(v: Coords | string): v is Coords {
  return typeof v === "object" && "x" in v && "y" in v;
}

function resolveArrow(
  node: Extract<ASTNode, { type: "arrow" | "line" }>,
  labelMap: Map<string, BoundingRect>,
): DrawCommand {
  const fromLabel = node.from as string;
  const toLabel = node.to as string;

  const fromRect = labelMap.get(fromLabel);
  if (!fromRect) {
    throw new Error(`DSL layout error: arrow references unknown label "${fromLabel}"`);
  }
  const toRect = labelMap.get(toLabel);
  if (!toRect) {
    throw new Error(`DSL layout error: arrow references unknown label "${toLabel}"`);
  }

  const fromCx = fromRect.x + fromRect.w / 2;
  const fromCy = fromRect.y + fromRect.h / 2;
  const toCx = toRect.x + toRect.w / 2;
  const toCy = toRect.y + toRect.h / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  const fromEdge = rectEdgeIntersection(fromRect, dx, dy);
  const toEdge = rectEdgeIntersection(toRect, -dx, -dy);

  const cmd: any = {
    type: node.type,
    x1: fromEdge.x,
    y1: fromEdge.y,
    x2: toEdge.x,
    y2: toEdge.y,
  };
  if (node.label) cmd.label = node.label;
  return cmd;
}

function rectEdgeIntersection(rect: BoundingRect, dx: number, dy: number): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = rect.w / 2;
  const hh = rect.h / 2;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Compute t for each edge
  let t = Infinity;

  if (dx !== 0) {
    const tRight = hw / Math.abs(dx);
    if (tRight < t) t = tRight;
  }
  if (dy !== 0) {
    const tBottom = hh / Math.abs(dy);
    if (tBottom < t) t = tBottom;
  }

  return { x: cx + dx * t, y: cy + dy * t };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layout(nodes: ASTNode[]): DrawCommand[] {
  const positioned = positionNodes(nodes, ORIGIN_X, ORIGIN_Y, true, TOP_LEVEL_GAP);
  const labelMap = new Map<string, BoundingRect>();
  buildLabelMap(positioned, labelMap);
  return flatten(positioned, labelMap);
}

export function layoutAsk(askNode: ASTNode): AskPayload {
  if (askNode.type !== "ask") {
    throw new Error("layoutAsk expects an ask node");
  }
  const questions: Question[] = askNode.questions.map((q: QuestionNode) => {
    const question: Question = {
      id: q.id,
      text: q.text,
      type: q.qtype as Question["type"],
    };
    if (q.options) {
      question.options = q.options;
    }
    if (q.children && q.children.length > 0) {
      question.commands = layout(q.children);
    }
    return question;
  });
  return { questions };
}
