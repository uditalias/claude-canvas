import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as http from "http";
import router from "../../src/server/router";

// Helper that returns both status code and parsed body
function request(
  method: "GET" | "POST",
  url: string,
  body?: unknown
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {},
    };
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    if (data) {
      options.headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      };
    }
    const req = http.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(resp) });
        } catch {
          resolve({ status: res.statusCode!, body: resp });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

describe("Server Router", () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  // --- GET /health ---

  it("GET /health returns status ok and client count", async () => {
    const res = await request("GET", `${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", clients: 0 });
  });

  // --- POST /api/draw ---

  it("POST /api/draw with valid commands returns ok", async () => {
    const payload = {
      commands: [
        { type: "rect", x: 10, y: 20, width: 100, height: 50 },
        { type: "circle", x: 200, y: 200, radius: 40 },
      ],
    };
    const res = await request("POST", `${baseUrl}/api/draw`, payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, commands: 2 });
  });

  it("POST /api/draw returns 400 when commands array is missing", async () => {
    const res = await request("POST", `${baseUrl}/api/draw`, { foo: "bar" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commands array required/);
  });

  it("POST /api/draw returns 400 when body is empty", async () => {
    const res = await request("POST", `${baseUrl}/api/draw`, {});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commands array required/);
  });

  it("POST /api/draw returns 400 when commands is not an array", async () => {
    const res = await request("POST", `${baseUrl}/api/draw`, {
      commands: "not-an-array",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commands array required/);
  });

  // --- POST /api/clear ---

  it("POST /api/clear returns ok", async () => {
    const res = await request("POST", `${baseUrl}/api/clear`, {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("POST /api/clear?layer=claude returns ok", async () => {
    const res = await request("POST", `${baseUrl}/api/clear?layer=claude`, {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  // --- POST /api/ask ---

  it("POST /api/ask returns 500 with disconnect status when no clients", async () => {
    const payload = {
      questions: [
        { id: "q1", text: "Pick one", type: "single", options: ["A", "B"], commands: [] },
      ],
    };
    const res = await request("POST", `${baseUrl}/api/ask`, payload);
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.status).toBe("disconnected");
    expect(res.body.error).toMatch(/No browser clients connected/);
  });

  it("POST /api/ask returns 400 when questions array is missing", async () => {
    const res = await request("POST", `${baseUrl}/api/ask`, { data: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/questions array required/);
  });

  it("POST /api/ask returns 400 when questions is not an array", async () => {
    const res = await request("POST", `${baseUrl}/api/ask`, {
      questions: "nope",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/questions array required/);
  });

  // --- GET /api/screenshot (no clients) ---

  it("GET /api/screenshot returns 500 when no clients connected", async () => {
    const res = await request("GET", `${baseUrl}/api/screenshot`);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/No browser clients connected/);
  });

  // --- GET /api/export (no clients) ---

  it("GET /api/export returns 500 when no clients connected", async () => {
    const res = await request("GET", `${baseUrl}/api/export`);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/No browser clients connected/);
  });
});
