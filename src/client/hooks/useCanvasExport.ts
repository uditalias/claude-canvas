import { useCallback } from "react";
import { Canvas, FabricText, Path, Point, Group } from "fabric";
import type { DrawCommand } from "../lib/protocol";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";
import { getObjectColor } from "../lib/colors";

/** Add temporary FabricText labels above each labeled object. Returns the created texts so the caller can remove them after export. */
function addTempLabels(canvas: Canvas): FabricText[] {
  const tempLabels: FabricText[] = [];
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
  return tempLabels;
}

export function useCanvasExport(fabricRef: React.RefObject<Canvas | null>) {
  const exportSVG = useCallback((includeLabels = false): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    const tempLabels = includeLabels ? addTempLabels(canvas) : [];
    const svg = canvas.toSVG();
    for (const t of tempLabels) canvas.remove(t);
    return svg;
  }, []);

  const exportPNG = useCallback((includeLabels = false): string => {
    const canvas = fabricRef.current;
    if (!canvas) return "";
    const tempLabels = includeLabels ? addTempLabels(canvas) : [];
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
      } else if (shapeType === "group" && obj instanceof Group) {
        const groupId = (data as any)?.groupId as string | undefined;
        if (!groupId) continue;
        // Recursively export child objects as commands
        const childCommands: DrawCommand[] = [];
        for (const child of obj.getObjects()) {
          const childData = (child as any).data as { shapeType?: string; label?: string; fillStyle?: string; geo?: Record<string, number> } | undefined;
          const cType = childData?.shapeType;
          const cLabel = childData?.label;
          const cGeo = childData?.geo;
          if (cType === "rect" && cGeo) {
            const cmd: any = { type: "rect", x: cGeo.x, y: cGeo.y, width: cGeo.width, height: cGeo.height };
            if (cLabel) cmd.label = cLabel;
            if (childData?.fillStyle && childData.fillStyle !== "hachure") cmd.fillStyle = childData.fillStyle;
            childCommands.push(cmd);
          } else if (cType === "circle" && cGeo) {
            const cmd: any = { type: "circle", x: cGeo.x, y: cGeo.y, radius: cGeo.radius };
            if (cLabel) cmd.label = cLabel;
            childCommands.push(cmd);
          } else if (cType === "ellipse" && cGeo) {
            const cmd: any = { type: "ellipse", x: cGeo.x, y: cGeo.y, width: cGeo.width, height: cGeo.height };
            if (cLabel) cmd.label = cLabel;
            childCommands.push(cmd);
          } else if (cType === "text" && child instanceof FabricText) {
            childCommands.push({ type: "text", x: Math.round(child.left ?? 0), y: Math.round(child.top ?? 0), content: child.text ?? "", fontSize: child.fontSize ?? 16 });
          }
        }
        if (childCommands.length > 0) {
          commands.push({ type: "group", id: groupId, commands: childCommands });
        }
      } else if (shapeType === "connector") {
        const fromId = (data as any)?.fromId as string | undefined;
        const toId = (data as any)?.toId as string | undefined;
        if (fromId && toId) {
          const cmd: any = { type: "connector", from: fromId, to: toId };
          if (label) cmd.label = label;
          commands.push(cmd);
        }
      }
    }

    return JSON.stringify({ commands }, null, 2);
  }, []);

  return { exportSVG, exportPNG, exportJSON };
}
