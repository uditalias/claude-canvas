import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SESSION_DIR = path.join(os.homedir(), ".claude-canvas");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");

export interface Session {
  pid: number;
  port: number;
}

export function readSession(): Session | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

export function clearSession(): void {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {
    // ignore
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function spawnServer(port: number): child_process.ChildProcess {
  // When bundled: dist/bin/claude-canvas.js → server at dist/server/index.js
  // When running via tsx from project root: src/server/process.ts → src/server/index.ts (handled by tsx)
  const serverScript = path.resolve(__dirname, "../server/index.js");
  const child = child_process.fork(serverScript, [], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: String(port) },
  });
  child.unref();
  return child;
}
