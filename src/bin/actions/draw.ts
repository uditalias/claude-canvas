import { resolveSession } from "../../server/process.js";
import { httpPost, readStdin } from "../utils.js";

export async function drawAction(json: string, opts: { animate: boolean; session?: string }) {
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
  if (!opts.animate) {
    payload.animate = false;
  }
  const res = await httpPost(`http://127.0.0.1:${session.port}/api/draw`, payload);
  console.log(JSON.stringify(res));
}
