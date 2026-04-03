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
  "#E03131", // Red
  "#2563EB", // Blue
  "#2B8A3E", // Green
  "#E8590C", // Orange
  "#7048E8", // Purple
  "#B5651D", // Brown
];

export const DEFAULT_COLOR = "#2563EB";
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
