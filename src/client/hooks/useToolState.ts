import { useState, useCallback } from "react";

export type ToolType =
  | "pointer"
  | "pencil"
  | "marker"
  | "rect"
  | "circle"
  | "arrow"
  | "line"
  | "text";

export const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "pointer",
  p: "pencil",
  m: "marker",
  r: "rect",
  c: "circle",
  a: "arrow",
  l: "line",
  t: "text",
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
