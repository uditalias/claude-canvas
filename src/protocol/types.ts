export type DrawCommand =
  | { type: "rect"; x: number; y: number; width: number; height: number; label?: string }
  | { type: "circle"; x: number; y: number; radius: number; label?: string }
  | { type: "ellipse"; x: number; y: number; width: number; height: number; label?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: "text"; x: number; y: number; content: string; fontSize?: number }
  | { type: "freehand"; points: [number, number][] }
  | { type: "group"; id: string; commands: DrawCommand[] }
  | { type: "connector"; from: string; to: string; label?: string };

export interface DrawPayload {
  narration?: string;
  animate?: boolean;
  commands: DrawCommand[];
}

export interface WsMessage {
  type: "draw" | "screenshot_request" | "screenshot_response" | "clear";
  payload?: DrawPayload | string | null;
}
