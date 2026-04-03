import { useEffect, useRef, useCallback } from "react";
import type { WsMessage } from "../lib/protocol";

interface UseWebSocketOptions {
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectDelay = 1000;

    function connect() {
      if (disposed) return;

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay = 1000; // reset on successful connection
        window.dispatchEvent(
          new CustomEvent("ws-status", { detail: "connected" })
        );
      };

      ws.onclose = () => {
        window.dispatchEvent(
          new CustomEvent("ws-status", { detail: "disconnected" })
        );
        if (!disposed) {
          reconnectTimer = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000); // 1s, 2s, 4s, 8s... max 30s
        }
      };

      ws.onmessage = (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        onMessageRef.current(msg);
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
