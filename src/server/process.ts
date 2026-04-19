import * as child_process from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SESSION_DIR = path.join(os.homedir(), ".claude-canvas", "sessions");

export interface Session {
  pid: number;
  port: number;
  createdAt: string;
}

export function generateSessionId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function readSession(id: string): Session | null {
  try {
    const filePath = path.join(SESSION_DIR, `${id}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(id: string, session: Session): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

export function clearSession(id: string): void {
  try {
    const filePath = path.join(SESSION_DIR, `${id}.json`);
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

export function listSessionIds(): string[] {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  // Migrate old single-session file if it exists
  const oldSessionFile = path.join(os.homedir(), ".claude-canvas", "session.json");
  try {
    const raw = fs.readFileSync(oldSessionFile, "utf-8");
    const old = JSON.parse(raw) as { pid: number; port: number };
    const id = generateSessionId();
    writeSession(id, { pid: old.pid, port: old.port, createdAt: new Date().toISOString() });
    fs.unlinkSync(oldSessionFile);
  } catch {
    // No old file or already migrated
  }

  try {
    const files = fs.readdirSync(SESSION_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

export function listAliveSessions(): { id: string; session: Session }[] {
  const ids = listSessionIds();
  const alive: { id: string; session: Session }[] = [];
  for (const id of ids) {
    const session = readSession(id);
    if (session && isAlive(session.pid)) {
      alive.push({ id, session });
    } else {
      // Clean up stale session file
      clearSession(id);
    }
  }
  return alive;
}

export function resolveSession(sessionId?: string): { id: string; session: Session } {
  if (sessionId) {
    const session = readSession(sessionId);
    if (!session || !isAlive(session.pid)) {
      console.error(`Session "${sessionId}" is not running.`);
      process.exit(1);
    }
    return { id: sessionId, session };
  }

  const alive = listAliveSessions();
  if (alive.length === 0) {
    console.error("No canvas session is running. Start one with: claude-canvas start");
    process.exit(1);
  }
  if (alive.length === 1) {
    return alive[0];
  }

  console.error(
    `Multiple sessions running. Specify one with --session <id>:\n` +
      alive.map((s) => `  ${s.id}  port=${s.session.port}  pid=${s.session.pid}`).join("\n")
  );
  process.exit(1);
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function buildSpawnEnv(port: number, host?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
  if (host) env.CANVAS_HOST = host;
  return env;
}

export function spawnServer(port: number, host?: string): child_process.ChildProcess {
  // When bundled: dist/bin/claude-canvas.js -> server at dist/server/index.js
  // When running via tsx from project root: src/server/process.ts -> src/server/index.ts (handled by tsx)
  const serverScript = path.resolve(__dirname, "../server/index.js");
  const child = child_process.fork(serverScript, [], {
    detached: true,
    stdio: "ignore",
    env: buildSpawnEnv(port, host),
  });
  child.unref();
  return child;
}
