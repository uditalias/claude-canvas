import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Run the CLI via tsx so we test the TypeScript source directly.
 * HOME is set to an isolated temp dir so no real session.json is found.
 */
function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx src/bin/claude-canvas.ts ${args}`, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 15000,
      env: { ...process.env, HOME: "/tmp/test-claude-canvas-home" },
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status || 1,
    };
  }
}

describe("CLI", () => {
  it("--version prints the version number", () => {
    const result = runCli("--version");
    const output = result.stdout + result.stderr;
    expect(output).toContain("1.0.0");
  });

  it("--help lists available commands", () => {
    const result = runCli("--help");
    const output = result.stdout + result.stderr;
    expect(output).toContain("start");
    expect(output).toContain("stop");
    expect(output).toContain("draw");
    expect(output).toContain("ask");
    expect(output).toContain("clear");
    expect(output).toContain("screenshot");
    expect(output).toContain("export");
  });

  it("draw without running server prints error and exits with code 1", () => {
    const result = runCli('draw \'{"commands":[]}\'');
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });

  it("screenshot without running server prints error and exits with code 1", () => {
    const result = runCli("screenshot");
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });

  it("clear without running server prints error and exits with code 1", () => {
    const result = runCli("clear");
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });
});
