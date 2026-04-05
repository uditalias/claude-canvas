import { resolveSession } from "../../server/process.js";
import { httpGet } from "../utils.js";

export async function screenshotAction(opts: { session?: string }) {
  const { session } = resolveSession(opts.session);
  const res = await httpGet(`http://127.0.0.1:${session.port}/api/screenshot`);
  if (res.path) {
    console.log(JSON.stringify(res));
  } else {
    console.error("Screenshot failed:", res.error);
    process.exit(1);
  }
}
