import { useState, useEffect } from "react";

export function Hud() {
  const [status, setStatus] = useState<"connected" | "disconnected">("disconnected");

  useEffect(() => {
    const handler = (e: Event) => {
      setStatus((e as CustomEvent).detail);
    };
    window.addEventListener("ws-status", handler);
    return () => window.removeEventListener("ws-status", handler);
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/85 border border-gray-200 rounded-full px-4 py-1.5 text-[13px] text-gray-500 pointer-events-none backdrop-blur-sm z-[100]">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "connected" ? "bg-green-500" : "bg-gray-300"
        }`}
      />
      <span>claude-canvas</span>
      <span
        className={`text-xs ${
          status === "connected" ? "text-green-500" : "text-gray-400"
        }`}
      >
        {status === "connected" ? "connected" : "connecting\u2026"}
      </span>
    </div>
  );
}
