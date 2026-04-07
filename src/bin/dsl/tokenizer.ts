export type TokenType =
  | "keyword"
  | "string"
  | "number"
  | "size"
  | "hash_id"
  | "attr"
  | "arrow_op"
  | "pipe"
  | "brace_open"
  | "brace_close"
  | "coords";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  "box", "circle", "ellipse", "text", "line", "arrow",
  "row", "stack", "group", "connector", "ask", "question",
  "options", "narration",
]);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0): string {
    return input[pos + offset] ?? "";
  }

  function advance(): string {
    const ch = input[pos++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function skipWhitespace(): void {
    while (pos < input.length) {
      const ch = peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === ";") {
        advance();
      } else {
        break;
      }
    }
  }

  function readWhile(pred: (ch: string) => boolean): string {
    let result = "";
    while (pos < input.length && pred(peek())) {
      result += advance();
    }
    return result;
  }

  function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  function isIdentChar(ch: string): boolean {
    return (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "_" ||
      ch === "-"
    );
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;

    const startLine = line;
    const startCol = col;
    const ch = peek();

    // String literal
    if (ch === '"') {
      advance(); // consume opening quote
      let value = "";
      let closed = false;
      while (pos < input.length) {
        const c = peek();
        if (c === "\\") {
          advance();
          const next = advance();
          if (next === '"') {
            value += '"';
          } else if (next === "\\") {
            value += "\\";
          } else if (next === "n") {
            value += "\n";
          } else {
            value += next;
          }
        } else if (c === '"') {
          advance(); // consume closing quote
          closed = true;
          break;
        } else {
          value += advance();
        }
      }
      if (!closed) {
        throw new Error(`Unterminated string at line ${startLine}, col ${startCol}`);
      }
      tokens.push({ type: "string", value, line: startLine, col: startCol });
      continue;
    }

    // Arrow operator
    if (ch === "-" && peek(1) === ">") {
      advance();
      advance();
      tokens.push({ type: "arrow_op", value: "->", line: startLine, col: startCol });
      continue;
    }

    // Pipe
    if (ch === "|") {
      advance();
      tokens.push({ type: "pipe", value: "|", line: startLine, col: startCol });
      continue;
    }

    // Braces
    if (ch === "{") {
      advance();
      tokens.push({ type: "brace_open", value: "{", line: startLine, col: startCol });
      continue;
    }
    if (ch === "}") {
      advance();
      tokens.push({ type: "brace_close", value: "}", line: startLine, col: startCol });
      continue;
    }

    // Comment: # followed by space or end-of-line (standalone #)
    // vs hash_id: # followed by identifier chars
    if (ch === "#") {
      const next = peek(1);
      if (next === "" || next === " " || next === "\t" || next === "\n" || next === "\r") {
        // Comment — skip to end of line
        while (pos < input.length && peek() !== "\n") {
          advance();
        }
        continue;
      }
      // Hash ID: #identifier
      if (isIdentChar(next)) {
        advance(); // consume #
        const id = readWhile(isIdentChar);
        tokens.push({ type: "hash_id", value: id, line: startLine, col: startCol });
        continue;
      }
      // Otherwise skip unknown #
      advance();
      continue;
    }

    // Numbers, sizes, and coords: start with a digit
    if (isDigit(ch)) {
      let num = readWhile((c) => isDigit(c) || c === ".");

      // Size literal: NUMBERxNUMBER
      if (peek() === "x" && isDigit(peek(1))) {
        num += advance(); // consume 'x'
        num += readWhile((c) => isDigit(c) || c === ".");
        tokens.push({ type: "size", value: num, line: startLine, col: startCol });
        continue;
      }

      // Coords: NUMBER,NUMBER (no space around comma)
      if (peek() === "," && isDigit(peek(1))) {
        num += advance(); // consume ','
        num += readWhile((c) => isDigit(c) || c === ".");
        tokens.push({ type: "coords", value: num, line: startLine, col: startCol });
        continue;
      }

      tokens.push({ type: "number", value: num, line: startLine, col: startCol });
      continue;
    }

    // Identifiers (keywords or attrs)
    if (isIdentChar(ch) && !isDigit(ch)) {
      const word = readWhile(isIdentChar);

      // Check if this is an attribute: word=value
      if (peek() === "=") {
        let attr = word;
        attr += advance(); // consume '='
        // Value can contain #, letters, digits, dots, dashes
        attr += readWhile((c) => c !== " " && c !== "\t" && c !== "\n" && c !== "\r" && c !== ";" && c !== "{" && c !== "}" && c !== "|");
        tokens.push({ type: "attr", value: attr, line: startLine, col: startCol });
        continue;
      }

      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word, line: startLine, col: startCol });
      } else {
        // Unknown identifier — treat as keyword for now (parser will validate)
        tokens.push({ type: "keyword", value: word, line: startLine, col: startCol });
      }
      continue;
    }

    // Unknown character — skip
    advance();
  }

  return tokens;
}
