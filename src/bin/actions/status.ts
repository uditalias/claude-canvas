import { resolveSession } from "../../server/process.js";
import { httpPost } from "../utils.js";

export async function statusAction(text: string, opts: { session?: string }) {
  const { session } = resolveSession(opts.session);
  const res = await httpPost(`http://127.0.0.1:${session.port}/api/status`, { text });
  console.log(JSON.stringify(res));
}
