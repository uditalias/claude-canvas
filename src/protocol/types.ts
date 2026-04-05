/** Common visual properties shared across shape commands */
interface ShapeStyle {
  color?: string;
  opacity?: number;
}

export type FillStyle = "hachure" | "solid" | "zigzag" | "cross-hatch" | "dots" | "dashed" | "zigzag-line" | "none";

export type DrawCommand =
  | { type: "rect"; x: number; y: number; width: number; height: number; label?: string; fill?: boolean; fillStyle?: FillStyle } & ShapeStyle
  | { type: "circle"; x: number; y: number; radius: number; label?: string; fill?: boolean; fillStyle?: FillStyle } & ShapeStyle
  | { type: "ellipse"; x: number; y: number; width: number; height: number; label?: string; fill?: boolean; fillStyle?: FillStyle } & ShapeStyle
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; label?: string } & ShapeStyle
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; label?: string } & ShapeStyle
  | { type: "text"; x: number; y: number; content: string; fontSize?: number; textAlign?: "left" | "center" | "right"; fontWeight?: string; fontStyle?: string; underline?: boolean; linethrough?: boolean } & ShapeStyle
  | { type: "freehand"; points: [number, number][] } & ShapeStyle
  | { type: "group"; id: string; commands: DrawCommand[] }
  | { type: "connector"; from: string; to: string; label?: string };

export interface Question {
  id: string;
  text: string;
  type: "single" | "multi" | "text" | "canvas";
  options?: string[];
  commands?: DrawCommand[];
}

export interface AskPayload {
  questions: Question[];
}

export interface Answer {
  questionId: string;
  value: string | string[];
  canvasSnapshot?: string;
}

export interface ScreenshotResponsePayload {
  image: string;
  answers: Answer[];
}

export interface DrawPayload {
  narration?: string;
  animate?: boolean;
  commands: DrawCommand[];
}

export interface ExportRequestPayload {
  format: "svg" | "png" | "json";
  labels: boolean;
}

export interface WsMessage {
  type: "draw" | "screenshot_request" | "screenshot_response" | "clear" | "ask" | "export_request" | "export_response" | "answers_submitted" | "status";
  payload?: DrawPayload | string | ScreenshotResponsePayload | AskPayload | ExportRequestPayload | null;
}
