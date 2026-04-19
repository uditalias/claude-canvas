import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

let tempDir: string;

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return {
    ...actual,
    default: actual,
    homedir: () => tempDir,
  };
});

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// Dynamic import so the mock is active when the module evaluates SESSION_DIR.
// But SESSION_DIR is computed at module load time as a const. We need to re-import each time.
// Actually, since SESSION_DIR uses os.homedir() which is now our mock function,
// and our mock reads `tempDir` dynamically, it should work as long as the module
// calls os.homedir() at function call time, not module load time.
// Looking at process.ts: SESSION_DIR is a top-level const, so it's evaluated once.
// We need to work around this.

// The solution: we must use vi.mock at the module level AND ensure process.ts
// re-evaluates. Since SESSION_DIR is a top-level const computed once, we need
// to re-import the module for each test. Let's use dynamic imports with vi.resetModules.

// Actually, let me re-check: the mock returns `tempDir` which is a closure variable
// that changes each test. But SESSION_DIR = path.join(os.homedir(), ...) is evaluated
// once when the module is first imported. So we need resetModules.

describe("process module tests", () => {
  let mod: typeof import("../../src/server/process.js");

  beforeEach(async () => {
    vi.resetModules();
    mod = await import("../../src/server/process.js");
  });

  describe("generateSessionId", () => {
    it("returns an 8-character string", () => {
      const id = mod.generateSessionId();
      expect(typeof id).toBe("string");
      expect(id).toHaveLength(8);
    });

    it("returns unique values on successive calls", () => {
      const ids = new Set(Array.from({ length: 20 }, () => mod.generateSessionId()));
      expect(ids.size).toBe(20);
    });
  });

  describe("writeSession + readSession", () => {
    it("round-trips a session", () => {
      const session = { pid: 1234, port: 7890, createdAt: "2026-01-01T00:00:00.000Z" };
      mod.writeSession("abc", session);
      const read = mod.readSession("abc");
      expect(read).toEqual(session);
    });

    it("readSession returns null for non-existent id", () => {
      expect(mod.readSession("nonexistent")).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("removes a session file", () => {
      mod.writeSession("todelete", { pid: 1, port: 1000, createdAt: "2026-01-01T00:00:00.000Z" });
      expect(mod.readSession("todelete")).not.toBeNull();
      mod.clearSession("todelete");
      expect(mod.readSession("todelete")).toBeNull();
    });

    it("does not throw for non-existent session", () => {
      expect(() => mod.clearSession("nope")).not.toThrow();
    });
  });

  describe("listSessionIds", () => {
    it("returns all session IDs from disk", () => {
      mod.writeSession("aaa", { pid: 1, port: 1000, createdAt: "2026-01-01T00:00:00.000Z" });
      mod.writeSession("bbb", { pid: 2, port: 1001, createdAt: "2026-01-01T00:00:00.000Z" });
      mod.writeSession("ccc", { pid: 3, port: 1002, createdAt: "2026-01-01T00:00:00.000Z" });
      const ids = mod.listSessionIds();
      expect(ids.sort()).toEqual(["aaa", "bbb", "ccc"]);
    });

    it("returns empty array when no sessions exist", () => {
      const ids = mod.listSessionIds();
      expect(ids).toEqual([]);
    });

    it("migrates old single-session file", () => {
      const dotDir = path.join(tempDir, ".claude-canvas");
      fs.mkdirSync(dotDir, { recursive: true });
      fs.writeFileSync(
        path.join(dotDir, "session.json"),
        JSON.stringify({ pid: 42, port: 7890 })
      );
      const ids = mod.listSessionIds();
      expect(ids).toHaveLength(1);
      expect(fs.existsSync(path.join(dotDir, "session.json"))).toBe(false);
      const session = mod.readSession(ids[0]);
      expect(session).not.toBeNull();
      expect(session!.pid).toBe(42);
      expect(session!.port).toBe(7890);
    });
  });

  describe("listAliveSessions", () => {
    it("returns only sessions with alive PIDs and cleans up stale ones", () => {
      mod.writeSession("alive1", { pid: process.pid, port: 7890, createdAt: "2026-01-01T00:00:00.000Z" });
      mod.writeSession("dead1", { pid: 999999, port: 7891, createdAt: "2026-01-01T00:00:00.000Z" });

      const alive = mod.listAliveSessions();
      expect(alive).toHaveLength(1);
      expect(alive[0].id).toBe("alive1");
      expect(alive[0].session.pid).toBe(process.pid);

      // Stale session file should have been cleaned up
      expect(mod.readSession("dead1")).toBeNull();
    });
  });

  describe("resolveSession", () => {
    it("with explicit ID returns that session", () => {
      mod.writeSession("explicit", { pid: process.pid, port: 7890, createdAt: "2026-01-01T00:00:00.000Z" });
      const result = mod.resolveSession("explicit");
      expect(result.id).toBe("explicit");
      expect(result.session.port).toBe(7890);
    });

    it("with one alive session auto-resolves", () => {
      mod.writeSession("only", { pid: process.pid, port: 8000, createdAt: "2026-01-01T00:00:00.000Z" });
      const result = mod.resolveSession();
      expect(result.id).toBe("only");
      expect(result.session.port).toBe(8000);
    });

    it("with zero sessions calls process.exit(1)", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });
      expect(() => mod.resolveSession()).toThrow("exit");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("with multiple alive sessions calls process.exit(1)", () => {
      // process.pid and process.ppid are both alive
      mod.writeSession("s1", { pid: process.pid, port: 7890, createdAt: "2026-01-01T00:00:00.000Z" });
      mod.writeSession("s2", { pid: process.ppid, port: 7891, createdAt: "2026-01-01T00:00:00.000Z" });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });
      expect(() => mod.resolveSession()).toThrow("exit");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("with explicit ID that is not alive calls process.exit(1)", () => {
      mod.writeSession("dead", { pid: 999999, port: 7890, createdAt: "2026-01-01T00:00:00.000Z" });
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });
      expect(() => mod.resolveSession("dead")).toThrow("exit");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("buildSpawnEnv", () => {
    it("sets PORT and CANVAS_HOST when host is provided", () => {
      const env = mod.buildSpawnEnv(7891, "0.0.0.0");
      expect(env.PORT).toBe("7891");
      expect(env.CANVAS_HOST).toBe("0.0.0.0");
    });

    it("sets PORT and omits CANVAS_HOST when no host is provided", () => {
      const env = mod.buildSpawnEnv(7890);
      expect(env.PORT).toBe("7890");
      expect(env.CANVAS_HOST).toBeUndefined();
    });

    it("inherits the ambient process env (e.g. PATH)", () => {
      const env = mod.buildSpawnEnv(7890, "127.0.0.1");
      expect(env.PATH).toBe(process.env.PATH);
    });
  });
});
