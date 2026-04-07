import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/bin/dsl/tokenizer";
import { parse } from "../../src/bin/dsl/parser";
import { layout, layoutAsk } from "../../src/bin/dsl/layout";
import type { DrawCommand } from "../../src/protocol/types";

function dsl(input: string): DrawCommand[] {
  return layout(parse(tokenize(input)));
}

describe("layout", () => {
  describe("single shapes", () => {
    it("places a box at origin offset", () => {
      const cmds = dsl('box "Hello" 200x150');
      expect(cmds).toEqual([
        { type: "rect", x: 50, y: 50, width: 200, height: 150, label: "Hello" },
      ]);
    });

    it("places a circle at origin offset (center coords)", () => {
      const cmds = dsl('circle "Dot" 40');
      expect(cmds).toEqual([
        { type: "circle", x: 90, y: 90, radius: 40, label: "Dot" },
      ]);
    });

    it("places an ellipse at origin offset (center coords)", () => {
      const cmds = dsl('ellipse "Oval" 120x80');
      expect(cmds).toEqual([
        { type: "ellipse", x: 110, y: 90, width: 120, height: 80, label: "Oval" },
      ]);
    });

    it("places text at origin offset", () => {
      const cmds = dsl('text "Hello World"');
      expect(cmds).toEqual([
        { type: "text", x: 50, y: 50, content: "Hello World", fontSize: 16 },
      ]);
    });
  });

  describe("row layout", () => {
    it("places children left-to-right with gap", () => {
      const cmds = dsl(`
        row gap=20 {
          box "A" 100x50
          box "B" 100x50
        }
      `);
      expect(cmds).toEqual([
        { type: "rect", x: 50, y: 50, width: 100, height: 50, label: "A" },
        { type: "rect", x: 170, y: 50, width: 100, height: 50, label: "B" },
      ]);
    });

    it("vertically centers children of different heights", () => {
      const cmds = dsl(`
        row gap=20 {
          box "Tall" 100x100
          box "Short" 100x50
        }
      `);
      // Row height = 100, short box centered: y = 50 + (100 - 50) / 2 = 75
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 100, height: 100 });
      expect(cmds[1]).toMatchObject({ type: "rect", x: 170, y: 75, width: 100, height: 50 });
    });
  });

  describe("stack layout", () => {
    it("places children top-to-bottom with gap", () => {
      const cmds = dsl(`
        stack gap=10 {
          box "Top" 100x50
          box "Bot" 100x50
        }
      `);
      expect(cmds).toEqual([
        { type: "rect", x: 50, y: 50, width: 100, height: 50, label: "Top" },
        { type: "rect", x: 50, y: 110, width: 100, height: 50, label: "Bot" },
      ]);
    });

    it("horizontally centers children of different widths", () => {
      const cmds = dsl(`
        stack gap=10 {
          box "Wide" 200x50
          box "Narrow" 100x50
        }
      `);
      // Stack width = 200, narrow centered: x = 50 + (200 - 100) / 2 = 100
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 200, height: 50 });
      expect(cmds[1]).toMatchObject({ type: "rect", x: 100, y: 110, width: 100, height: 50 });
    });
  });

  describe("nested layout", () => {
    it("places a stack of rows", () => {
      const cmds = dsl(`
        stack gap=10 {
          row gap=10 {
            box "A" 80x40
            box "B" 80x40
          }
          row gap=10 {
            box "C" 80x40
            box "D" 80x40
          }
        }
      `);
      // Row width = 80 + 10 + 80 = 170, stack width = 170
      // Row 1 at y=50, Row 2 at y=50+40+10=100
      expect(cmds).toHaveLength(4);
      expect(cmds[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 80, height: 40, label: "A" });
      expect(cmds[1]).toMatchObject({ type: "rect", x: 140, y: 50, width: 80, height: 40, label: "B" });
      expect(cmds[2]).toMatchObject({ type: "rect", x: 50, y: 100, width: 80, height: 40, label: "C" });
      expect(cmds[3]).toMatchObject({ type: "rect", x: 140, y: 100, width: 80, height: 40, label: "D" });
    });
  });

  describe("container box with padding", () => {
    it("auto-sizes from children and offsets by pad", () => {
      const cmds = dsl(`
        box "Container" pad=20 {
          box "Inner" 100x50
        }
      `);
      // Inner at (50+20, 50+20) = (70, 70), size 100x50
      // Container size = 100 + 2*20 x 50 + 2*20 = 140x90
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 140, height: 90, label: "Container" });
      expect(cmds[1]).toMatchObject({ type: "rect", x: 70, y: 70, width: 100, height: 50, label: "Inner" });
    });
  });

  describe("arrows", () => {
    it("passes through absolute coords", () => {
      const cmds = dsl('arrow 10,20 -> 100,200');
      expect(cmds).toEqual([
        { type: "arrow", x1: 10, y1: 20, x2: 100, y2: 200 },
      ]);
    });

    it("resolves label-based arrows to edge coordinates", () => {
      const cmds = dsl(`
        row gap=100 {
          box "Src" 100x50
          box "Dst" 100x50
        }
        arrow "Src" -> "Dst"
      `);
      // Src at (50, 50) 100x50, center (100, 75)
      // Dst at (250, 50) 100x50, center (300, 75)
      // Arrow goes right: src edge at x=150, dst edge at x=250
      const arrow = cmds.find((c) => c.type === "arrow") as any;
      expect(arrow).toBeDefined();
      expect(arrow.x1).toBe(150); // right edge of Src
      expect(arrow.y1).toBe(75);  // center y
      expect(arrow.x2).toBe(250); // left edge of Dst
      expect(arrow.y2).toBe(75);  // center y
    });

    it("preserves label on label-based arrows", () => {
      const cmds = dsl(`
        row gap=100 {
          box "A" 100x50
          box "B" 100x50
        }
        arrow "A" -> "B" "connects"
      `);
      const arrow = cmds.find((c) => c.type === "arrow") as any;
      expect(arrow.label).toBe("connects");
    });

    it("throws on unknown label reference", () => {
      expect(() =>
        dsl('arrow "Missing" -> "Also Missing"')
      ).toThrow(/unknown label/);
    });
  });

  describe("lines", () => {
    it("passes through absolute coords for lines", () => {
      const cmds = dsl("line 0,0 -> 100,100");
      expect(cmds).toEqual([
        { type: "line", x1: 0, y1: 0, x2: 100, y2: 100 },
      ]);
    });
  });

  describe("groups and connectors", () => {
    it("outputs group command wrapping children", () => {
      const cmds = dsl(`
        group #g1 {
          box "Inside" 100x50
        }
      `);
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({
        type: "group",
        id: "g1",
        commands: [{ type: "rect", x: 50, y: 50, width: 100, height: 50, label: "Inside" }],
      });
    });

    it("passes connector through", () => {
      const cmds = dsl('#a -> #b "link"');
      expect(cmds).toEqual([
        { type: "connector", from: "a", to: "b", label: "link" },
      ]);
    });
  });

  describe("shape attributes", () => {
    it("maps fill style, color, and opacity to output", () => {
      const cmds = dsl('box "Styled" 100x50 fill=solid color=#FF0000 opacity=0.5');
      expect(cmds[0]).toMatchObject({
        type: "rect",
        fillStyle: "solid",
        color: "#FF0000",
        opacity: 0.5,
      });
    });

    it("maps fill=none to fillStyle none", () => {
      const cmds = dsl('box "Wire" 100x50 fill=none');
      expect(cmds[0]).toMatchObject({
        type: "rect",
        fillStyle: "none",
      });
    });

    it("maps text attributes", () => {
      const cmds = dsl('text "Bold" size=24 align=center weight=bold style=italic');
      expect(cmds[0]).toMatchObject({
        type: "text",
        content: "Bold",
        fontSize: 24,
        textAlign: "center",
        fontWeight: "bold",
        fontStyle: "italic",
      });
    });
  });

  describe("multiple top-level nodes", () => {
    it("stacks top-level nodes vertically with gap=20", () => {
      const cmds = dsl(`
        box "First" 100x50
        box "Second" 100x50
      `);
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 100, height: 50 });
      expect(cmds[1]).toMatchObject({ type: "rect", x: 50, y: 120, width: 100, height: 50 });
    });
  });

  describe("layoutAsk", () => {
    it("converts ask node to AskPayload", () => {
      const tokens = tokenize(`
        ask {
          question #q1 single "Pick one" {
            options "A" | "B"
            box "Option A" 100x50
          }
        }
      `);
      const ast = parse(tokens);
      const askNode = ast.find((n) => n.type === "ask")!;
      const payload = layoutAsk(askNode);
      expect(payload.questions).toHaveLength(1);
      expect(payload.questions[0]).toMatchObject({
        id: "q1",
        text: "Pick one",
        type: "single",
        options: ["A", "B"],
      });
      expect(payload.questions[0].commands).toHaveLength(1);
      expect(payload.questions[0].commands![0]).toMatchObject({
        type: "rect",
        x: 50,
        y: 50,
        width: 100,
        height: 50,
        label: "Option A",
      });
    });
  });
});
