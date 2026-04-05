#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

// Skip in CI or test environments
if (process.env.CI || process.env.NODE_ENV === "test") {
  process.exit(0);
}

const SKILL_DEST = path.join(os.homedir(), ".claude", "skills", "claude-canvas", "SKILL.md");
const skillInstalled = fs.existsSync(SKILL_DEST);

console.log("");
console.log("  \x1b[1m\x1b[36m✨ claude-canvas installed successfully!\x1b[0m");
console.log("");
console.log("  claude-canvas is a visual canvas tool for \x1b[1mClaude Code\x1b[0m.");
console.log("  Instead of asking questions in the terminal, Claude can draw diagrams,");
console.log("  wireframes, and mockups on a shared canvas and collect visual feedback");
console.log("  from you directly in the browser.");
console.log("");

if (skillInstalled) {
  // Check if the skill needs updating
  const SKILL_SOURCE = path.resolve(__dirname, "../src/skill/claude-canvas/SKILL.md");
  try {
    const installed = fs.readFileSync(SKILL_DEST, "utf-8");
    const bundled = fs.readFileSync(SKILL_SOURCE, "utf-8");
    if (installed !== bundled) {
      fs.copyFileSync(SKILL_SOURCE, SKILL_DEST);
      console.log("  \x1b[1m\x1b[32m✓\x1b[0m Skill updated to the latest version.");
      console.log("");
    }
  } catch {
    // Ignore errors — user can run setup manually
  }
} else {
  console.log("  \x1b[1m\x1b[33m⚠  Important:\x1b[0m To let Claude use this tool automatically,");
  console.log("  install the skill by running:");
  console.log("");
  console.log("    \x1b[33mclaude-canvas setup\x1b[0m");
  console.log("");
}

console.log("  \x1b[1mGet started:\x1b[0m");
console.log("    \x1b[33mclaude-canvas start\x1b[0m      Open a new canvas session");
console.log("    \x1b[33mclaude-canvas --help\x1b[0m      See all available commands");
console.log("");
