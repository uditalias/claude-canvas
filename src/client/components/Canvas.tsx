import { useRef, useCallback } from "react";
import { useCanvas } from "../hooks/useCanvas";
import { useWebSocket } from "../hooks/useWebSocket";
import { Hud } from "./Hud";
import { Narration, NarrationHandle } from "./Narration";
import type { WsMessage, DrawPayload } from "../lib/protocol";

export function CanvasView() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const narrationRef = useRef<NarrationHandle>(null);
  const sendRef = useRef<(msg: object) => void>(undefined);

  const { renderCommands, clear, takeScreenshot, autopan } = useCanvas(canvasElRef);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "draw") {
        const payload = msg.payload as DrawPayload;
        if (payload?.narration) {
          narrationRef.current?.show(payload.narration);
        }
        if (payload?.commands) {
          const added = renderCommands(payload.commands);
          autopan(added);
        }
      } else if (msg.type === "clear") {
        clear();
      } else if (msg.type === "screenshot_request") {
        const dataUrl = takeScreenshot();
        sendRef.current?.({ type: "screenshot_response", payload: dataUrl });
      }
    },
    [renderCommands, clear, takeScreenshot, autopan]
  );

  const { send } = useWebSocket({ onMessage: handleMessage });
  sendRef.current = send;

  return (
    <>
      <div className="fixed inset-0">
        <canvas ref={canvasElRef} />
      </div>
      <Hud />
      <Narration ref={narrationRef} />
      <div className="fixed bottom-3 right-4 text-[11px] text-gray-400 pointer-events-none">
        scroll to zoom &middot; space+drag to pan
      </div>
    </>
  );
}
