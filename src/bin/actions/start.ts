import { findAvailablePort } from "../../utils/port.js";
import { openBrowser } from "../../utils/open-browser.js";
import {
  writeSession,
  generateSessionId,
  spawnServer,
} from "../../server/process.js";
import { waitForServer } from "../utils.js";

export async function startAction(opts: { port: string }) {
  const port = await findAvailablePort(parseInt(opts.port, 10));
  const child = spawnServer(port);
  const pid = child.pid!;
  const sessionId = generateSessionId();
  const createdAt = new Date().toISOString();
  writeSession(sessionId, { pid, port, createdAt });

  await waitForServer(port, 5000);
  const url = `http://127.0.0.1:${port}`;
  console.log(JSON.stringify({ sessionId, port, url, pid }));
  await openBrowser(url);
  process.exit(0);
}
