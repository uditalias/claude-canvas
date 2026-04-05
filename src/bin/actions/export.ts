import { resolveSession } from "../../server/process.js";
import { httpGet } from "../utils.js";

export async function exportAction(opts: { format: string; labels: boolean; session?: string }) {
  const { session } = resolveSession(opts.session);
  const url = `http://127.0.0.1:${session.port}/api/export?format=${opts.format}&labels=${opts.labels}`;
  const res = await httpGet(url);
  if (res.path) {
    console.log(JSON.stringify(res));
  } else {
    console.error("Export failed:", res.error);
    process.exit(1);
  }
}
