import { describe, it, expect } from "vitest";
import type { DrawPayload, DrawCommand } from "../src/protocol/types.js";

describe("DrawPayload", () => {
  it("accepts a rect command", () => {
    const payload: DrawPayload = {
      commands: [{ type: "rect", x: 10, y: 20, width: 100, height: 50, label: "Box" }],
    };
    expect(payload.commands).toHaveLength(1);
    expect(payload.commands[0].type).toBe("rect");
  });

  it("accepts an arrow command", () => {
    const cmd: DrawCommand = { type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(cmd.type).toBe("arrow");
  });

  it("accepts a text command", () => {
    const cmd: DrawCommand = { type: "text", x: 50, y: 50, content: "Hello", fontSize: 18 };
    expect(cmd.type).toBe("text");
  });

  it("supports optional narration", () => {
    const payload: DrawPayload = {
      narration: "Drawing a box",
      commands: [{ type: "circle", x: 100, y: 100, radius: 40 }],
    };
    expect(payload.narration).toBe("Drawing a box");
  });
});
