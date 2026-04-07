import { resolveSession } from "../../server/process.js";
import { httpPost, readStdin } from "../utils.js";
import { parseDSL } from "../dsl/index.js";

export async function drawAction(input: string, opts: { animate: boolean; dsl?: boolean; session?: string }) {
  let body: string;
  if (input === "-") {
    body = await readStdin();
  } else {
    body = input;
  }
  let payload: Record<string, unknown>;
  if (opts.dsl) {
    try {
      payload = parseDSL(body) as Record<string, unknown>;
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  } else {
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      console.error("Invalid JSON");
      process.exit(1);
    }
  }
  const { session } = resolveSession(opts.session);
  if (!opts.animate) {
    payload.animate = false;
  }
  const res = await httpPost(`http://127.0.0.1:${session.port}/api/draw`, payload);
  console.log(JSON.stringify(res));
}
