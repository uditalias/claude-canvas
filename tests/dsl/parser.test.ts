import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/bin/dsl/tokenizer";
import { parse } from "../../src/bin/dsl/parser";

function p(input: string) {
  return parse(tokenize(input));
}

describe("parser", () => {
  describe("shapes", () => {
    it("parses box with label and size", () => {
      const ast = p('box "Header" 200x150');
      expect(ast).toEqual([
        { type: "box", label: "Header", size: { w: 200, h: 150 }, attrs: {} },
      ]);
    });

    it("parses box without label", () => {
      const ast = p("box 200x150");
      expect(ast).toEqual([
        { type: "box", size: { w: 200, h: 150 }, attrs: {} },
      ]);
    });

    it("parses box with attrs", () => {
      const ast = p('box "Card" 200x150 fill=solid color=#FF0000');
      expect(ast).toEqual([
        {
          type: "box",
          label: "Card",
          size: { w: 200, h: 150 },
          attrs: { fill: "solid", color: "#FF0000" },
        },
      ]);
    });

    it("parses container box with pad and children", () => {
      const ast = p(`
        box "Container" pad=10 {
          box "Child" 100x50
        }
      `);
      expect(ast).toEqual([
        {
          type: "box",
          label: "Container",
          attrs: { pad: 10 },
          children: [
            { type: "box", label: "Child", size: { w: 100, h: 50 }, attrs: {} },
          ],
        },
      ]);
    });

    it("parses circle with label and radius", () => {
      const ast = p('circle "Icon" 50');
      expect(ast).toEqual([
        { type: "circle", label: "Icon", radius: 50, attrs: {} },
      ]);
    });

    it("parses circle without label", () => {
      const ast = p("circle 30");
      expect(ast).toEqual([
        { type: "circle", radius: 30, attrs: {} },
      ]);
    });

    it("parses ellipse with label and size", () => {
      const ast = p('ellipse "Oval" 200x100');
      expect(ast).toEqual([
        { type: "ellipse", label: "Oval", size: { w: 200, h: 100 }, attrs: {} },
      ]);
    });

    it("parses ellipse without label", () => {
      const ast = p("ellipse 200x100");
      expect(ast).toEqual([
        { type: "ellipse", size: { w: 200, h: 100 }, attrs: {} },
      ]);
    });
  });

  describe("text", () => {
    it("parses text with content", () => {
      const ast = p('text "Hello World"');
      expect(ast).toEqual([
        { type: "text", content: "Hello World", attrs: {} },
      ]);
    });

    it("parses text with attrs", () => {
      const ast = p('text "Title" size=24 align=center weight=bold style=italic');
      expect(ast).toEqual([
        {
          type: "text",
          content: "Title",
          attrs: { size: 24, align: "center", weight: "bold", style: "italic" },
        },
      ]);
    });
  });

  describe("layout", () => {
    it("parses row with gap and children", () => {
      const ast = p(`
        row gap=20 {
          box "A" 100x50
          box "B" 100x50
        }
      `);
      expect(ast).toEqual([
        {
          type: "row",
          gap: 20,
          children: [
            { type: "box", label: "A", size: { w: 100, h: 50 }, attrs: {} },
            { type: "box", label: "B", size: { w: 100, h: 50 }, attrs: {} },
          ],
        },
      ]);
    });

    it("parses stack with children", () => {
      const ast = p(`
        stack {
          box "Top" 100x50
          box "Bottom" 100x50
        }
      `);
      expect(ast).toEqual([
        {
          type: "stack",
          gap: 0,
          children: [
            { type: "box", label: "Top", size: { w: 100, h: 50 }, attrs: {} },
            { type: "box", label: "Bottom", size: { w: 100, h: 50 }, attrs: {} },
          ],
        },
      ]);
    });

    it("parses nested layout (stack > row > box)", () => {
      const ast = p(`
        stack gap=10 {
          row gap=5 {
            box "A" 50x50
            box "B" 50x50
          }
          box "C" 100x50
        }
      `);
      expect(ast).toEqual([
        {
          type: "stack",
          gap: 10,
          children: [
            {
              type: "row",
              gap: 5,
              children: [
                { type: "box", label: "A", size: { w: 50, h: 50 }, attrs: {} },
                { type: "box", label: "B", size: { w: 50, h: 50 }, attrs: {} },
              ],
            },
            { type: "box", label: "C", size: { w: 100, h: 50 }, attrs: {} },
          ],
        },
      ]);
    });

    it("defaults gap to 0", () => {
      const ast = p(`row { box 50x50 }`);
      expect(ast[0]).toMatchObject({ type: "row", gap: 0 });
    });
  });

  describe("lines and arrows", () => {
    it("parses arrow with absolute coords", () => {
      const ast = p("arrow 100,200 -> 300,400");
      expect(ast).toEqual([
        {
          type: "arrow",
          from: { x: 100, y: 200 },
          to: { x: 300, y: 400 },
          attrs: {},
        },
      ]);
    });

    it("parses arrow with label strings", () => {
      const ast = p('arrow "Start" -> "End" "my label"');
      expect(ast).toEqual([
        {
          type: "arrow",
          from: "Start",
          to: "End",
          label: "my label",
          attrs: {},
        },
      ]);
    });

    it("parses line with coords", () => {
      const ast = p("line 0,0 -> 100,100");
      expect(ast).toEqual([
        {
          type: "line",
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          attrs: {},
        },
      ]);
    });
  });

  describe("groups and connectors", () => {
    it("parses group with id and children", () => {
      const ast = p(`
        group #my-group {
          box "A" 100x50
          circle 30
        }
      `);
      expect(ast).toEqual([
        {
          type: "group",
          id: "my-group",
          children: [
            { type: "box", label: "A", size: { w: 100, h: 50 }, attrs: {} },
            { type: "circle", radius: 30, attrs: {} },
          ],
        },
      ]);
    });

    it("parses connector with label", () => {
      const ast = p('#start -> #end "connects"');
      expect(ast).toEqual([
        { type: "connector", fromId: "start", toId: "end", label: "connects" },
      ]);
    });

    it("parses connector without label", () => {
      const ast = p("#start -> #end");
      expect(ast).toEqual([
        { type: "connector", fromId: "start", toId: "end" },
      ]);
    });
  });

  describe("ask blocks", () => {
    it("parses single question with options", () => {
      const ast = p(`
        ask {
          question #q1 single "Which layout?" {
            options "Layout A" | "Layout B"
          }
        }
      `);
      expect(ast).toEqual([
        {
          type: "ask",
          questions: [
            {
              id: "q1",
              qtype: "single",
              text: "Which layout?",
              options: ["Layout A", "Layout B"],
            },
          ],
        },
      ]);
    });

    it("parses question with draw commands", () => {
      const ast = p(`
        ask {
          question #q1 single "Pick one" {
            options "A" | "B"
            box "Option A" 100x50
          }
        }
      `);
      expect(ast).toEqual([
        {
          type: "ask",
          questions: [
            {
              id: "q1",
              qtype: "single",
              text: "Pick one",
              options: ["A", "B"],
              children: [
                { type: "box", label: "Option A", size: { w: 100, h: 50 }, attrs: {} },
              ],
            },
          ],
        },
      ]);
    });

    it("parses text question without braces", () => {
      const ast = p(`
        ask {
          question #q2 text "What title?"
        }
      `);
      expect(ast).toEqual([
        {
          type: "ask",
          questions: [
            {
              id: "q2",
              qtype: "text",
              text: "What title?",
            },
          ],
        },
      ]);
    });

    it("parses multi question", () => {
      const ast = p(`
        ask {
          question #q1 multi "Select all" {
            options "X" | "Y" | "Z"
          }
        }
      `);
      expect(ast).toEqual([
        {
          type: "ask",
          questions: [
            {
              id: "q1",
              qtype: "multi",
              text: "Select all",
              options: ["X", "Y", "Z"],
            },
          ],
        },
      ]);
    });

    it("parses canvas question", () => {
      const ast = p(`
        ask {
          question #q1 canvas "Draw something"
        }
      `);
      expect(ast).toEqual([
        {
          type: "ask",
          questions: [
            {
              id: "q1",
              qtype: "canvas",
              text: "Draw something",
            },
          ],
        },
      ]);
    });

    it("parses multiple questions", () => {
      const ast = p(`
        ask {
          question #q1 single "First?" {
            options "A" | "B"
          }
          question #q2 text "Second?"
        }
      `);
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe("ask");
      const ask = ast[0] as { type: "ask"; questions: any[] };
      expect(ask.questions).toHaveLength(2);
      expect(ask.questions[0].id).toBe("q1");
      expect(ask.questions[1].id).toBe("q2");
    });
  });

  describe("draw attributes", () => {
    it("parses narration", () => {
      const ast = p('narration "This is a narration"');
      expect(ast).toEqual([
        { type: "narration", content: "This is a narration" },
      ]);
    });

    it("parses animate=false", () => {
      const ast = p("animate=false");
      expect(ast).toEqual([
        { type: "animate", value: false },
      ]);
    });
  });

  describe("error handling", () => {
    it("throws on missing size for leaf box without label", () => {
      expect(() => p("box")).toThrow(/parse error/i);
    });

    it("throws on missing size for leaf box with label", () => {
      expect(() => p('box "Foo"')).toThrow(/parse error/i);
    });

    it("throws on unclosed brace", () => {
      expect(() => p("row {")).toThrow(/unclosed/i);
    });

    it("throws on unexpected token", () => {
      expect(() => p("-> 100,200")).toThrow(/unexpected/i);
    });
  });
});
