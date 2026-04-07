import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

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

describe("CLI --dsl flag", () => {
  it("draw --dsl with invalid DSL prints parse error", () => {
    const result = runCli('draw --dsl "invalidstuff"');
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    // Should contain a DSL parse error, not "Invalid JSON"
    expect(output).not.toContain("Invalid JSON");
  });

  it("ask --dsl with invalid DSL prints parse error", () => {
    const result = runCli('ask --dsl "invalidstuff"');
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).not.toContain("Invalid JSON");
  });

  it("draw --dsl without server prints session error (DSL parsed OK)", () => {
    const result = runCli("draw --dsl 'box \"A\" 200x100'");
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });

  it("ask --dsl without server prints session error (DSL parsed OK)", () => {
    const result = runCli("ask --dsl 'ask { question #q1 text \"Hi?\" }'");
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });

  it("draw without --dsl still works with JSON", () => {
    const result = runCli('draw \'{"commands":[]}\'');
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("No canvas session is running");
  });
});
