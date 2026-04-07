import { describe, it, expect } from "vitest";
import { tokenize, Token } from "../../src/bin/dsl/tokenizer";

describe("tokenizer", () => {
  it("tokenizes all keywords", () => {
    const keywords = [
      "box", "circle", "ellipse", "text", "line", "arrow",
      "row", "stack", "group", "connector", "ask", "question",
      "options", "narration",
    ];
    const tokens = tokenize(keywords.join(" "));
    expect(tokens).toHaveLength(keywords.length);
    for (let i = 0; i < keywords.length; i++) {
      expect(tokens[i].type).toBe("keyword");
      expect(tokens[i].value).toBe(keywords[i]);
    }
  });

  it("tokenizes quoted strings", () => {
    const tokens = tokenize('"hello world"');
    expect(tokens).toEqual([
      { type: "string", value: "hello world", line: 1, col: 1 },
    ]);
  });

  it("tokenizes strings with escaped quotes", () => {
    const tokens = tokenize('"say \\"hi\\" there"');
    expect(tokens).toEqual([
      { type: "string", value: 'say "hi" there', line: 1, col: 1 },
    ]);
  });

  it("tokenizes numbers (integers and floats)", () => {
    const tokens = tokenize("200 3.14 0.5");
    expect(tokens).toEqual([
      { type: "number", value: "200", line: 1, col: 1 },
      { type: "number", value: "3.14", line: 1, col: 5 },
      { type: "number", value: "0.5", line: 1, col: 10 },
    ]);
  });

  it("tokenizes size literals (200x150)", () => {
    const tokens = tokenize("200x150 80x40");
    expect(tokens).toEqual([
      { type: "size", value: "200x150", line: 1, col: 1 },
      { type: "size", value: "80x40", line: 1, col: 9 },
    ]);
  });

  it("tokenizes hash IDs (#my-id)", () => {
    const tokens = tokenize("#my-id #q1 #start");
    expect(tokens).toEqual([
      { type: "hash_id", value: "my-id", line: 1, col: 1 },
      { type: "hash_id", value: "q1", line: 1, col: 8 },
      { type: "hash_id", value: "start", line: 1, col: 12 },
    ]);
  });

  it("tokenizes attributes (gap=20, fill=solid, color=#FF0000)", () => {
    const tokens = tokenize("gap=20 fill=solid color=#FF0000");
    expect(tokens).toEqual([
      { type: "attr", value: "gap=20", line: 1, col: 1 },
      { type: "attr", value: "fill=solid", line: 1, col: 8 },
      { type: "attr", value: "color=#FF0000", line: 1, col: 19 },
    ]);
  });

  it("tokenizes arrow operator (->)", () => {
    const tokens = tokenize("->");
    expect(tokens).toEqual([
      { type: "arrow_op", value: "->", line: 1, col: 1 },
    ]);
  });

  it("tokenizes pipe (|)", () => {
    const tokens = tokenize("|");
    expect(tokens).toEqual([
      { type: "pipe", value: "|", line: 1, col: 1 },
    ]);
  });

  it("tokenizes braces ({ })", () => {
    const tokens = tokenize("{ }");
    expect(tokens).toEqual([
      { type: "brace_open", value: "{", line: 1, col: 1 },
      { type: "brace_close", value: "}", line: 1, col: 3 },
    ]);
  });

  it("tokenizes coordinate pairs (100,200)", () => {
    const tokens = tokenize("100,200");
    expect(tokens).toEqual([
      { type: "coords", value: "100,200", line: 1, col: 1 },
    ]);
  });

  it("discards comments (# ...)", () => {
    const tokens = tokenize("box # this is a comment\ncircle");
    expect(tokens).toEqual([
      { type: "keyword", value: "box", line: 1, col: 1 },
      { type: "keyword", value: "circle", line: 2, col: 1 },
    ]);
  });

  it("handles semicolons as whitespace", () => {
    const tokens = tokenize("box; circle");
    expect(tokens).toEqual([
      { type: "keyword", value: "box", line: 1, col: 1 },
      { type: "keyword", value: "circle", line: 1, col: 6 },
    ]);
  });

  it("tracks line numbers", () => {
    const tokens = tokenize("box\ncircle\ntext");
    expect(tokens[0]).toMatchObject({ line: 1, col: 1 });
    expect(tokens[1]).toMatchObject({ line: 2, col: 1 });
    expect(tokens[2]).toMatchObject({ line: 3, col: 1 });
  });

  it("tokenizes animate=false as attr", () => {
    const tokens = tokenize("animate=false");
    expect(tokens).toEqual([
      { type: "attr", value: "animate=false", line: 1, col: 1 },
    ]);
  });

  it("throws on unterminated string", () => {
    expect(() => tokenize('"hello')).toThrow(/unterminated string/i);
  });

  it("tokenizes a full DSL snippet", () => {
    const dsl = `
row gap=20 {
  box 200x150 #header "Title" fill=solid
  circle 50 #icon
}
#header -> #icon
    `.trim();

    const tokens = tokenize(dsl);
    const types = tokens.map((t) => t.type);
    const values = tokens.map((t) => t.value);

    expect(types).toEqual([
      "keyword",     // row
      "attr",        // gap=20
      "brace_open",  // {
      "keyword",     // box
      "size",        // 200x150
      "hash_id",     // #header
      "string",      // Title
      "attr",        // fill=solid
      "keyword",     // circle
      "number",      // 50
      "hash_id",     // #icon
      "brace_close", // }
      "hash_id",     // #header
      "arrow_op",    // ->
      "hash_id",     // #icon
    ]);

    expect(values).toEqual([
      "row", "gap=20", "{",
      "box", "200x150", "header", "Title", "fill=solid",
      "circle", "50", "icon",
      "}",
      "header", "->", "icon",
    ]);
  });
});
