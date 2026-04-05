import { useRef, useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { useCanvas } from "../hooks/useCanvas";
import { useCanvasMessages } from "../hooks/useCanvasMessages";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDrawingTools } from "../hooks/useDrawingTools";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSnapGuides } from "../hooks/useSnapGuides";
import { useCanvasLabelEditor } from "../hooks/useCanvasLabelEditor";
import { Hud, ZoomControls } from "./Hud";
import { Narration, NarrationHandle } from "./Narration";
import { ContextMenuPanel } from "./ContextMenuPanel";
import type { Question, Answer } from "../lib/protocol";
import type { QuestionState } from "../hooks/useQuestionPanel";
import type { ToolState } from "../hooks/useToolState";
import { type ResolvedTheme, type ThemeMode, THEME } from "../hooks/useTheme";
import { FabricObject, Group, Point } from "fabric";

interface CanvasViewProps {
  toolState: ToolState;
  theme: { mode: ThemeMode; resolved: ResolvedTheme; setThemeMode: (m: ThemeMode) => void };
  onAskBatch?: (questions: { question: Question; canvasJson: object }[]) => void;
  getAllAnswers?: () => Answer[];
  getQuestionsState?: () => QuestionState[];
  onCanvasReady?: (getCanvas: () => import("fabric").Canvas | null) => void;
  onSubmitAnswersReady?: (fn: () => Promise<void>) => void;
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export function CanvasView({ toolState, theme, onAskBatch, getAllAnswers, getQuestionsState, onCanvasReady, onSubmitAnswersReady }: CanvasViewProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const narrationRef = useRef<NarrationHandle>(null);
  const sendRef = useRef<(msg: object) => void>(undefined);
  const activeToolRef = useRef(toolState.activeTool);
  activeToolRef.current = toolState.activeTool;

  const themeColors = THEME[theme.resolved];
  const { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom, onLabelsUpdate, exportSVG, exportPNG, exportJSON } =
    useCanvas(canvasElRef, containerRef, activeToolRef, themeColors);

  // ── Shape labels (rendered as DOM, positioned from after:render) ────────
  const [shapeLabels, setShapeLabels] = useState<{ text: string; x: number; y: number }[]>([]);
  useEffect(() => {
    onLabelsUpdate(setShapeLabels);
  }, [onLabelsUpdate]);

  // Expose getCanvas to parent
  useEffect(() => {
    onCanvasReady?.(getCanvas);
  }, [getCanvas, onCanvasReady]);

  const { undo, redo, saveSnapshot, pauseHistory, resumeHistory } = useUndoRedo({ getCanvas });
  useSnapGuides({ getCanvas });

  useDrawingTools({
    getCanvas,
    activeTool: toolState.activeTool,
    color: toolState.color,
    brushSize: toolState.brushSize,
    spaceDownRef,
    selectTool: toolState.selectTool,
    resolvedTheme: theme.resolved,
    saveSnapshot,
    pauseHistory,
    resumeHistory,
  });

  // Keyboard shortcuts: undo/redo, group/ungroup, zoom to selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const canvas = getCanvas();
      if (!canvas) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        const selected = canvas.getActiveObjects().filter(isUserLayer);
        if (selected.length < 2) return;
        canvas.discardActiveObject();
        const group = new Group(selected, { originX: "left", originY: "top" });
        for (const obj of selected) canvas.remove(obj);
        (group as any).data = { layer: "user" };
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.requestRenderAll();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "g" && e.shiftKey) {
        e.preventDefault();
        const active = canvas.getActiveObject();
        if (!active || !(active instanceof Group) || !isUserLayer(active)) return;
        const children = active.getObjects();
        const hasUserChildren = children.some(c => (c as any).data?.layer === "user");
        if (!hasUserChildren) return;
        const items = active.removeAll();
        canvas.remove(active);
        for (const item of items) {
          (item as any).data = { layer: "user" };
          canvas.add(item);
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        const active = canvas.getActiveObject();
        if (!active) return;
        const bounds = active.getBoundingRect();
        const cw = canvas.width ?? 800;
        const ch = canvas.height ?? 600;
        const zoom = Math.min(cw / (bounds.width + 80), ch / (bounds.height + 80), 5);
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.zoomToPoint(new Point(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2), zoom);
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = cw / 2 - (bounds.left + bounds.width / 2) * zoom;
          vpt[5] = ch / 2 - (bounds.top + bounds.height / 2) * zoom;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, getCanvas]);

  // ── Inline label editor ───────────────────────────────────────────────────
  const { labelEdit, setLabelEdit, startLabelEdit, commitLabelEdit } = useCanvasLabelEditor({ getCanvas, saveSnapshot });

  // ── Lock indicator for selected locked objects ───────────────────────────
  const [lockPos, setLockPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const updateLockPos = () => {
      const active = canvas.getActiveObject();
      if (!active || active.lockMovementX !== true) {
        setLockPos(null);
        return;
      }
      const bounds = active.getBoundingRect();
      const vpt = canvas.viewportTransform;
      const zoom = vpt[0];
      const panX = vpt[4];
      const panY = vpt[5];
      setLockPos({
        x: bounds.left * zoom + panX,
        y: bounds.top * zoom + panY - 18,
      });
    };

    canvas.on("selection:created", updateLockPos);
    canvas.on("selection:updated", updateLockPos);
    canvas.on("selection:cleared", () => setLockPos(null));
    canvas.on("after:render", updateLockPos);

    return () => {
      canvas.off("selection:created", updateLockPos);
      canvas.off("selection:updated", updateLockPos);
      canvas.off("selection:cleared");
      canvas.off("after:render", updateLockPos);
    };
  }, [getCanvas]);

  const { handleMessage, submitAnswers } = useCanvasMessages({
    renderCommands,
    clear,
    clearLayer,
    takeScreenshot,
    autopan,
    getCanvas,
    exportSVG,
    exportPNG,
    exportJSON,
    onAskBatch,
    getAllAnswers,
    getQuestionsState,
    narrationRef,
    sendRef,
  });

  const { send } = useWebSocket({ onMessage: handleMessage });
  sendRef.current = send;

  useEffect(() => {
    onSubmitAnswersReady?.(() => submitAnswers());
  }, [submitAnswers, onSubmitAnswersReady]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ backgroundColor: themeColors.canvasBg }}
      >
        <canvas ref={canvasElRef} />
      </div>

      {lockPos && (
        <div
          className="absolute pointer-events-none"
          style={{ left: lockPos.x, top: lockPos.y }}
        >
          <Lock className="w-3.5 h-3.5" style={{ color: "rgba(178,204,255,0.8)" }} />
        </div>
      )}

      {shapeLabels.filter((lbl) => !labelEdit || Math.abs(lbl.x - labelEdit.x) > 1 || Math.abs(lbl.y - labelEdit.y) > 1).map((lbl) => (
        <div
          key={`${lbl.text}-${lbl.x.toFixed(0)}-${lbl.y.toFixed(0)}`}
          className="absolute pointer-events-none text-sm font-medium -translate-x-1/2"
          style={{
            left: lbl.x,
            top: lbl.y,
            color: theme.resolved === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
          }}
        >
          {lbl.text}
        </div>
      ))}

      {labelEdit && (
        <input
          autoFocus
          className="absolute z-50 bg-transparent border-none text-sm font-medium text-center -translate-x-1/2 focus:outline-none caret-foreground"
          style={{ left: labelEdit.x, top: labelEdit.y, minWidth: 60, color: theme.resolved === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
          value={labelEdit.value}
          onChange={(e) => setLabelEdit({ ...labelEdit, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabelEdit();
            if (e.key === "Escape") setLabelEdit(null);
          }}
          onBlur={commitLabelEdit}
          placeholder="Label..."
        />
      )}

      <ContextMenuPanel
        getCanvas={getCanvas}
        containerRef={containerRef}
        saveSnapshot={saveSnapshot}
        pauseHistory={pauseHistory}
        resumeHistory={resumeHistory}
        startLabelEdit={startLabelEdit}
      />

      <Hud />
      <Narration ref={narrationRef} />
      <ZoomControls
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        resetZoom={resetZoom}
        fitToScreen={fitToScreen}
        getZoom={getZoom}
        onUndo={undo}
        onRedo={redo}
        onExportPNG={(includeLabels) => {
          const dataUrl = exportPNG(includeLabels);
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "claude-canvas.png";
            a.click();
          }
        }}
        onExportSVG={(includeLabels) => {
          const svg = exportSVG(includeLabels);
          if (svg) {
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "claude-canvas.svg";
            a.click();
            URL.revokeObjectURL(url);
          }
        }}
        onExportJSON={() => {
          const json = exportJSON();
          if (json) {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "claude-canvas.json";
            a.click();
            URL.revokeObjectURL(url);
          }
        }}
      />
    </>
  );
}
