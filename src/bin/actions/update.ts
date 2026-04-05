import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { fetchLatestVersion } from "../utils.js";
import { getCurrentDir, getVersion } from "../version.js";

export async function updateAction() {
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
}
