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
import type { WsMessage, DrawPayload } from "../lib/protocol";
import type { ToolState } from "../hooks/useToolState";
import { type ResolvedTheme, type ThemeMode, THEME } from "../hooks/useTheme";
import { FabricObject, Group, IText, Point } from "fabric";

interface CanvasViewProps {
  toolState: ToolState;
  theme: { mode: ThemeMode; resolved: ResolvedTheme; setThemeMode: (m: ThemeMode) => void };
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export function CanvasView({ toolState, theme }: CanvasViewProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const narrationRef = useRef<NarrationHandle>(null);
  const sendRef = useRef<(msg: object) => void>(undefined);
  const contextTargetRef = useRef<FabricObject | null>(null);
  const activeToolRef = useRef(toolState.activeTool);
  activeToolRef.current = toolState.activeTool;

  const themeColors = THEME[theme.resolved];
  const { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom } =
    useCanvas(canvasElRef, containerRef, activeToolRef, themeColors);

  useDrawingTools({
    getCanvas,
    activeTool: toolState.activeTool,
    color: toolState.color,
    brushSize: toolState.brushSize,
    spaceDownRef,
    selectTool: toolState.selectTool,
  });

  const { undo, redo } = useUndoRedo({ getCanvas });
  useSnapGuides({ getCanvas });

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

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "draw") {
        const payload = msg.payload as DrawPayload;
        if (payload?.narration) {
          narrationRef.current?.animateText(payload.narration);
        }
        if (payload?.commands) {
          const added = renderCommands(payload.commands);
          autopan(added);
        }
      } else if (msg.type === "clear") {
        const layer = msg.payload as string | null;
        if (layer) {
          clearLayer(layer);
        } else {
          clear();
        }
      } else if (msg.type === "screenshot_request") {
        const dataUrl = takeScreenshot();
        sendRef.current?.({ type: "screenshot_response", payload: dataUrl });
      }
    },
    [renderCommands, clear, clearLayer, takeScreenshot, autopan]
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
              }
            }}
            onOpacityChange={(val) => {
              const canvas = getCanvas();
              if (canvas && target) {
                target.set({ opacity: val });
                canvas.requestRenderAll();
              }
            }}
            onBringToFront={() => {
              const canvas = getCanvas();
              if (canvas && target) {
                if (typeof canvas.bringObjectToFront === "function") {
                  canvas.bringObjectToFront(target);
                }
                canvas.requestRenderAll();
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
        onExport={() => {
          const dataUrl = takeScreenshot();
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "claude-canvas.png";
            a.click();
          }
        }}
      />
    </>
  );
}
