import { useState, useEffect } from "react";
import { Button } from "./ui/button";

const POPPINS_STYLE = { fontFamily: "'Poppins', sans-serif" };

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
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/80 border border-gray-200 rounded-full px-3.5 py-1 text-[11px] text-gray-500 pointer-events-none backdrop-blur-sm shadow-sm z-[100]"
      style={POPPINS_STYLE}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === "connected" ? "bg-green-500" : "bg-red-400"
        }`}
      />
      <span className="text-gray-600 font-medium tracking-wide">claude-canvas</span>
    </div>
  );
}

interface ZoomControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  getZoom: () => number;
}

export function ZoomControls({ zoomIn, zoomOut, fitToScreen, getZoom }: ZoomControlsProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(Math.round(getZoom() * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [getZoom]);

  return (
    <div
      className="fixed bottom-3 right-3 flex items-center gap-0 bg-white border border-gray-200 rounded-lg shadow-sm z-[100]"
      style={POPPINS_STYLE}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomOut}
        className="rounded-r-none text-gray-600 text-sm font-medium"
        aria-label="Zoom out"
      >
        &minus;
      </Button>
      <span className="w-12 text-center text-[11px] text-gray-500 font-medium select-none">
        {zoom}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomIn}
        className="rounded-none text-gray-600 text-sm font-medium"
        aria-label="Zoom in"
      >
        +
      </Button>
      <div className="w-px h-5 bg-gray-200" />
      <Button
        variant="ghost"
        size="icon"
        onClick={fitToScreen}
        className="rounded-l-none text-gray-600 text-sm"
        aria-label="Fit to screen"
        title="Fit to screen"
      >
        &#x229e;
      </Button>
    </div>
  );
}
