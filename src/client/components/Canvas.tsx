import { useRef, useCallback, useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { useCanvas } from "../hooks/useCanvas";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDrawingTools } from "../hooks/useDrawingTools";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSnapGuides } from "../hooks/useSnapGuides";
import { Hud, ZoomControls } from "./Hud";
import { Narration, NarrationHandle } from "./Narration";
import { CanvasContextMenuContent } from "./ContextMenu";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";
import type { WsMessage, DrawPayload, AskPayload, Question, Answer } from "../lib/protocol";
import type { QuestionState } from "../hooks/useQuestionPanel";
import type { ToolState } from "../hooks/useToolState";
import { type ResolvedTheme, type ThemeMode, THEME } from "../hooks/useTheme";
import { FabricObject, Group, IText, Path, Point } from "fabric";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";
import { hexToRgba } from "../lib/wobble";

interface CanvasViewProps {
  toolState: ToolState;
  theme: { mode: ThemeMode; resolved: ResolvedTheme; setThemeMode: (m: ThemeMode) => void };
  onAskBatch?: (questions: { question: Question; canvasJson: object }[]) => void;
  getAllAnswers?: () => Answer[];
  getQuestionsState?: () => QuestionState[];
  onCanvasReady?: (getCanvas: () => import("fabric").Canvas | null) => void;
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export function CanvasView({ toolState, theme, onAskBatch, getAllAnswers, getQuestionsState, onCanvasReady }: CanvasViewProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const narrationRef = useRef<NarrationHandle>(null);
  const sendRef = useRef<(msg: object) => void>(undefined);
  const contextTargetRef = useRef<FabricObject | null>(null);
  const activeToolRef = useRef(toolState.activeTool);
  activeToolRef.current = toolState.activeTool;

  const themeColors = THEME[theme.resolved];
  const { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom, onLabelsUpdate, exportSVG, exportPNG } =
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

  const { undo, redo, saveSnapshot } = useUndoRedo({ getCanvas });
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
  const [labelEdit, setLabelEdit] = useState<{
    target: FabricObject;
    x: number;
    y: number;
    value: string;
  } | null>(null);

  const startLabelEdit = (obj: FabricObject) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const bounds = obj.getBoundingRect();
    const vpt = canvas.viewportTransform;
    const zoom = vpt[0];
    const panX = vpt[4];
    const panY = vpt[5];
    const x = bounds.left * zoom + panX + (bounds.width * zoom) / 2;
    const y = bounds.top * zoom + panY - 20;
    const currentLabel = (obj as any).data?.label ?? "";
    setLabelEdit({ target: obj, x, y, value: currentLabel });
  };

  const commitLabelEdit = () => {
    if (!labelEdit) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const trimmed = labelEdit.value.trim();
    if (!(labelEdit.target as any).data) (labelEdit.target as any).data = {};
    if (trimmed) {
      (labelEdit.target as any).data.label = trimmed;
    } else {
      delete (labelEdit.target as any).data.label;
    }
    canvas.requestRenderAll();
    saveSnapshot();
    setLabelEdit(null);
  };

  // Double-click to edit label on user shapes
  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const onDblClick = (opt: { target?: FabricObject }) => {
      if (!opt.target) return;
      if (!isUserLayer(opt.target)) return;
      // Don't intercept IText double-click (that's for text editing)
      if (opt.target instanceof IText) return;
      startLabelEdit(opt.target);
    };

    canvas.on("mouse:dblclick", onDblClick as any);
    return () => {
      canvas.off("mouse:dblclick", onDblClick as any);
    };
  }, [getCanvas]);

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

  // ── Context menu state ───────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Listen for native contextmenu on the container (captures events from Fabric's upper canvas)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      const canvas = getCanvas();
      if (!canvas) return;

      const pointer = canvas.getScenePoint(e);
      const objects = canvas.getObjects().filter(o => isUserLayer(o));
      let hit: FabricObject | null = null;
      for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].containsPoint(pointer)) {
          hit = objects[i];
          break;
        }
      }

      if (!hit) {
        contextTargetRef.current = null;
        setMenuOpen(false);
        return;
      }

      contextTargetRef.current = hit;
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
    };

    container.addEventListener("contextmenu", onContextMenu);
    return () => container.removeEventListener("contextmenu", onContextMenu);
  }, [getCanvas]);

  const target = contextTargetRef.current;

  const getAllAnswersRef = useRef(getAllAnswers);
  getAllAnswersRef.current = getAllAnswers;
  const getQuestionsStateRef = useRef(getQuestionsState);
  getQuestionsStateRef.current = getQuestionsState;

  const handleScreenshotRequest = async () => {
    const canvas = getCanvas();
    if (!canvas) return;

    const mainImage = takeScreenshot();

    if (!getAllAnswersRef.current || !getQuestionsStateRef.current) {
      sendRef.current?.({ type: "screenshot_response", payload: { image: mainImage, answers: [] } });
      return;
    }

    const answers = getAllAnswersRef.current();
    const questionsState = getQuestionsStateRef.current();
    const processedAnswers: Answer[] = [];

    // Save current canvas state
    const currentJson = canvas.toJSON();

    for (const a of answers) {
      const qs = questionsState.find((q) => q.question.id === a.questionId);
      if (qs && qs.question.type === "canvas") {
        await canvas.loadFromJSON(qs.canvasJson);
        canvas.requestRenderAll();
        const snapshot = takeScreenshot();
        processedAnswers.push({ ...a, canvasSnapshot: snapshot });
      } else {
        processedAnswers.push(a);
      }
    }

    // Restore original canvas
    await canvas.loadFromJSON(currentJson);
    canvas.requestRenderAll();

    sendRef.current?.({
      type: "screenshot_response",
      payload: { image: mainImage, answers: processedAnswers },
    });
  };

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "draw") {
        const payload = msg.payload as DrawPayload;
        if (payload?.narration) narrationRef.current?.animateText(payload.narration);
        if (payload?.commands) {
          const added = renderCommands(payload.commands);
          autopan(added);
        }
      } else if (msg.type === "ask") {
        const askPayload = msg.payload as AskPayload;
        if (askPayload?.questions && onAskBatch) {
          const canvas = getCanvas();
          if (!canvas) return;
          const batch: { question: Question; canvasJson: object }[] = [];
          for (const q of askPayload.questions) {
            clear();
            if (q.commands) renderCommands(q.commands);
            // Make all objects interactive for Q&A
            canvas.forEachObject((obj) => {
              obj.set({ selectable: true, evented: true });
            });
            canvas.requestRenderAll();
            batch.push({ question: q, canvasJson: canvas.toJSON() });
          }
          // Restore Q1's canvas
          if (batch.length > 0) {
            canvas.loadFromJSON(batch[0].canvasJson).then(() => canvas.requestRenderAll());
          }
          onAskBatch(batch);
        }
      } else if (msg.type === "clear") {
        const layer = msg.payload as string | null;
        if (layer) {
          clearLayer(layer);
        } else {
          clear();
        }
      } else if (msg.type === "export_request") {
        const exportPayload = msg.payload as { format: string; labels: boolean };
        if (exportPayload) {
          let data: string;
          if (exportPayload.format === "svg") {
            data = exportSVG(exportPayload.labels);
          } else {
            data = exportPNG(exportPayload.labels);
          }
          sendRef.current?.({ type: "export_response", payload: data });
        }
      } else if (msg.type === "screenshot_request") {
        void handleScreenshotRequest();
      }
    },
    [renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, getAllAnswers, getQuestionsState, onAskBatch, exportSVG, exportPNG]
  );

  const { send } = useWebSocket({ onMessage: handleMessage });
  sendRef.current = send;

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

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <div
            style={{
              position: "fixed",
              left: menuPos.x,
              top: menuPos.y,
              width: 0,
              height: 0,
              pointerEvents: "none",
            }}
          />
        </DropdownMenuTrigger>

        {menuOpen && target && (
          <CanvasContextMenuContent
            opacity={target.opacity ?? 1}
            locked={target.lockMovementX === true}
            label={(target as any).data?.label ?? ""}
            filled={target instanceof Group ? target.getObjects().some(
              (c) => c instanceof Path && c.visible !== false && (c.stroke as string)?.startsWith("rgba")
            ) : undefined}
            textOptions={target instanceof IText ? {
              fontSize: (target as IText).fontSize ?? 16,
              fontWeight: String((target as IText).fontWeight ?? "normal"),
              fontStyle: String((target as IText).fontStyle ?? "normal"),
              underline: (target as IText).underline ?? false,
              linethrough: (target as IText).linethrough ?? false,
            } : undefined}
            onTextChange={target instanceof IText ? (opts) => {
              const canvas = getCanvas();
              if (canvas && target) {
                target.set(opts as any);
                canvas.requestRenderAll();
              }
            } : undefined}
            onColorChange={(color) => {
              const canvas = getCanvas();
              if (!canvas || !target) return;
              if (target instanceof RoughLineObject || target instanceof RoughArrowObject) {
                (target as RoughLineObject).strokeColor = color;
              } else if (target instanceof IText) {
                target.set({ fill: color });
              } else if (target instanceof Path) {
                target.set({ stroke: color });
              } else if (target instanceof Group) {
                const fillLight = hexToRgba(color, 0.35);
                for (const child of target.getObjects()) {
                  if (child instanceof Path) {
                    const s = child.stroke as string;
                    if (s && (s.startsWith("rgba") || s === "transparent")) {
                      child.set({ stroke: fillLight });
                    } else {
                      child.set({ stroke: color });
                    }
                  }
                }
              }
              canvas.requestRenderAll();
              saveSnapshot();
            }}
            onToggleFill={target instanceof Group ? () => {
              const canvas = getCanvas();
              if (!canvas || !target) return;
              const children = (target as Group).getObjects();
              // Hachure fill paths have rgba strokes
              const fillPaths = children.filter(
                (c) => c instanceof Path && (c.stroke as string)?.startsWith("rgba")
              );
              if (fillPaths.length === 0) return;
              const currentlyVisible = fillPaths.some((p) => p.visible !== false);
              for (const p of fillPaths) {
                p.visible = !currentlyVisible;
                p.dirty = true;
              }
              (target as Group).set("objectCaching", false);
              (target as Group).dirty = true;
              canvas.requestRenderAll();
              saveSnapshot();
              // Re-enable caching next frame
              requestAnimationFrame(() => {
                (target as Group).set("objectCaching", true);
              });
            } : undefined}
            onEditLabel={isUserLayer(target) && !(target instanceof IText) ? () => {
              setMenuOpen(false);
              startLabelEdit(target);
            } : undefined}
            onCenterOnCanvas={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                const cw = canvas.width ?? 800;
                const ch = canvas.height ?? 600;
                const bounds = target.getBoundingRect();
                target.set({
                  left: (target.left ?? 0) + (cw / 2 - (bounds.left + bounds.width / 2)),
                  top: (target.top ?? 0) + (ch / 2 - (bounds.top + bounds.height / 2)),
                });
                target.setCoords();
                canvas.requestRenderAll();
              }
            }}
            onToggleLock={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                const isLocked = target.lockMovementX === true;
                target.set({
                  lockMovementX: !isLocked,
                  lockMovementY: !isLocked,
                  lockRotation: !isLocked,
                  lockScalingX: !isLocked,
                  lockScalingY: !isLocked,
                  hasControls: isLocked,
                });
                canvas.requestRenderAll();
                saveSnapshot();
              }
            }}
            onOpacityChange={(val) => {
              const canvas = getCanvas();
              if (canvas && target) {
                target.set({ opacity: val });
                canvas.requestRenderAll();
                saveSnapshot();
              }
            }}
            onBringToFront={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                if (typeof canvas.bringObjectToFront === "function") {
                  canvas.bringObjectToFront(target);
                }
                canvas.requestRenderAll();
                saveSnapshot();
              }
            }}
            onDuplicate={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                target.clone().then((cloned: FabricObject) => {
                  cloned.set({
                    left: (cloned.left ?? 0) + 10,
                    top: (cloned.top ?? 0) + 10,
                  });
                  (cloned as any).data = { layer: "user" };
                  canvas.add(cloned);
                  canvas.setActiveObject(cloned);
                  canvas.requestRenderAll();
                });
              }
            }}
            onDelete={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                canvas.remove(target);
                canvas.discardActiveObject();
                canvas.requestRenderAll();
              }
            }}
            onSendToBack={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                if (typeof canvas.sendObjectToBack === "function") {
                  canvas.sendObjectToBack(target);
                }
                canvas.requestRenderAll();
                saveSnapshot();
              }
            }}
          />
        )}
      </DropdownMenu>

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
      />
    </>
  );
}
