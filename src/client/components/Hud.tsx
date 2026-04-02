import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Minus, Plus, Maximize, Download } from "lucide-react";

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
      className="fixed top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/80 border border-border rounded-full px-3.5 py-1 text-[11px] text-muted-foreground pointer-events-none backdrop-blur-sm shadow-sm z-[100]"
      style={POPPINS_STYLE}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === "connected" ? "bg-green-500" : "bg-red-400"
        }`}
      />
      <span className="text-foreground/70 font-medium tracking-wide">claude-canvas</span>
    </div>
  );
}

interface ZoomControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  getZoom: () => number;
  onExport?: () => void;
}

export function ZoomControls({ zoomIn, zoomOut, resetZoom, fitToScreen, getZoom, onExport }: ZoomControlsProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(Math.round(getZoom() * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [getZoom]);

  return (
    <div
      className="fixed bottom-3 right-3 flex items-center gap-0 bg-background border border-border rounded-lg shadow-sm z-[100]"
      style={POPPINS_STYLE}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            className="rounded-r-none text-muted-foreground"
            aria-label="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent style={POPPINS_STYLE}>Zoom out</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={resetZoom}
            className="rounded-none text-muted-foreground text-[11px] font-medium w-12 px-0"
            aria-label="Reset zoom to 100%"
          >
            {zoom}%
          </Button>
        </TooltipTrigger>
        <TooltipContent style={POPPINS_STYLE}>Reset to 100%</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            className="rounded-none text-muted-foreground"
            aria-label="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent style={POPPINS_STYLE}>Zoom in</TooltipContent>
      </Tooltip>
      <div className="w-px h-5 bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={fitToScreen}
            className="rounded-none text-muted-foreground"
            aria-label="Fit to screen"
          >
            <Maximize className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent style={POPPINS_STYLE}>Fit to screen</TooltipContent>
      </Tooltip>
      {onExport && (
        <>
          <div className="w-px h-5 bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onExport}
                className="rounded-l-none text-muted-foreground"
                aria-label="Export as PNG"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent style={POPPINS_STYLE}>Export PNG</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
