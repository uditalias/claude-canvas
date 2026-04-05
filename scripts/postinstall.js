#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SKILL_SOURCE = path.resolve(__dirname, "../src/skill/claude-canvas/SKILL.md");
const SKILL_DEST_DIR = path.join(os.homedir(), ".claude", "skills", "claude-canvas");
const SKILL_DEST = path.join(SKILL_DEST_DIR, "SKILL.md");
const SKILL_URL =
  "https://github.com/uditalias/claude-canvas/blob/main/src/skill/claude-canvas/SKILL.md";

// Skip in CI or non-interactive environments
if (
  process.env.CI ||
  process.env.NODE_ENV === "test" ||
  !process.stdin.isTTY
) {
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim().toLowerCase()));
  });
}

function print(text) {
  console.log(text);
}

async function main() {
  print("");
  print("  \x1b[1m\x1b[36m✨ claude-canvas installed successfully!\x1b[0m");
  print("");
  print(
    "  claude-canvas is a visual canvas tool for \x1b[1mClaude Code\x1b[0m."
  );
  print(
    "  Instead of asking questions in the terminal, Claude can draw diagrams,"
  );
  print(
    "  wireframes, and mockups on a shared canvas and collect visual feedback"
  );
  print("  from you directly in the browser.");
  print("");
  print("  \x1b[1mHow it works:\x1b[0m");
  print(
    "    1. Claude runs \x1b[33mclaude-canvas start\x1b[0m to open a canvas in your browser"
  );
  print(
    "    2. Claude draws shapes, diagrams, or wireframes on the canvas"
  );
  print(
    "    3. Claude asks you visual questions — you answer by clicking or drawing"
  );
  print(
    "    4. Claude captures your answers with \x1b[33mclaude-canvas screenshot\x1b[0m"
  );
  print("");
  print("  \x1b[1m\x1b[33m⚠  Important:\x1b[0m For Claude to use this tool automatically, you need");
  print("  to install the \x1b[1mclaude-canvas skill\x1b[0m into your Claude Code skills folder.");
  print("");

  const viewSkill = await ask(
    "  Would you like to view the skill before installing? (y/N) "
  );
  if (viewSkill === "y" || viewSkill === "yes") {
    print("");
    print(`  \x1b[4m${SKILL_URL}\x1b[0m`);
    print("");
  }

  const installSkill = await ask(
    "  Install the skill to ~/.claude/skills/? (Y/n) "
  );

  if (installSkill === "n" || installSkill === "no") {
    print("");
    print("  Skipped skill installation. You can install it later with:");
    print("");
    print(
      `    \x1b[33mcp -r $(npm root -g)/claude-canvas/src/skill/claude-canvas ~/.claude/skills/\x1b[0m`
    );
    print("");
  } else {
    try {
      fs.mkdirSync(SKILL_DEST_DIR, { recursive: true });
      fs.copyFileSync(SKILL_SOURCE, SKILL_DEST);
      print("");
      print(
        `  \x1b[1m\x1b[32m✓\x1b[0m Skill installed to \x1b[36m${SKILL_DEST}\x1b[0m`
      );
      print("");
    } catch (err) {
      print("");
      print(`  \x1b[31m✗ Failed to install skill: ${err.message}\x1b[0m`);
      print("  You can install it manually:");
      print("");
      print(
        `    \x1b[33mcp -r $(npm root -g)/claude-canvas/src/skill/claude-canvas ~/.claude/skills/\x1b[0m`
      );
      print("");
    }
  }

  print("  \x1b[1mGet started:\x1b[0m");
  print("    \x1b[33mclaude-canvas start\x1b[0m      Open a new canvas session");
  print(
    "    \x1b[33mclaude-canvas --help\x1b[0m      See all available commands"
  );
  print("");

  rl.close();
}

main().catch(() => {
  rl.close();
  process.exit(0);
});
