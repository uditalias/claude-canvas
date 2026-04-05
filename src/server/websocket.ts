import * as WebSocket from "ws";
import * as http from "http";
import { addClient, removeClient, resolveScreenshot, resolveExport, resolveAskAnswers, rejectAskAnswers, hasPendingAsk } from "./state.js";

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
        if (msg.type === "export_response" && msg.payload) {
          resolveExport(msg.payload as string);
        }
        if (msg.type === "answers_submitted" && msg.payload) {
          resolveAskAnswers(msg.payload);
        }
      } catch {
        // ignore malformed messages
      }
    });

    const onDisconnect = () => {
      removeClient(ws);
      if (hasPendingAsk()) {
        rejectAskAnswers("Browser disconnected before answers were submitted");
      }
    };

    ws.on("close", onDisconnect);
    ws.on("error", onDisconnect);
  });

  return wss;
}
