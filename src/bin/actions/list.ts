import { listAliveSessions } from "../../server/process.js";

export function listAction() {
  const alive = listAliveSessions();
  if (alive.length === 0) {
    console.log("No canvas sessions running.");
    return;
  }
  console.log(JSON.stringify(alive.map(({ id, session }) => ({
    sessionId: id,
    port: session.port,
    pid: session.pid,
    createdAt: session.createdAt,
    url: `http://127.0.0.1:${session.port}`,
  }))));
}
