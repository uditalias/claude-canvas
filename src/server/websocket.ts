import * as WebSocket from "ws";
import * as http from "http";
import { addClient, removeClient, resolveScreenshot } from "./state.js";

export function attachWebSocket(server: http.Server): WebSocket.WebSocketServer {
  const wss = new WebSocket.WebSocketServer({ server });

  wss.on("connection", (ws) => {
    addClient(ws);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "screenshot_response" && msg.payload) {
          if (typeof msg.payload === "string") {
            resolveScreenshot({ image: msg.payload, answers: [] });
          } else {
            resolveScreenshot(msg.payload);
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => removeClient(ws));
    ws.on("error", () => removeClient(ws));
  });

  return wss;
}
