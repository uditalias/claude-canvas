#!/usr/bin/env node

const { execSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const readline = require("readline");
const { tmpdir } = require("os");

const root = resolve(__dirname, "..");
const pkgPath = resolve(root, "package.json");

// ── helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`\n→ ${cmd}`);
  return execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf-8" }).trim();
}

function die(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function readPkg() {
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

function writePkg(pkg) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

// ── changelog ───────────────────────────────────────────────────────────────

function getLastTag() {
  try {
    return runCapture("git describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function getCommitsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  try {
    return runCapture(`git log ${range} --pretty=format:"- %s (%h)"`)
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildChangelog(version, commits) {
  const date = new Date().toISOString().slice(0, 10);
  const header = `## ${version} (${date})`;
  const body = commits.length > 0 ? commits.join("\n") : "- No notable changes";
  return `${header}\n\n${body}`;
}

function editInEditor(content) {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tmpFile = resolve(tmpdir(), `claude-canvas-changelog-${Date.now()}.md`);
  writeFileSync(tmpFile, content, "utf-8");

  try {
    execSync(`${editor} "${tmpFile}"`, { cwd: root, stdio: "inherit" });
  } catch {
    die("Editor exited with an error");
  }

  return readFileSync(tmpFile, "utf-8").trim();
}

function updateChangelog(entry) {
  const changelogPath = resolve(root, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const existing = readFileSync(changelogPath, "utf-8");
    writeFileSync(changelogPath, entry + "\n\n" + existing);
  } else {
    writeFileSync(changelogPath, "# Changelog\n\n" + entry + "\n");
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolve version
  const pkg = readPkg();
  const currentVersion = pkg.version;

  const parts = currentVersion.split(".").map(Number);
  const choices = {
    patch: [parts[0], parts[1], parts[2] + 1].join("."),
    minor: [parts[0], parts[1] + 1, 0].join("."),
    major: [parts[0] + 1, 0, 0].join("."),
  };

  console.log(`\nCurrent version: ${currentVersion}\n`);
  console.log(`  1) patch → ${choices.patch}`);
  console.log(`  2) minor → ${choices.minor}`);
  console.log(`  3) major → ${choices.major}`);
  console.log(`  4) custom\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  const choice = await ask("Select version bump [1-4]: ");

  let nextVersion;
  switch (choice.trim()) {
    case "1": nextVersion = choices.patch; break;
    case "2": nextVersion = choices.minor; break;
    case "3": nextVersion = choices.major; break;
    case "4": {
      const custom = await ask("Enter version (x.y.z): ");
      if (!SEMVER_RE.test(custom.trim())) { rl.close(); die(`Invalid version: "${custom.trim()}"`); }
      nextVersion = custom.trim();
      break;
    }
    default: rl.close(); die(`Invalid choice: "${choice.trim()}"`);
  }
  rl.close();

  console.log(`\nReleasing ${currentVersion} → ${nextVersion}\n`);

  // 2. Run tests
  console.log("── Running tests ──");
  try {
    run("npm test");
  } catch {
    die("Tests failed. Fix them before releasing.");
  }

  // 3. Bump version in package.json (before build so the binary gets the new version)
  pkg.version = nextVersion;
  writePkg(pkg);
  console.log(`✓ package.json → ${nextVersion}`);

  // 4. Build (picks up the new version from package.json)
  console.log("\n── Building ──");
  try {
    run("npm run build");
  } catch {
    // Restore old version on build failure
    pkg.version = currentVersion;
    writePkg(pkg);
    die("Build failed. Fix it before releasing.");
  }

  // 5. Changelog
  console.log("\n── Changelog ──");
  const lastTag = getLastTag();
  const commits = getCommitsSinceTag(lastTag);
  const draft = buildChangelog(nextVersion, commits);

  console.log("\nAuto-generated changelog:\n");
  console.log(draft);
  console.log("\nOpening editor to review and edit...\n");

  const finalEntry = editInEditor(draft);
  if (!finalEntry) {
    // Restore old version on abort
    pkg.version = currentVersion;
    writePkg(pkg);
    die("Empty changelog. Aborting.");
  }

  updateChangelog(finalEntry);
  console.log("✓ CHANGELOG.md updated");

  // 6. Git commit + tag
  run("git add package.json CHANGELOG.md");
  run(`git commit -m "release: v${nextVersion}"`);
  run(`git tag v${nextVersion}`);

  console.log(`\n✓ Tagged v${nextVersion}`);
  console.log(`\nRun the following to publish:\n`);
  console.log(`  git push && git push --tags\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
