#!/usr/bin/env node
import { Command } from "commander";
import * as http from "http";
import { findAvailablePort } from "../utils/port.js";
import { openBrowser } from "../utils/open-browser.js";
import {
  writeSession,
  clearSession,
  listAliveSessions,
  resolveSession,
  generateSessionId,
  isAlive,
  spawnServer,
} from "../server/process.js";

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

declare const PACKAGE_VERSION: string;

// PACKAGE_VERSION is injected by esbuild at build time.
// Falls back to reading package.json for dev/test (tsx).
function getVersion(): string {
  if (typeof PACKAGE_VERSION !== "undefined") return PACKAGE_VERSION;
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(resolve(dir, "../../package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0-dev";
  }
}

const program = new Command();
program.name("claude-canvas").description("Shared visual canvas for Claude Code").version(getVersion());

// ── start ───────────────────────────────────────────────────────────────────
program
  .command("start")
  .description("Start the canvas server and open the browser")
  .option("-p, --port <port>", "preferred port", "7890")
  .action(async (opts) => {
    const port = await findAvailablePort(parseInt(opts.port, 10));
    const child = spawnServer(port);
    const pid = child.pid!;
    const sessionId = generateSessionId();
    const createdAt = new Date().toISOString();
    writeSession(sessionId, { pid, port, createdAt });

    // Wait briefly for the server to be ready
    await waitForServer(port, 5000);
    const url = `http://127.0.0.1:${port}`;
    console.log(JSON.stringify({ sessionId, port, url, pid }));
    await openBrowser(url);
  });

// ── stop ────────────────────────────────────────────────────────────────────
program
  .command("stop")
  .description("Stop the canvas server")
  .option("-s, --session <id>", "Session ID")
  .option("--all", "Stop all running sessions")
  .action((opts: { session?: string; all?: boolean }) => {
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
  });

// ── draw ────────────────────────────────────────────────────────────────────
program
  .command("draw")
  .description("Send draw commands to the canvas")
  .argument("<json>", "DrawPayload JSON string or - to read from stdin")
  .option("--no-animate", "Render shapes instantly without animation")
  .option("-s, --session <id>", "Session ID")
  .action(async (json: string, opts: { animate: boolean; session?: string }) => {
    const { session } = resolveSession(opts.session);
    let body: string;
    if (json === "-") {
      body = await readStdin();
    } else {
      body = json;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      console.error("Invalid JSON");
      process.exit(1);
    }
    if (!opts.animate) {
      payload.animate = false;
    }
    const res = await httpPost(`http://127.0.0.1:${session.port}/api/draw`, payload);
    console.log(JSON.stringify(res));
  });

// ── ask ─────────────────────────────────────────────────────────────────────
program
  .command("ask")
  .description("Send visual questions to the user")
  .argument("<json>", "AskPayload JSON string or - to read from stdin")
  .option("-s, --session <id>", "Session ID")
  .action(async (json: string, opts: { session?: string }) => {
    const { session } = resolveSession(opts.session);
    let body: string;
    if (json === "-") {
      body = await readStdin();
    } else {
      body = json;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      console.error("Invalid JSON");
      process.exit(1);
    }
    const res = await httpPost(`http://127.0.0.1:${session.port}/api/ask`, payload);
    console.log(JSON.stringify(res));
  });

// ── clear ───────────────────────────────────────────────────────────────────
program
  .command("clear")
  .description("Clear the canvas")
  .option("-l, --layer <layer>", "Clear only shapes on this layer (e.g. claude)")
  .option("-s, --session <id>", "Session ID")
  .action(async (opts: { layer?: string; session?: string }) => {
    const { session } = resolveSession(opts.session);
    const url = opts.layer
      ? `http://127.0.0.1:${session.port}/api/clear?layer=${opts.layer}`
      : `http://127.0.0.1:${session.port}/api/clear`;
    const res = await httpPost(url, {});
    console.log(JSON.stringify(res));
  });

// ── screenshot ───────────────────────────────────────────────────────────────
program
  .command("screenshot")
  .description("Capture the canvas as a PNG")
  .option("-s, --session <id>", "Session ID")
  .action(async (opts: { session?: string }) => {
    const { session } = resolveSession(opts.session);
    const res = await httpGet(`http://127.0.0.1:${session.port}/api/screenshot`);
    if (res.path) {
      console.log(JSON.stringify(res));
    } else {
      console.error("Screenshot failed:", res.error);
      process.exit(1);
    }
  });

// ── export ──────────────────────────────────────────────────────────────────
program
  .command("export")
  .description("Export the canvas as PNG, SVG, or JSON")
  .option("-f, --format <format>", "Export format: png, svg, or json", "png")
  .option("--labels", "Include shape labels in export", false)
  .option("-s, --session <id>", "Session ID")
  .action(async (opts: { format: string; labels: boolean; session?: string }) => {
    const { session } = resolveSession(opts.session);
    const url = `http://127.0.0.1:${session.port}/api/export?format=${opts.format}&labels=${opts.labels}`;
    const res = await httpGet(url);
    if (res.path) {
      console.log(JSON.stringify(res));
    } else {
      console.error("Export failed:", res.error);
      process.exit(1);
    }
  });

program.parse();

// ── helpers ──────────────────────────────────────────────────────────────────

function httpGet(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    }).on("error", reject);
  });
}

function httpPost(url: string, body: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = http.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(resp));
        } catch {
          reject(new Error(`Invalid JSON response: ${resp}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on("error", retry);
    }
    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Server did not start in time"));
        return;
      }
      setTimeout(attempt, 200);
    }
    attempt();
  });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
