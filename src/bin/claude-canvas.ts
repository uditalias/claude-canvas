#!/usr/bin/env node
import { Command } from "commander";
import * as http from "http";
import { findAvailablePort } from "../utils/port.js";
import { openBrowser } from "../utils/open-browser.js";
import {
  readSession,
  writeSession,
  clearSession,
  isAlive,
  spawnServer,
} from "../server/process.js";

const program = new Command();
program.name("claude-canvas").description("Shared visual canvas for Claude Code").version("1.0.0");

// ── start ───────────────────────────────────────────────────────────────────
program
  .command("start")
  .description("Start the canvas server and open the browser")
  .option("-p, --port <port>", "preferred port", "7890")
  .action(async (opts) => {
    const existing = readSession();
    if (existing && isAlive(existing.pid)) {
      console.log(`Canvas already running at http://127.0.0.1:${existing.port} (PID ${existing.pid})`);
      await openBrowser(`http://127.0.0.1:${existing.port}`);
      return;
    }

    const port = await findAvailablePort(parseInt(opts.port, 10));
    const child = spawnServer(port);
    const pid = child.pid!;
    writeSession({ pid, port });

    // Wait briefly for the server to be ready
    await waitForServer(port, 5000);
    console.log(`Canvas started at http://127.0.0.1:${port} (PID ${pid})`);
    await openBrowser(`http://127.0.0.1:${port}`);
  });

// ── stop ────────────────────────────────────────────────────────────────────
program
  .command("stop")
  .description("Stop the canvas server")
  .action(() => {
    const session = readSession();
    if (!session) {
      console.log("No canvas session found.");
      return;
    }
    if (!isAlive(session.pid)) {
      console.log("Server is not running. Cleaning up session.");
      clearSession();
      return;
    }
    try {
      process.kill(session.pid, "SIGTERM");
      clearSession();
      console.log(`Canvas server (PID ${session.pid}) stopped.`);
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
  .action(async (json: string, opts: { animate: boolean }) => {
    const session = requireSession();
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

// ── clear ───────────────────────────────────────────────────────────────────
program
  .command("clear")
  .description("Clear the canvas")
  .option("-l, --layer <layer>", "Clear only shapes on this layer (e.g. claude)")
  .action(async (opts: { layer?: string }) => {
    const session = requireSession();
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
  .action(async () => {
    const session = requireSession();
    const res = await httpGet(`http://127.0.0.1:${session.port}/api/screenshot`);
    if (res.path) {
      console.log(res.path);
    } else {
      console.error("Screenshot failed:", res.error);
      process.exit(1);
    }
  });

program.parse();

// ── helpers ──────────────────────────────────────────────────────────────────

function requireSession() {
  const session = readSession();
  if (!session || !isAlive(session.pid)) {
    console.error("Canvas server is not running. Start it with: claude-canvas start");
    process.exit(1);
  }
  return session;
}

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
