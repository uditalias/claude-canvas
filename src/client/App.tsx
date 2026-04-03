import { useEffect, useState, useCallback, useRef } from "react";
import type { Canvas } from "fabric";
import { CanvasView } from "./components/Canvas";
import { Toolbox } from "./components/Toolbox";
import { QuestionPanel } from "./components/QuestionPanel";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToolState, TOOL_SHORTCUTS } from "./hooks/useToolState";
import { useTheme } from "./hooks/useTheme";
import { useQuestionPanel } from "./hooks/useQuestionPanel";
import type { ToolType } from "./hooks/useToolState";

export function App() {
  const toolState = useToolState();
  const theme = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const getCanvasRef = useRef<() => Canvas | null>(() => null);

  const questionPanel = useQuestionPanel({
    getCanvas: () => getCanvasRef.current(),
  });

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
          <CanvasView
            toolState={toolState}
            theme={theme}
            onAskBatch={questionPanel.addBatch}
            getAllAnswers={questionPanel.getAllAnswers}
            getQuestionsState={questionPanel.getQuestionsState}
            onCanvasReady={(gc) => { getCanvasRef.current = gc; }}
          />
          {questionPanel.isOpen && questionPanel.current && (
            <QuestionPanel
              current={questionPanel.current}
              currentIndex={questionPanel.currentIndex}
              total={questionPanel.questions.length}
              showDone={questionPanel.questionsDone}
              allAnswered={questionPanel.questions.every((q) => {
                if (q.question.type === "canvas") return true;
                if (!q.answer) return false;
                const v = q.answer.value;
                if (Array.isArray(v)) return v.length > 0;
                return typeof v === "string" && v.trim().length > 0;
              })}
              onNavigate={questionPanel.navigateTo}
              onAnswer={questionPanel.setAnswer}
              onDone={questionPanel.close}
            />
          )}
        </div>
      </div>
      {questionPanel.isDone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="text-center">
            <p className="text-lg font-medium">Answers submitted</p>
            <p className="text-sm text-muted-foreground mt-1">You can close this tab</p>
            <button
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              onClick={() => window.close()}
            >
              Close window
            </button>
          </div>
        </div>
      )}
      <ShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </TooltipProvider>
  );
}
