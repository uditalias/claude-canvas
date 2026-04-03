import { useState, useCallback } from "react";

export type ToolType =
  | "pointer"
  | "hand"
  | "pencil"
  | "marker"
  | "rect"
  | "circle"
  | "arrow"
  | "line"
  | "text"
  | "paint";

export const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "pointer",
  h: "hand",
  p: "pencil",
  m: "marker",
  r: "rect",
  c: "circle",
  a: "arrow",
  l: "line",
  t: "text",
  b: "paint",
};

export const COLOR_PRESETS = [
  "#000000", // Black
  "#555555", // Dark Gray
  "#D4726A", // Red
  "#D9925E", // Orange
  "#C4A73A", // Yellow
  "#8AAD5A", // Green
  "#6DBDAD", // Cyan
  "#7198C9", // Blue
  "#9B85B5", // Purple
  "#D47C9A", // Magenta
];

export const DEFAULT_COLOR = "#7198C9";
export const DEFAULT_BRUSH_SIZE = 2;

export function useToolState() {
  const [activeTool, setActiveTool] = useState<ToolType>("pointer");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

  const selectTool = useCallback((tool: ToolType) => {
    setActiveTool(tool);
  }, []);

  return {
    activeTool,
    selectTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
  };
}

export type ToolState = ReturnType<typeof useToolState>;
