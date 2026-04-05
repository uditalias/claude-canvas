import { describe, it, expect, beforeEach } from "vitest";
import {
  addClient,
  removeClient,
  getClientCount,
  broadcastDraw,
  broadcastAsk,
  broadcastClear,
  requestScreenshot,
  resolveScreenshot,
  requestExport,
  resolveExport,
  requestAskWithAnswers,
  resolveAskAnswers,
  rejectAskAnswers,
  hasPendingAsk,
} from "../../src/server/state.js";
// WebSocket readyState constants (matches the ws module)
const WS_OPEN = 1;
const WS_CLOSED = 3;

function createMockWs(open = true): any {
  const messages: string[] = [];
  return {
    readyState: open ? WS_OPEN : WS_CLOSED,
    send: (msg: string) => messages.push(msg),
    messages,
  };
}

// Helper to remove all clients between tests
function clearAllClients(clients: any[]) {
  for (const c of clients) {
    removeClient(c);
  }
}

describe("state", () => {
  const tracked: any[] = [];

  function trackClient(open = true) {
    const ws = createMockWs(open);
    tracked.push(ws);
    return ws;
  }

  beforeEach(() => {
    clearAllClients(tracked);
    tracked.length = 0;
  });

  describe("addClient / removeClient / getClientCount", () => {
    it("starts with zero clients", () => {
      expect(getClientCount()).toBe(0);
    });

    it("increments count when a client is added", () => {
      const ws = trackClient();
      addClient(ws);
      expect(getClientCount()).toBe(1);
    });

    it("decrements count when a client is removed", () => {
      const ws = trackClient();
      addClient(ws);
      removeClient(ws);
      expect(getClientCount()).toBe(0);
    });

    it("tracks multiple clients", () => {
      const ws1 = trackClient();
      const ws2 = trackClient();
      addClient(ws1);
      addClient(ws2);
      expect(getClientCount()).toBe(2);
    });

    it("removing a non-existent client is a no-op", () => {
      const ws = trackClient();
      removeClient(ws);
      expect(getClientCount()).toBe(0);
    });
  });

  describe("broadcast", () => {
    it("broadcastDraw sends to all OPEN clients", () => {
      const ws1 = trackClient(true);
      const ws2 = trackClient(true);
      addClient(ws1);
      addClient(ws2);

      broadcastDraw({ commands: [{ type: "rect" }] });

      const expected = JSON.stringify({ type: "draw", payload: { commands: [{ type: "rect" }] } });
      expect(ws1.messages).toEqual([expected]);
      expect(ws2.messages).toEqual([expected]);
    });

    it("broadcastDraw skips closed clients", () => {
      const wsOpen = trackClient(true);
      const wsClosed = trackClient(false);
      addClient(wsOpen);
      addClient(wsClosed);

      broadcastDraw({ test: true });

      expect(wsOpen.messages).toHaveLength(1);
      expect(wsClosed.messages).toHaveLength(0);
    });

    it("broadcastAsk wraps payload as { type: 'ask', payload }", () => {
      const ws = trackClient(true);
      addClient(ws);

      const questions = { questions: [{ id: "q1", text: "Pick one" }] };
      broadcastAsk(questions);

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "ask", payload: questions });
    });

    it("broadcastClear sends layer as payload", () => {
      const ws = trackClient(true);
      addClient(ws);

      broadcastClear("claude");

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "clear", payload: "claude" });
    });

    it("broadcastClear sends null when no layer specified", () => {
      const ws = trackClient(true);
      addClient(ws);

      broadcastClear();

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "clear", payload: null });
    });

    it("broadcastClear sends null for empty string layer", () => {
      const ws = trackClient(true);
      addClient(ws);

      broadcastClear("");

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "clear", payload: null });
    });
  });

  describe("requestScreenshot", () => {
    it("rejects when no clients connected", async () => {
      await expect(requestScreenshot()).rejects.toThrow("No browser clients connected");
    });

    it("rejects when all clients are closed", async () => {
      const ws = trackClient(false);
      addClient(ws);

      await expect(requestScreenshot()).rejects.toThrow("No browser clients connected");
    });

    it("sends screenshot_request to the first open client", () => {
      const ws = trackClient(true);
      addClient(ws);

      // Don't await — we just want to check the message was sent
      const promise = requestScreenshot();

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "screenshot_request" });

      // Resolve to avoid unhandled rejection
      resolveScreenshot({ image: "data:image/png;base64,abc", answers: [] });
      return promise;
    });

    it("resolves when resolveScreenshot is called", async () => {
      const ws = trackClient(true);
      addClient(ws);

      const promise = requestScreenshot();
      const data = { image: "data:image/png;base64,abc", answers: [{ questionId: "q1", value: "A" }] };
      resolveScreenshot(data);

      const result = await promise;
      expect(result).toEqual(data);
    });

    it("only sends to the first client", () => {
      const ws1 = trackClient(true);
      const ws2 = trackClient(true);
      addClient(ws1);
      addClient(ws2);

      const promise = requestScreenshot();

      expect(ws1.messages).toHaveLength(1);
      expect(ws2.messages).toHaveLength(0);

      resolveScreenshot({ image: "img", answers: [] });
      return promise;
    });
  });

  describe("requestExport", () => {
    it("rejects when no clients connected", async () => {
      await expect(requestExport("svg", true)).rejects.toThrow("No browser clients connected");
    });

    it("rejects when all clients are closed", async () => {
      const ws = trackClient(false);
      addClient(ws);

      await expect(requestExport("svg", false)).rejects.toThrow("No browser clients connected");
    });

    it("sends export_request to the first open client", () => {
      const ws = trackClient(true);
      addClient(ws);

      const promise = requestExport("svg", true);

      const sent = JSON.parse(ws.messages[0]);
      expect(sent).toEqual({ type: "export_request", payload: { format: "svg", labels: true } });

      resolveExport("<svg></svg>");
      return promise;
    });

    it("resolves when resolveExport is called", async () => {
      const ws = trackClient(true);
      addClient(ws);

      const promise = requestExport("svg", false);
      resolveExport("<svg>content</svg>");

      const result = await promise;
      expect(result).toBe("<svg>content</svg>");
    });
  });

  describe("resolveScreenshot / resolveExport with no pending request", () => {
    it("resolveScreenshot is a no-op when no pending request", () => {
      // Should not throw
      resolveScreenshot({ image: "data", answers: [] });
    });

    it("resolveExport is a no-op when no pending request", () => {
      // Should not throw
      resolveExport("data");
    });
  });

  describe("requestAskWithAnswers", () => {
    it("rejects when no clients connected", async () => {
      const payload = { questions: [{ id: "q1", text: "Pick one", type: "single" as const, options: ["A", "B"] }] };
      await expect(requestAskWithAnswers(payload)).rejects.toThrow("No browser clients connected");
    });

    it("rejects when all clients are closed", async () => {
      const ws = trackClient(false);
      addClient(ws);

      const payload = { questions: [{ id: "q1", text: "Pick one", type: "single" as const, options: ["A", "B"] }] };
      await expect(requestAskWithAnswers(payload)).rejects.toThrow("No browser clients connected");
    });

    it("broadcasts ask payload and returns a promise", () => {
      const ws1 = trackClient(true);
      const ws2 = trackClient(true);
      addClient(ws1);
      addClient(ws2);

      const payload = { questions: [{ id: "q1", text: "Pick one", type: "single" as const, options: ["A", "B"] }] };
      const promise = requestAskWithAnswers(payload);

      expect(hasPendingAsk()).toBe(true);

      const sent1 = JSON.parse(ws1.messages[0]);
      const sent2 = JSON.parse(ws2.messages[0]);
      expect(sent1).toEqual({ type: "ask", payload });
      expect(sent2).toEqual({ type: "ask", payload });

      // Resolve to avoid unhandled rejection
      resolveAskAnswers([{ questionId: "q1", value: "A" }]);
      return promise;
    });

    it("resolves when resolveAskAnswers is called", async () => {
      const ws = trackClient(true);
      addClient(ws);

      const payload = { questions: [{ id: "q1", text: "Pick one", type: "single" as const, options: ["A", "B"] }] };
      const promise = requestAskWithAnswers(payload);

      const answers = [{ questionId: "q1", value: "A" }];
      resolveAskAnswers(answers);

      const result = await promise;
      expect(result).toEqual(answers);
      expect(hasPendingAsk()).toBe(false);
    });

    it("rejects when rejectAskAnswers is called", async () => {
      const ws = trackClient(true);
      addClient(ws);

      const payload = { questions: [{ id: "q1", text: "Pick one", type: "single" as const, options: ["A", "B"] }] };
      const promise = requestAskWithAnswers(payload);

      rejectAskAnswers("Client disconnected");

      await expect(promise).rejects.toThrow("Client disconnected");
      expect(hasPendingAsk()).toBe(false);
    });

    it("resolveAskAnswers is a no-op with no pending request", () => {
      // Should not throw
      resolveAskAnswers([{ questionId: "q1", value: "A" }]);
    });

    it("rejectAskAnswers is a no-op with no pending request", () => {
      // Should not throw
      rejectAskAnswers("some reason");
    });
  });
});
