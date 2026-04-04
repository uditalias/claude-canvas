import * as WebSocket from "ws";
import type { Answer } from "../protocol/types.js";

interface ServerState {
  clients: Set<WebSocket.WebSocket>;
  pendingScreenshot: ((data: { image: string; answers: Answer[] }) => void) | null;
  pendingExport: ((data: string) => void) | null;
}

const state: ServerState = {
  clients: new Set(),
  pendingScreenshot: null,
  pendingExport: null,
};

export function addClient(ws: WebSocket.WebSocket): void {
  state.clients.add(ws);
}

export function removeClient(ws: WebSocket.WebSocket): void {
  state.clients.delete(ws);
}

function broadcast(msg: string): void {
  for (const client of state.clients) {
    if (client.readyState === WebSocket.WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function broadcastDraw(payload: unknown): void {
  broadcast(JSON.stringify({ type: "draw", payload }));
}

export function broadcastAsk(payload: unknown): void {
  broadcast(JSON.stringify({ type: "ask", payload }));
}

export function broadcastClear(layer?: string): void {
  broadcast(JSON.stringify({ type: "clear", payload: layer || null }));
}

export function requestScreenshot(): Promise<{ image: string; answers: Answer[] }> {
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

    state.pendingScreenshot = (data: { image: string; answers: Answer[] }) => {
      clearTimeout(timeout);
      state.pendingScreenshot = null;
      resolve(data);
    };

    const msg = JSON.stringify({ type: "screenshot_request" });
    clients[0].send(msg);
  });
}

export function resolveScreenshot(data: { image: string; answers: Answer[] }): void {
  if (state.pendingScreenshot) {
    state.pendingScreenshot(data);
  }
}

export function requestExport(format: string, labels: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const clients = [...state.clients].filter(
      (c) => c.readyState === WebSocket.WebSocket.OPEN
    );
    if (clients.length === 0) {
      return reject(new Error("No browser clients connected"));
    }
    const timeout = setTimeout(() => {
      state.pendingExport = null;
      reject(new Error("Export timeout — browser did not respond"));
    }, 10000);

    state.pendingExport = (data: string) => {
      clearTimeout(timeout);
      state.pendingExport = null;
      resolve(data);
    };

    clients[0].send(JSON.stringify({
      type: "export_request",
      payload: { format, labels },
    }));
  });
}

export function resolveExport(data: string): void {
  if (state.pendingExport) {
    state.pendingExport(data);
  }
}

export function getClientCount(): number {
  return state.clients.size;
}
