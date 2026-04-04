export type DrawCommand =
  | { type: "rect"; x: number; y: number; width: number; height: number; label?: string; fill?: boolean }
  | { type: "circle"; x: number; y: number; radius: number; label?: string; fill?: boolean }
  | { type: "ellipse"; x: number; y: number; width: number; height: number; label?: string; fill?: boolean }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: "text"; x: number; y: number; content: string; fontSize?: number; textAlign?: "left" | "center" | "right" }
  | { type: "freehand"; points: [number, number][] }
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
  format: "svg" | "png";
  labels: boolean;
}

export interface WsMessage {
  type: "draw" | "screenshot_request" | "screenshot_response" | "clear" | "ask" | "export_request" | "export_response";
  payload?: DrawPayload | string | ScreenshotResponsePayload | AskPayload | ExportRequestPayload | null;
}
