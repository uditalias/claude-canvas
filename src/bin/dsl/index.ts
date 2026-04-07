import { tokenize } from "./tokenizer.js";
import { parse, type ASTNode } from "./parser.js";
import { layout, layoutAsk } from "./layout.js";
import type { DrawPayload, AskPayload } from "../../protocol/types.js";

export function parseDSL(input: string): DrawPayload | AskPayload {
  const tokens = tokenize(input);
  const ast = parse(tokens);

  // Check if this is an ask payload
  if (ast.length === 1 && ast[0].type === "ask") {
    return layoutAsk(ast[0]);
  }

  // Otherwise it's a draw payload
  let narration: string | undefined;
  let animate: boolean | undefined;
  const commandNodes = ast.filter((node): node is ASTNode => {
    if (node.type === "narration") {
      narration = node.content;
      return false;
    }
    if (node.type === "animate") {
      animate = node.value;
      return false;
    }
    return true;
  });

  const commands = layout(commandNodes);
  const payload: DrawPayload = { commands };
  if (narration !== undefined) payload.narration = narration;
  if (animate !== undefined) payload.animate = animate;
  return payload;
}
