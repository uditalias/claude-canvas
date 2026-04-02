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
import { FabricObject } from "fabric";

interface CanvasViewProps {
  toolState: ToolState;
}

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export function CanvasView({ toolState }: CanvasViewProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const narrationRef = useRef<NarrationHandle>(null);
  const sendRef = useRef<(msg: object) => void>(undefined);

  const { renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, spaceDownRef, zoomIn, zoomOut, fitToScreen, getZoom } =
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

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

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
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasElRef} />
      </div>
      <Hud />
      <Narration ref={narrationRef} />
      <ZoomControls zoomIn={zoomIn} zoomOut={zoomOut} fitToScreen={fitToScreen} getZoom={getZoom} />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
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
