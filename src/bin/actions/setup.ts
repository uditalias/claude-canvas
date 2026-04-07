import { readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { getCurrentDir } from "../version.js";

export async function setupAction() {
  const baseDir = getCurrentDir();
  const skillSourceDir = resolve(baseDir, "../../src/skill/claude-canvas");
  const skillSource = join(skillSourceDir, "SKILL.md");
  const dslRefSource = join(skillSourceDir, "DSL-REFERENCE.md");
  const skillDestDir = join(homedir(), ".claude", "skills", "claude-canvas");
  const skillDest = join(skillDestDir, "SKILL.md");
  const dslRefDest = join(skillDestDir, "DSL-REFERENCE.md");
  const skillUrl = "https://github.com/uditalias/claude-canvas/blob/main/src/skill/claude-canvas/SKILL.md";

  if (!existsSync(skillSource)) {
    console.error("Skill source not found. Try reinstalling claude-canvas.");
    process.exit(1);
  }

  const bundled = readFileSync(skillSource, "utf-8");
  const installed = existsSync(skillDest) ? readFileSync(skillDest, "utf-8") : null;

  const bundledDslRef = existsSync(dslRefSource) ? readFileSync(dslRefSource, "utf-8") : null;
  const installedDslRef = existsSync(dslRefDest) ? readFileSync(dslRefDest, "utf-8") : null;

  const skillUpToDate = installed !== null && installed === bundled;
  const dslRefUpToDate = bundledDslRef === null || (installedDslRef !== null && installedDslRef === bundledDslRef);

  console.log("");
  if (skillUpToDate && dslRefUpToDate) {
    console.log("  \x1b[1m\x1b[32m✓\x1b[0m Skill is already installed and up to date.");
    console.log(`    \x1b[2m${skillDest}\x1b[0m`);
    console.log("");
    return;
  }

  const isUpdate = installed !== null || installedDslRef !== null;
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
      if (bundledDslRef) {
        copyFileSync(dslRefSource, dslRefDest);
      }
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
}
