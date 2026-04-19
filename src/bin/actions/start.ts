import { findAvailablePort } from "../../utils/port.js";
import { openBrowser } from "../../utils/open-browser.js";
import { resolveDefaultHost } from "../../utils/container.js";
import {
  writeSession,
  generateSessionId,
  spawnServer,
} from "../../server/process.js";
import { waitForServer } from "../utils.js";

export async function startAction(opts: { port: string; host?: string }) {
  const host = opts.host ?? process.env.CANVAS_HOST ?? resolveDefaultHost();
  const port = await findAvailablePort(parseInt(opts.port, 10), host);
  const child = spawnServer(port, host);
  const pid = child.pid!;
  const sessionId = generateSessionId();
  const createdAt = new Date().toISOString();
  writeSession(sessionId, { pid, port, createdAt });

  await waitForServer(port, 5000);
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  const url = `http://${displayHost}:${port}`;
  console.log(JSON.stringify({ sessionId, port, url, pid }));
  await openBrowser(url);
  process.exit(0);
}
