import { resolveSession } from "../../server/process.js";
import { httpPost, readStdin } from "../utils.js";

export async function askAction(json: string, opts: { session?: string }) {
  const { session } = resolveSession(opts.session);
  let body: string;
  if (json === "-") {
    body = await readStdin();
  } else {
    body = json;
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    console.error("Invalid JSON");
    process.exit(1);
  }
  const res = await httpPost(`http://127.0.0.1:${session.port}/api/ask`, payload);
  console.log(JSON.stringify(res));
}
