#!/usr/bin/env node
import { Command } from "commander";
import { getVersion } from "./version.js";
import { startAction } from "./actions/start.js";
import { stopAction } from "./actions/stop.js";
import { listAction } from "./actions/list.js";
import { statusAction } from "./actions/status.js";
import { drawAction } from "./actions/draw.js";
import { askAction } from "./actions/ask.js";
import { clearAction } from "./actions/clear.js";
import { screenshotAction } from "./actions/screenshot.js";
import { exportAction } from "./actions/export.js";
import { updateAction } from "./actions/update.js";
import { setupAction } from "./actions/setup.js";

const program = new Command();
program.name("claude-canvas").description("Shared visual canvas for Claude Code").version(getVersion());

program
  .command("start")
  .description("Start the canvas server and open the browser")
  .option("-p, --port <port>", "preferred port", "7890")
  .option("--host <host>", "bind address (default: 127.0.0.1, or 0.0.0.0 when running inside a container). Also via CANVAS_HOST env var")
  .action(startAction);

program
  .command("stop")
  .description("Stop the canvas server")
  .option("-s, --session <id>", "Session ID")
  .option("--all", "Stop all running sessions")
  .action(stopAction);

program
  .command("list")
  .description("List all running canvas sessions")
  .action(listAction);

program
  .command("status")
  .description("Send a status message to the canvas dashboard")
  .argument("<text>", "Status text to display (use empty string to clear)")
  .option("-s, --session <id>", "Session ID")
  .action(statusAction);

program
  .command("draw")
  .description("Send draw commands to the canvas")
  .argument("<input>", "DrawPayload JSON/DSL string or - to read from stdin")
  .option("--dsl", "Parse input as DSL instead of JSON")
  .option("--no-animate", "Render shapes instantly without animation")
  .option("-s, --session <id>", "Session ID")
  .action(drawAction);

program
  .command("ask")
  .description("Send visual questions to the user")
  .argument("<input>", "AskPayload JSON/DSL string or - to read from stdin")
  .option("--dsl", "Parse input as DSL instead of JSON")
  .option("-s, --session <id>", "Session ID")
  .action(askAction);

program
  .command("clear")
  .description("Clear the canvas")
  .option("-l, --layer <layer>", "Clear only shapes on this layer (e.g. claude)")
  .option("-s, --session <id>", "Session ID")
  .action(clearAction);

program
  .command("screenshot")
  .description("Capture the canvas as a PNG")
  .option("-s, --session <id>", "Session ID")
  .action(screenshotAction);

program
  .command("export")
  .description("Export the canvas as PNG, SVG, or JSON")
  .option("-f, --format <format>", "Export format: png, svg, or json", "png")
  .option("--labels", "Include shape labels in export", false)
  .option("-s, --session <id>", "Session ID")
  .action(exportAction);

program
  .command("update")
  .description("Check for updates and install the latest version")
  .action(updateAction);

program
  .command("setup")
  .description("Install or update the Claude Code skill for canvas")
  .action(setupAction);

program.parse();
