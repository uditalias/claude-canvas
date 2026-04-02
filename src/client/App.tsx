import { useEffect } from "react";
import { CanvasView } from "./components/Canvas";
import { Toolbox } from "./components/Toolbox";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToolState, TOOL_SHORTCUTS } from "./hooks/useToolState";
import { useTheme } from "./hooks/useTheme";
import type { ToolType } from "./hooks/useToolState";

export function App() {
  const toolState = useToolState();
  const theme = useTheme();

  // Keyboard shortcuts for tool switching
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Don't trigger tool shortcuts when modifier keys are held (Cmd+C, Ctrl+V, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
        <Toolbox {...toolState} theme={theme} />
        <div className="flex-1 relative">
          <CanvasView toolState={toolState} theme={theme} />
        </div>
      </div>
    </TooltipProvider>
  );
}
