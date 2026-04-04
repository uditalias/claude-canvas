import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { attachWebSocket } from "../../src/server/websocket.js";
import {
  getClientCount,
  requestScreenshot,
  requestExport,
} from "../../src/server/state.js";

describe("WebSocket Server", () => {
  let server: http.Server;
  let port: number;
  let wss: WebSocketServer;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    server = http.createServer();
    wss = attachWebSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of openClients) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    wss.close();
    server.close();
    // Wait for everything to settle
    await new Promise((r) => setTimeout(r, 100));
  });

  afterEach(async () => {
    // Close all clients opened during the test
    const closing = openClients.map(
      (ws) =>
        new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.on("close", () => resolve());
            ws.close();
          } else {
            resolve();
          }
        })
    );
    await Promise.all(closing);
    openClients.length = 0;
    // Give the server a moment to process close events
    await new Promise((r) => setTimeout(r, 50));
  });

  function connectClient(): Promise<WebSocket> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      openClients.push(ws);
      ws.on("open", () => resolve(ws));
    });
  }

  it("increments client count on connect", async () => {
    const before = getClientCount();
    const ws = await connectClient();
    expect(getClientCount()).toBe(before + 1);
    // cleanup handled by afterEach
  });

  it("decrements client count on disconnect", async () => {
    const ws = await connectClient();
    const countWhileConnected = getClientCount();
    expect(countWhileConnected).toBeGreaterThanOrEqual(1);

    // Close and wait for server to process
    await new Promise<void>((resolve) => {
      ws.on("close", () => resolve());
      ws.close();
    });
    // Remove from tracked clients since we manually closed
    openClients.splice(openClients.indexOf(ws), 1);
    await new Promise((r) => setTimeout(r, 50));

    expect(getClientCount()).toBe(countWhileConnected - 1);
  });

  it("resolves screenshot_response with object payload", async () => {
    const ws = await connectClient();

    // Wait for connection to be registered, then request screenshot
    const screenshotPromise = requestScreenshot();

    // The server sends a screenshot_request to the client; respond to it
    await new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "screenshot_request") {
          ws.send(
            JSON.stringify({
              type: "screenshot_response",
              payload: {
                image: "data:image/png;base64,ABC123",
                answers: [{ questionId: "q1", value: "Option A" }],
              },
            })
          );
          resolve();
        }
      });
    });

    const result = await screenshotPromise;
    expect(result.image).toBe("data:image/png;base64,ABC123");
    expect(result.answers).toEqual([{ questionId: "q1", value: "Option A" }]);
  });

  it("resolves screenshot_response with string payload (legacy)", async () => {
    const ws = await connectClient();

    const screenshotPromise = requestScreenshot();

    await new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "screenshot_request") {
          ws.send(
            JSON.stringify({
              type: "screenshot_response",
              payload: "data:image/png;base64,LEGACY",
            })
          );
          resolve();
        }
      });
    });

    const result = await screenshotPromise;
    expect(result.image).toBe("data:image/png;base64,LEGACY");
    expect(result.answers).toEqual([]);
  });

  it("resolves export_response", async () => {
    const ws = await connectClient();

    const exportPromise = requestExport("svg", true);

    await new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "export_request") {
          ws.send(
            JSON.stringify({
              type: "export_response",
              payload: "<svg>...</svg>",
            })
          );
          resolve();
        }
      });
    });

    const result = await exportPromise;
    expect(result).toBe("<svg>...</svg>");
  });

  it("silently ignores malformed messages", async () => {
    const ws = await connectClient();
    // Send invalid JSON - should not crash the server
    ws.send("this is not json{{{");
    // Give server time to process
    await new Promise((r) => setTimeout(r, 50));
    // Server should still be functional - client count unchanged
    expect(getClientCount()).toBeGreaterThanOrEqual(1);
  });

  it("silently ignores unknown message types", async () => {
    const ws = await connectClient();
    ws.send(JSON.stringify({ type: "unknown_type", payload: "whatever" }));
    await new Promise((r) => setTimeout(r, 50));
    // Server should still be functional
    expect(getClientCount()).toBeGreaterThanOrEqual(1);
  });
});
