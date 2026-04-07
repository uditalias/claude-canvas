import { resolveSession } from "../../server/process.js";
import { httpPost, readStdin } from "../utils.js";
import { parseDSL } from "../dsl/index.js";

export async function askAction(input: string, opts: { dsl?: boolean; session?: string }) {
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
  const res = await httpPost(`http://127.0.0.1:${session.port}/api/ask`, payload);
  console.log(JSON.stringify(res));
}
