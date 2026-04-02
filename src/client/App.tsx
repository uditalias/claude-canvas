import { useEffect, useState, useCallback } from "react";
import { CanvasView } from "./components/Canvas";
import { Toolbox } from "./components/Toolbox";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToolState, TOOL_SHORTCUTS } from "./hooks/useToolState";
import { useTheme } from "./hooks/useTheme";
import type { ToolType } from "./hooks/useToolState";

export function App() {
  const toolState = useToolState();
  const theme = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Keyboard shortcuts for tool switching
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "?") {
        setShowShortcuts((v) => !v);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

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
        <Toolbox {...toolState} theme={theme} onShowShortcuts={() => setShowShortcuts(true)} />
        <div className="flex-1 relative">
          <CanvasView toolState={toolState} theme={theme} />
        </div>
      </div>
      <ShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </TooltipProvider>
  );
}
