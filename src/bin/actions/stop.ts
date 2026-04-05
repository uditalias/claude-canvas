import {
  clearSession,
  listAliveSessions,
  resolveSession,
  isAlive,
} from "../../server/process.js";

export function stopAction(opts: { session?: string; all?: boolean }) {
  if (opts.all) {
    const alive = listAliveSessions();
    if (alive.length === 0) {
      console.log("No canvas sessions running.");
      return;
    }
    for (const { id, session } of alive) {
      try {
        process.kill(session.pid, "SIGTERM");
        clearSession(id);
        console.log(`Stopped session ${id} (PID ${session.pid}).`);
      } catch (err) {
        console.error(`Failed to stop session ${id}:`, (err as Error).message);
      }
    }
    return;
  }

  const { id, session } = resolveSession(opts.session);
  if (!isAlive(session.pid)) {
    console.log(`Session ${id} is not running. Cleaning up.`);
    clearSession(id);
    return;
  }
  try {
    process.kill(session.pid, "SIGTERM");
    clearSession(id);
    console.log(`Canvas server session ${id} (PID ${session.pid}) stopped.`);
  } catch (err) {
    console.error("Failed to stop server:", (err as Error).message);
  }
}
