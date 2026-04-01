import * as WebSocket from "ws";

interface ServerState {
  clients: Set<WebSocket.WebSocket>;
  pendingScreenshot: ((data: string) => void) | null;
}

const state: ServerState = {
  clients: new Set(),
  pendingScreenshot: null,
};

export function addClient(ws: WebSocket.WebSocket): void {
  state.clients.add(ws);
}

export function removeClient(ws: WebSocket.WebSocket): void {
  state.clients.delete(ws);
}

export function broadcastDraw(payload: unknown): void {
  const msg = JSON.stringify({ type: "draw", payload });
  for (const client of state.clients) {
    if (client.readyState === WebSocket.WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function broadcastClear(): void {
  const msg = JSON.stringify({ type: "clear" });
  for (const client of state.clients) {
    if (client.readyState === WebSocket.WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function requestScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clients = [...state.clients].filter(
      (c) => c.readyState === WebSocket.WebSocket.OPEN
    );
    if (clients.length === 0) {
      return reject(new Error("No browser clients connected"));
    }
    const timeout = setTimeout(() => {
      state.pendingScreenshot = null;
      reject(new Error("Screenshot timeout — browser did not respond"));
    }, 10000);

    state.pendingScreenshot = (data: string) => {
      clearTimeout(timeout);
      state.pendingScreenshot = null;
      resolve(data);
    };

    const msg = JSON.stringify({ type: "screenshot_request" });
    clients[0].send(msg);
  });
}

export function resolveScreenshot(data: string): void {
  if (state.pendingScreenshot) {
    state.pendingScreenshot(data);
  }
}

export function getClientCount(): number {
  return state.clients.size;
}
