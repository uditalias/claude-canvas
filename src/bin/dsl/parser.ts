import type { Token, TokenType } from "./tokenizer.js";

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

export interface Attrs {
  fill?: string;
  color?: string;
  opacity?: number;
  pad?: number;
  size?: number;
  align?: string;
  weight?: string;
  style?: string;
}

export type Coords = { x: number; y: number };

export type ASTNode =
  | { type: "box"; label?: string; size?: { w: number; h: number }; attrs: Attrs; children?: ASTNode[] }
  | { type: "circle"; label?: string; radius: number; attrs: Attrs }
  | { type: "ellipse"; label?: string; size: { w: number; h: number }; attrs: Attrs }
  | { type: "text"; content: string; attrs: Attrs }
  | { type: "row"; gap: number; children: ASTNode[] }
  | { type: "stack"; gap: number; children: ASTNode[] }
  | { type: "line"; from: Coords | string; to: Coords | string; label?: string; attrs: Attrs }
  | { type: "arrow"; from: Coords | string; to: Coords | string; label?: string; attrs: Attrs }
  | { type: "group"; id: string; children: ASTNode[] }
  | { type: "connector"; fromId: string; toId: string; label?: string }
  | { type: "ask"; questions: QuestionNode[] }
  | { type: "narration"; content: string }
  | { type: "animate"; value: boolean };

export interface QuestionNode {
  id: string;
  qtype: string;
  text: string;
  options?: string[];
  children?: ASTNode[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parse(tokens: Token[]): ASTNode[] {
  let pos = 0;

  // -- helpers --------------------------------------------------------------

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function at(type: TokenType, value?: string): boolean {
    const t = peek();
    if (!t) return false;
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  function consume(type: TokenType, value?: string): Token {
    const t = peek();
    if (!t) {
      const prev = tokens[tokens.length - 1];
      const line = prev ? prev.line : 1;
      throw new Error(
        `DSL parse error at line ${line}: expected ${type}${value ? ` "${value}"` : ""} but reached end of input`,
      );
    }
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(
        `DSL parse error at line ${t.line}: expected ${type}${value ? ` "${value}"` : ""} but got ${t.type} "${t.value}"`,
      );
    }
    pos++;
    return t;
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function errorAt(msg: string): Error {
    const t = peek();
    const line = t ? t.line : tokens[tokens.length - 1]?.line ?? 1;
    return new Error(`DSL parse error at line ${line}: ${msg}`);
  }

  // -- attr parsing ---------------------------------------------------------

  function parseAttrs(): Attrs {
    const attrs: Attrs = {};
    while (at("attr")) {
      const tok = advance();
      const eqIdx = tok.value.indexOf("=");
      const key = tok.value.slice(0, eqIdx);
      const val = tok.value.slice(eqIdx + 1);
      switch (key) {
        case "fill":
          attrs.fill = val;
          break;
        case "color":
          attrs.color = val;
          break;
        case "opacity":
          attrs.opacity = parseFloat(val);
          break;
        case "pad":
          attrs.pad = parseFloat(val);
          break;
        case "size":
          attrs.size = parseFloat(val);
          break;
        case "align":
          attrs.align = val;
          break;
        case "weight":
          attrs.weight = val;
          break;
        case "style":
          attrs.style = val;
          break;
        default:
          // unknown attr — keep going
          break;
      }
    }
    return attrs;
  }

  // -- coords helper --------------------------------------------------------

  function parseCoords(tok: Token): Coords {
    const parts = tok.value.split(",");
    return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
  }

  function parseSize(tok: Token): { w: number; h: number } {
    const parts = tok.value.split("x");
    return { w: parseFloat(parts[0]), h: parseFloat(parts[1]) };
  }

  // -- children block -------------------------------------------------------

  function parseChildren(): ASTNode[] {
    const openTok = consume("brace_open");
    const children: ASTNode[] = [];
    while (!at("brace_close")) {
      if (!peek()) {
        throw new Error(`DSL parse error at line ${openTok.line}: unclosed block`);
      }
      children.push(parseStatement());
    }
    consume("brace_close");
    return children;
  }

  // -- statement dispatch ---------------------------------------------------

  function parseStatement(): ASTNode {
    const t = peek();

    if (!t) {
      throw errorAt("unexpected end of input");
    }

    // Handle animate=false as a top-level attr
    if (t.type === "attr") {
      const eqIdx = t.value.indexOf("=");
      const key = t.value.slice(0, eqIdx);
      const val = t.value.slice(eqIdx + 1);
      if (key === "animate") {
        advance();
        return { type: "animate", value: val !== "false" };
      }
    }

    // Connector: hash_id -> hash_id
    if (t.type === "hash_id") {
      return parseConnector();
    }

    if (t.type !== "keyword") {
      throw new Error(
        `DSL parse error at line ${t.line}: unexpected token "${t.value}"`,
      );
    }

    switch (t.value) {
      case "box":
        return parseBox();
      case "circle":
        return parseCircle();
      case "ellipse":
        return parseEllipse();
      case "text":
        return parseText();
      case "arrow":
        return parseArrow();
      case "line":
        return parseLine();
      case "row":
        return parseRow();
      case "stack":
        return parseStack();
      case "group":
        return parseGroup();
      case "connector":
        advance();
        return parseConnector();
      case "ask":
        return parseAsk();
      case "narration":
        return parseNarration();
      default:
        throw new Error(
          `DSL parse error at line ${t.line}: unexpected token "${t.value}"`,
        );
    }
  }

  // -- shape parsers --------------------------------------------------------

  function parseBox(): ASTNode {
    consume("keyword", "box");
    let label: string | undefined;
    if (at("string")) {
      label = advance().value;
    }

    // Collect attrs before brace (e.g., pad=10)
    const preAttrs = parseAttrs();

    // Container box: has braces
    if (at("brace_open")) {
      const children = parseChildren();
      // Collect any trailing attrs
      const postAttrs = parseAttrs();
      const attrs = { ...preAttrs, ...postAttrs };
      const node: ASTNode = { type: "box", attrs, children };
      if (label) node.label = label;
      return node;
    }

    // Leaf box: must have size
    if (at("size")) {
      const sizeTok = advance();
      const size = parseSize(sizeTok);
      const postAttrs = parseAttrs();
      const attrs = { ...preAttrs, ...postAttrs };
      const node: ASTNode = { type: "box", size, attrs };
      if (label) node.label = label;
      return node;
    }

    // If we have pad attr, braces are required
    if (preAttrs.pad !== undefined) {
      throw errorAt('expected "{" after box with pad attribute');
    }

    // No size and no braces — error
    throw errorAt("expected size (e.g., 200x150) or { for box");
  }

  function parseCircle(): ASTNode {
    consume("keyword", "circle");
    let label: string | undefined;
    if (at("string")) {
      label = advance().value;
    }
    const radiusTok = consume("number");
    const radius = parseFloat(radiusTok.value);
    const attrs = parseAttrs();
    const node: ASTNode = { type: "circle", radius, attrs };
    if (label) node.label = label;
    return node;
  }

  function parseEllipse(): ASTNode {
    consume("keyword", "ellipse");
    let label: string | undefined;
    if (at("string")) {
      label = advance().value;
    }
    const sizeTok = consume("size");
    const size = parseSize(sizeTok);
    const attrs = parseAttrs();
    const node: ASTNode = { type: "ellipse", size, attrs };
    if (label) node.label = label;
    return node;
  }

  function parseText(): ASTNode {
    consume("keyword", "text");
    const contentTok = consume("string");
    const attrs = parseAttrs();
    return { type: "text", content: contentTok.value, attrs };
  }

  function parseArrowOrLine(kind: "arrow" | "line"): ASTNode {
    consume("keyword", kind);

    // Parse first operand
    let from: Coords | string;
    if (at("coords")) {
      from = parseCoords(advance());
    } else if (at("string")) {
      from = advance().value;
    } else {
      throw errorAt(`expected coords or string as first operand of ${kind}`);
    }

    consume("arrow_op");

    // Parse second operand
    let to: Coords | string;
    if (at("coords")) {
      to = parseCoords(advance());
    } else if (at("string")) {
      to = advance().value;
    } else {
      throw errorAt(`expected coords or string as second operand of ${kind}`);
    }

    // Optional label
    let label: string | undefined;
    if (at("string")) {
      label = advance().value;
    }

    const attrs = parseAttrs();
    const node: ASTNode = { type: kind, from, to, attrs };
    if (label) (node as any).label = label;
    return node;
  }

  function parseArrow(): ASTNode {
    return parseArrowOrLine("arrow");
  }

  function parseLine(): ASTNode {
    return parseArrowOrLine("line");
  }

  // -- layout parsers -------------------------------------------------------

  function parseRowOrStack(kind: "row" | "stack"): ASTNode {
    consume("keyword", kind);
    let gap = 0;
    // Check for gap attr
    if (at("attr")) {
      const t = peek()!;
      if (t.value.startsWith("gap=")) {
        advance();
        gap = parseFloat(t.value.slice(4));
      }
    }
    const children = parseChildren();
    return { type: kind, gap, children };
  }

  function parseRow(): ASTNode {
    return parseRowOrStack("row");
  }

  function parseStack(): ASTNode {
    return parseRowOrStack("stack");
  }

  // -- group / connector ----------------------------------------------------

  function parseGroup(): ASTNode {
    consume("keyword", "group");
    const idTok = consume("hash_id");
    const children = parseChildren();
    return { type: "group", id: idTok.value, children };
  }

  function parseConnector(): ASTNode {
    const fromTok = consume("hash_id");
    consume("arrow_op");
    const toTok = consume("hash_id");
    let label: string | undefined;
    if (at("string")) {
      label = advance().value;
    }
    const node: ASTNode = { type: "connector", fromId: fromTok.value, toId: toTok.value };
    if (label) node.label = label;
    return node;
  }

  // -- ask ------------------------------------------------------------------

  function parseAsk(): ASTNode {
    consume("keyword", "ask");
    consume("brace_open");
    const questions: QuestionNode[] = [];
    while (!at("brace_close")) {
      if (!peek()) {
        throw errorAt("unclosed block in ask");
      }
      questions.push(parseQuestion());
    }
    consume("brace_close");
    return { type: "ask", questions };
  }

  function parseQuestion(): QuestionNode {
    consume("keyword", "question");
    const idTok = consume("hash_id");
    // qtype is a keyword token (single/multi/text/canvas)
    const qtypeTok = consume("keyword");
    const textTok = consume("string");

    const node: QuestionNode = {
      id: idTok.value,
      qtype: qtypeTok.value,
      text: textTok.value,
    };

    // Optional brace block with options and/or draw commands
    if (at("brace_open")) {
      consume("brace_open");

      // Check for options keyword
      if (at("keyword", "options")) {
        advance();
        node.options = parseOptions();
      }

      // Parse remaining draw commands as children
      const children: ASTNode[] = [];
      while (!at("brace_close")) {
        if (!peek()) {
          throw errorAt("unclosed block in question");
        }
        children.push(parseStatement());
      }
      if (children.length > 0) {
        node.children = children;
      }

      consume("brace_close");
    }

    return node;
  }

  function parseOptions(): string[] {
    const options: string[] = [];
    options.push(consume("string").value);
    while (at("pipe")) {
      advance();
      options.push(consume("string").value);
    }
    return options;
  }

  // -- narration ------------------------------------------------------------

  function parseNarration(): ASTNode {
    consume("keyword", "narration");
    const contentTok = consume("string");
    return { type: "narration", content: contentTok.value };
  }

  // -- entry point ----------------------------------------------------------

  const ast: ASTNode[] = [];
  while (pos < tokens.length) {
    ast.push(parseStatement());
  }
  return ast;
}
