import { describe, it, expect } from "vitest";
import { parseDSL } from "../../src/bin/dsl/index.js";
import type { DrawPayload, AskPayload } from "../../src/protocol/types.js";

function isDrawPayload(p: DrawPayload | AskPayload): p is DrawPayload {
  return "commands" in p;
}

function isAskPayload(p: DrawPayload | AskPayload): p is AskPayload {
  return "questions" in p;
}

describe("parseDSL – draw payloads", () => {
  it("simple box → valid DrawPayload with 1 rect command", () => {
    const result = parseDSL(`box "Hello" 200x150`);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;
    expect(dp.commands).toHaveLength(1);
    expect(dp.commands[0].type).toBe("rect");
    const rect = dp.commands[0] as any;
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(150);
    expect(rect.label).toBe("Hello");
  });

  it("with narration → DrawPayload has narration field", () => {
    const result = parseDSL(`
      narration "Here is a box"
      box "A" 100x100
    `);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;
    expect(dp.narration).toBe("Here is a box");
    expect(dp.commands).toHaveLength(1);
  });

  it("with animate=false → DrawPayload has animate: false", () => {
    const result = parseDSL(`
      animate=false
      box "A" 100x100
    `);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;
    expect(dp.animate).toBe(false);
  });

  it("row of 3 boxes → correct x positions", () => {
    const result = parseDSL(`
      row gap=20 {
        box "A" 100x100
        box "B" 100x100
        box "C" 100x100
      }
    `);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;
    expect(dp.commands).toHaveLength(3);

    const xs = dp.commands.map((c: any) => c.x);
    // ORIGIN_X=50, gap=20, width=100 → 50, 170, 290
    expect(xs).toEqual([50, 170, 290]);
  });

  it("flowchart with groups + connectors → valid group and connector commands", () => {
    const result = parseDSL(`
      group #start {
        box "Start" 120x60
      }
      group #end {
        box "End" 120x60
      }
      #start -> #end "next"
    `);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;

    const groups = dp.commands.filter((c) => c.type === "group");
    expect(groups).toHaveLength(2);

    const connectors = dp.commands.filter((c) => c.type === "connector");
    expect(connectors).toHaveLength(1);
    const conn = connectors[0] as any;
    expect(conn.from).toBe("start");
    expect(conn.to).toBe("end");
    expect(conn.label).toBe("next");
  });
});

describe("parseDSL – ask payloads", () => {
  it("single question → valid AskPayload with question id, type, text, options", () => {
    const result = parseDSL(`
      ask {
        question #q1 single "Which color?" {
          options "Red" | "Blue" | "Green"
        }
      }
    `);
    expect(isAskPayload(result)).toBe(true);
    const ap = result as AskPayload;
    expect(ap.questions).toHaveLength(1);
    expect(ap.questions[0].id).toBe("q1");
    expect(ap.questions[0].type).toBe("single");
    expect(ap.questions[0].text).toBe("Which color?");
    expect(ap.questions[0].options).toEqual(["Red", "Blue", "Green"]);
  });

  it("question without visuals → commands is undefined", () => {
    const result = parseDSL(`
      ask {
        question #q1 text "What is your name?"
      }
    `);
    expect(isAskPayload(result)).toBe(true);
    const ap = result as AskPayload;
    expect(ap.questions[0].commands).toBeUndefined();
  });

  it("multiple questions → 3 questions with correct types", () => {
    const result = parseDSL(`
      ask {
        question #q1 single "Pick one?" {
          options "A" | "B"
        }
        question #q2 text "Enter name?"
        question #q3 multi "Select many?" {
          options "X" | "Y" | "Z"
        }
      }
    `);
    expect(isAskPayload(result)).toBe(true);
    const ap = result as AskPayload;
    expect(ap.questions).toHaveLength(3);
    expect(ap.questions[0].type).toBe("single");
    expect(ap.questions[1].type).toBe("text");
    expect(ap.questions[2].type).toBe("multi");
  });

  it("question with draw commands → commands array has positioned shapes", () => {
    const result = parseDSL(`
      ask {
        question #q1 single "Which layout?" {
          options "A" | "B"
          row gap=20 {
            box "Layout A" 200x150
            box "Layout B" 200x150
          }
        }
      }
    `);
    expect(isAskPayload(result)).toBe(true);
    const ap = result as AskPayload;
    expect(ap.questions[0].commands).toBeDefined();
    expect(ap.questions[0].commands!.length).toBeGreaterThanOrEqual(2);
    // All commands should have valid coordinates
    for (const cmd of ap.questions[0].commands!) {
      if ("x" in cmd) {
        expect((cmd as any).x).toBeGreaterThanOrEqual(0);
      }
      if ("y" in cmd) {
        expect((cmd as any).y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("parseDSL – complex real-world", () => {
  it("dashboard layout comparison (nested stacks/rows/boxes) → all commands have valid positive coordinates", () => {
    const result = parseDSL(`
      stack gap=20 {
        text "Dashboard Layouts" size=24 align=center
        row gap=30 {
          stack gap=10 {
            box "Header" 300x50
            row gap=10 {
              box "Sidebar" 80x200
              box "Content" 210x200
            }
            box "Footer" 300x50
          }
          stack gap=10 {
            box "Header" 300x50
            box "Content" 300x200
            box "Footer" 300x50
          }
        }
      }
    `);
    expect(isDrawPayload(result)).toBe(true);
    const dp = result as DrawPayload;
    expect(dp.commands.length).toBeGreaterThan(0);

    for (const cmd of dp.commands) {
      if ("x" in cmd) {
        expect((cmd as any).x).toBeGreaterThanOrEqual(0);
      }
      if ("y" in cmd) {
        expect((cmd as any).y).toBeGreaterThanOrEqual(0);
      }
      if ("width" in cmd) {
        expect((cmd as any).width).toBeGreaterThan(0);
      }
      if ("height" in cmd) {
        expect((cmd as any).height).toBeGreaterThan(0);
      }
    }
  });
});
