import { useEffect } from "react";
import { CanvasView } from "./components/Canvas";
import { Toolbox } from "./components/Toolbox";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToolState, TOOL_SHORTCUTS } from "./hooks/useToolState";
import type { ToolType } from "./hooks/useToolState";

export function App() {
  const toolState = useToolState();

  // Keyboard shortcuts for tool switching
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()] as ToolType | undefined;
      if (tool) {
        toolState.selectTool(tool);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toolState.selectTool]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full">
        <Toolbox {...toolState} />
        <div className="flex-1 relative">
          <CanvasView toolState={toolState} />
        </div>
      </div>
    </TooltipProvider>
  );
}
