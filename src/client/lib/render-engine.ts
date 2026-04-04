import { Canvas, Path, FabricText, FabricObject, Group } from "fabric";
import type { DrawCommand } from "./protocol";
import { RoughArrowObject } from "./rough-line";
import {
  wobbleRect,
  wobbleCircle,
  wobbleEllipse,
  wobbleLine,
  wobbleArrow,
  STROKE_COLOR,
  FILL_COLOR,
  STROKE_WIDTH,
  FONT_FAMILY,
} from "./wobble";
import { applyColor } from "./colors";

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

// ── Connector helpers ────────────────────────────────────────────────────

/** Find the intersection of a line (from center1 to center2) with a bounding rect */
function edgePoint(cx: number, cy: number, rect: { left: number; top: number; width: number; height: number }, targetX: number, targetY: number): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = rect.width / 2;
  const hh = rect.height / 2;

  // Check intersection with each edge, pick closest
  let t = Infinity;
  if (dx !== 0) {
    const tRight = hw / Math.abs(dx);
    const tLeft = hw / Math.abs(dx);
    const tX = dx > 0 ? tRight : tLeft;
    if (Math.abs(dy * tX) <= hh) t = Math.min(t, tX);
  }
  if (dy !== 0) {
    const tBottom = hh / Math.abs(dy);
    const tTop = hh / Math.abs(dy);
    const tY = dy > 0 ? tBottom : tTop;
    if (Math.abs(dx * tY) <= hw) t = Math.min(t, tY);
  }
  if (!isFinite(t)) t = 0;
  return { x: cx + dx * t, y: cy + dy * t };
}

function findGroupById(canvas: Canvas, id: string): FabricObject | undefined {
  return canvas.getObjects().find((o) => (o as any).data?.groupId === id);
}

/** Update all connectors that reference a given group ID */
export function updateConnectorsForGroup(canvas: Canvas, groupId: string): void {
  for (const obj of canvas.getObjects()) {
    const d = (obj as any).data;
    if (d?.shapeType !== "connector") continue;
    if (d.fromId !== groupId && d.toId !== groupId) continue;

    const fromObj = findGroupById(canvas, d.fromId);
    const toObj = findGroupById(canvas, d.toId);
    if (!fromObj || !toObj) continue;

    const fromBr = fromObj.getBoundingRect();
    const toBr = toObj.getBoundingRect();
    const fromCx = fromBr.left + fromBr.width / 2;
    const fromCy = fromBr.top + fromBr.height / 2;
    const toCx = toBr.left + toBr.width / 2;
    const toCy = toBr.top + toBr.height / 2;

    const p1 = edgePoint(fromCx, fromCy, fromBr, toCx, toCy);
    const p2 = edgePoint(toCx, toCy, toBr, fromCx, fromCy);

    if (obj instanceof RoughArrowObject) {
      obj.x1 = p1.x;
      obj.y1 = p1.y;
      obj.x2 = p2.x;
      obj.y2 = p2.y;
      (obj as any)._setWidthHeight();
      obj.setCoords();
      obj.dirty = true;
    }
  }
}

// ── Render commands (standalone, supports recursion for groups) ───────────
export function renderCommandsToCanvas(
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
          fontStyle: (cmd.fontStyle ?? "normal") as "" | "normal" | "italic" | "oblique",
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
        // Remove existing group with same ID (replace semantics)
        if (cmd.id) {
          const existing = canvas.getObjects().find(
            (o) => (o as any).data?.groupId === cmd.id
          );
          if (existing) canvas.remove(existing);
        }
        // Render child commands into a temporary list (don't add to canvas yet)
        const tempCanvas = { _objects: [] as FabricObject[], add(o: FabricObject) { this._objects.push(o); } } as any as Canvas;
        const groupChildren = renderCommandsToCanvas(tempCanvas, cmd.commands);
        // Wrap in a Fabric Group
        const group = new Group(groupChildren, { selectable: true, evented: true, hasControls: false });
        group.set({ data: { layer: "claude", shapeType: "group", groupId: cmd.id } });
        canvas.add(group);
        added.push(group);
        break;
      }
      case "connector": {
        const fromObj = findGroupById(canvas, cmd.from);
        const toObj = findGroupById(canvas, cmd.to);
        if (!fromObj || !toObj) break;

        const fromBr = fromObj.getBoundingRect();
        const toBr = toObj.getBoundingRect();
        const fromCx = fromBr.left + fromBr.width / 2;
        const fromCy = fromBr.top + fromBr.height / 2;
        const toCx = toBr.left + toBr.width / 2;
        const toCy = toBr.top + toBr.height / 2;

        const p1 = edgePoint(fromCx, fromCy, fromBr, toCx, toCy);
        const p2 = edgePoint(toCx, toCy, toBr, fromCx, fromCy);

        const arrow = new RoughArrowObject([p1.x, p1.y, p2.x, p2.y], {
          strokeColor: FILL_COLOR,
          roughness: 1.5,
        });
        arrow.set({
          selectable: false,
          evented: false,
          data: { layer: "claude", shapeType: "connector", fromId: cmd.from, toId: cmd.to },
        });
        if (cmd.label) (arrow as any).data.label = cmd.label;
        canvas.add(arrow);
        added.push(arrow);
        break;
      }
    }
  }

  return added;
}
