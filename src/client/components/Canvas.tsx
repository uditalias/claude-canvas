import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvas } from "../hooks/useCanvas";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDrawingTools } from "../hooks/useDrawingTools";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSnapGuides } from "../hooks/useSnapGuides";
import { Hud, ZoomControls } from "./Hud";
import { Narration, NarrationHandle } from "./Narration";
import { ContextMenu } from "./ContextMenu";
import type { WsMessage, DrawPayload } from "../lib/protocol";
import type { ToolState } from "../hooks/useToolState";
import type { ResolvedTheme, ThemeMode } from "../hooks/useTheme";
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

  const { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, resetZoom, fitToScreen, getZoom } =
    useCanvas(canvasElRef, containerRef);

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
        // Group
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
        // Ungroup
        e.preventDefault();
        const active = canvas.getActiveObject();
        if (!active || !(active instanceof Group) || !isUserLayer(active)) return;
        // Only ungroup user-created groups (which contain other user-layer groups/objects)
        // Don't ungroup rough.js shape groups (which contain raw Path objects)
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
        // Zoom to selection
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

  // Fix #10: Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: FabricObject;
  } | null>(null);

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const upperCanvas = canvas.getSelectionElement();
    if (upperCanvas) {
      upperCanvas.addEventListener("contextmenu", onContextMenu);
    }

    const onMouseDown = (opt: { e: Event }) => {
      const e = opt.e as MouseEvent;
      if (e.button === 2) {
        e.preventDefault();
        const pointer = canvas.getScenePoint(e);
        const objects = canvas.getObjects().filter(o => isUserLayer(o));
        let hit: FabricObject | null = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (objects[i].containsPoint(pointer)) {
            hit = objects[i];
            break;
          }
        }
        if (hit) {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            target: hit,
          });
        } else {
          setContextMenu(null);
        }
      }
    };

    canvas.on("mouse:down", onMouseDown as any);

    return () => {
      canvas.off("mouse:down", onMouseDown as any);
      if (upperCanvas) {
        upperCanvas.removeEventListener("contextmenu", onContextMenu);
      }
    };
  }, [getCanvas]);

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
        style={{
          backgroundColor: theme.resolved === "dark" ? "#1a1a1e" : "#FAFAF7",
          backgroundImage: `radial-gradient(circle, ${theme.resolved === "dark" ? "#333338" : "#d4d4d4"} 0.75px, transparent 0.75px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
      <Hud />
      <Narration ref={narrationRef} />
      <ZoomControls
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        resetZoom={resetZoom}
        fitToScreen={fitToScreen}
        getZoom={getZoom}
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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          opacity={contextMenu.target.opacity ?? 1}
          locked={contextMenu.target.lockMovementX === true}
          textOptions={contextMenu.target instanceof IText ? {
            fontSize: (contextMenu.target as IText).fontSize ?? 16,
            fontWeight: String((contextMenu.target as IText).fontWeight ?? "normal"),
            fontStyle: String((contextMenu.target as IText).fontStyle ?? "normal"),
            underline: (contextMenu.target as IText).underline ?? false,
            linethrough: (contextMenu.target as IText).linethrough ?? false,
          } : undefined}
          onTextChange={contextMenu.target instanceof IText ? (opts) => {
            const canvas = getCanvas();
            if (canvas && contextMenu.target) {
              contextMenu.target.set(opts as any);
              canvas.requestRenderAll();
            }
          } : undefined}
          onToggleLock={() => {
            const canvas = getCanvas();
            if (canvas && contextMenu.target) {
              const isLocked = contextMenu.target.lockMovementX === true;
              contextMenu.target.set({
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
            if (canvas && contextMenu.target) {
              contextMenu.target.set({ opacity: val });
              canvas.requestRenderAll();
            }
          }}
          onBringToFront={() => {
            const canvas = getCanvas();
            if (canvas && contextMenu.target) {
              // Fabric.js 7: bringObjectToFront on canvas
              if (typeof canvas.bringObjectToFront === "function") {
                canvas.bringObjectToFront(contextMenu.target);
              } else if (typeof (contextMenu.target as any).bringToFront === "function") {
                (contextMenu.target as any).bringToFront();
              }
              canvas.requestRenderAll();
            }
          }}
          onDuplicate={() => {
            const canvas = getCanvas();
            if (canvas && contextMenu.target) {
              contextMenu.target.clone().then((cloned: FabricObject) => {
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
            if (canvas && contextMenu.target) {
              canvas.remove(contextMenu.target);
              canvas.discardActiveObject();
              canvas.requestRenderAll();
            }
          }}
          onSendToBack={() => {
            const canvas = getCanvas();
            if (canvas && contextMenu.target) {
              if (typeof canvas.sendObjectToBack === "function") {
                canvas.sendObjectToBack(contextMenu.target);
              } else if (typeof (contextMenu.target as any).sendToBack === "function") {
                (contextMenu.target as any).sendToBack();
              }
              canvas.requestRenderAll();
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
