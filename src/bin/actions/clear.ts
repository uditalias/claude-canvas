import { resolveSession } from "../../server/process.js";
import { httpPost } from "../utils.js";

export async function clearAction(opts: { layer?: string; session?: string }) {
  const { session } = resolveSession(opts.session);
  const url = opts.layer
    ? `http://127.0.0.1:${session.port}/api/clear?layer=${opts.layer}`
    : `http://127.0.0.1:${session.port}/api/clear`;
  const res = await httpPost(url, {});
  console.log(JSON.stringify(res));
}
