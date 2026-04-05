#!/usr/bin/env node
import { Command } from "commander";
import * as http from "http";
import * as https from "https";
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

import { readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

declare const PACKAGE_VERSION: string;

// Resolve the directory of this file in both CJS (esbuild bundle) and ESM (tsx dev) contexts.
// The indirect eval prevents esbuild from statically analyzing import.meta in CJS output.
function getCurrentDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  // ESM fallback for dev/test (tsx)
  const { fileURLToPath } = require("node:url");
  const meta = (0, eval)("import.meta");
  return dirname(fileURLToPath(meta.url));
}

// PACKAGE_VERSION is injected by esbuild at build time.
// Falls back to reading package.json for dev/test (tsx).
function getVersion(): string {
  if (typeof PACKAGE_VERSION !== "undefined") return PACKAGE_VERSION;
  try {
    const pkg = JSON.parse(readFileSync(resolve(getCurrentDir(), "../../package.json"), "utf-8"));
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

// ── update ──────────────────────────────────────────────────────────────────
program
  .command("update")
  .description("Check for updates and install the latest version")
  .action(async () => {
    const currentVersion = getVersion();
    console.log(`Current version: ${currentVersion}`);
    console.log("Checking for updates...");

    try {
      const latest = await fetchLatestVersion();
      if (latest === currentVersion) {
        console.log("You are already on the latest version.");
        return;
      }
      console.log(`New version available: ${latest}`);
      console.log("Updating...");

      const { execSync } = await import("child_process");
      execSync("npm install -g claude-canvas@latest", { stdio: "inherit" });
      console.log(`Successfully updated to ${latest}`);

      // Check if the installed skill needs updating
      const skillDestDir = join(homedir(), ".claude", "skills", "claude-canvas");
      const skillDest = join(skillDestDir, "SKILL.md");
      if (existsSync(skillDest)) {
        const updateBaseDir = getCurrentDir();
        const skillSourceDir = resolve(updateBaseDir, "../../src/skill/claude-canvas");
        const skillSource = join(skillSourceDir, "SKILL.md");
        if (existsSync(skillSource)) {
          const installed = readFileSync(skillDest, "utf-8");
          const bundled = readFileSync(skillSource, "utf-8");
          if (installed !== bundled) {
            copyFileSync(skillSource, skillDest);
            console.log("\x1b[32m✓\x1b[0m Claude Code skill updated to the latest version.");
          }
        }
      }
    } catch (err) {
      console.error("Update failed:", (err as Error).message);
      process.exit(1);
    }
  });

// ── setup ──────────────────────────────────────────────────────────────────
program
  .command("setup")
  .description("Install or update the Claude Code skill for canvas")
  .action(async () => {
    const baseDir = getCurrentDir();
    const skillSourceDir = resolve(baseDir, "../../src/skill/claude-canvas");
    const skillSource = join(skillSourceDir, "SKILL.md");
    const skillDestDir = join(homedir(), ".claude", "skills", "claude-canvas");
    const skillDest = join(skillDestDir, "SKILL.md");
    const skillUrl = "https://github.com/uditalias/claude-canvas/blob/main/src/skill/claude-canvas/SKILL.md";

    if (!existsSync(skillSource)) {
      console.error("Skill source not found. Try reinstalling claude-canvas.");
      process.exit(1);
    }

    const bundled = readFileSync(skillSource, "utf-8");
    const installed = existsSync(skillDest) ? readFileSync(skillDest, "utf-8") : null;

    console.log("");
    if (installed && installed === bundled) {
      console.log("  \x1b[1m\x1b[32m✓\x1b[0m Skill is already installed and up to date.");
      console.log(`    \x1b[2m${skillDest}\x1b[0m`);
      console.log("");
      return;
    }

    const isUpdate = installed !== null;
    console.log(isUpdate
      ? "  \x1b[1m\x1b[33m⚡\x1b[0m A new version of the claude-canvas skill is available."
      : "  \x1b[1m\x1b[36m✨\x1b[0m claude-canvas skill setup");
    console.log("");
    console.log("  The skill lets Claude Code use the canvas tool automatically.");
    console.log("  It will be installed to:");
    console.log(`    \x1b[36m${skillDest}\x1b[0m`);
    console.log("");

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, (a) => resolve(a.trim().toLowerCase())));

    const viewSkill = await ask("  Would you like to view the skill before installing? (y/N) ");
    if (viewSkill === "y" || viewSkill === "yes") {
      console.log("");
      console.log(`  \x1b[4m${skillUrl}\x1b[0m`);
      console.log("");
    }

    const action = isUpdate ? "Update" : "Install";
    const confirm = await ask(`  ${action} the skill to ~/.claude/skills/? (Y/n) `);

    if (confirm === "n" || confirm === "no") {
      console.log("");
      console.log("  Skipped. You can run this again anytime with:");
      console.log("    \x1b[33mclaude-canvas setup\x1b[0m");
      console.log("");
    } else {
      try {
        mkdirSync(skillDestDir, { recursive: true });
        copyFileSync(skillSource, skillDest);
        console.log("");
        console.log(`  \x1b[1m\x1b[32m✓\x1b[0m Skill ${isUpdate ? "updated" : "installed"} to \x1b[36m${skillDest}\x1b[0m`);
        console.log("");
      } catch (err) {
        console.log("");
        console.log(`  \x1b[31m✗ Failed: ${(err as Error).message}\x1b[0m`);
        console.log("  You can install it manually:");
        console.log(`    \x1b[33mcp -r $(npm root -g)/claude-canvas/src/skill/claude-canvas ~/.claude/skills/\x1b[0m`);
        console.log("");
      }
    }

    rl.close();
  });

program.parse();

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get("https://registry.npmjs.org/claude-canvas/latest", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const pkg = JSON.parse(data);
          resolve(pkg.version);
        } catch {
          reject(new Error("Failed to parse npm registry response"));
        }
      });
    }).on("error", reject);
  });
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
