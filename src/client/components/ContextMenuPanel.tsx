import { useRef, useState, useEffect } from "react";
import { FabricObject, Group, IText, Path } from "fabric";
import { RoughLineObject, RoughArrowObject } from "../lib/rough-line";
import { hexToRgba, wobbleRect, wobbleCircle, wobbleEllipse, userRoughRect, userRoughEllipse } from "../lib/wobble";
import { getObjectColor, applyColor } from "../lib/colors";
import { CanvasContextMenuContent } from "./ContextMenu";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export interface ContextMenuPanelProps {
  getCanvas: () => import("fabric").Canvas | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  saveSnapshot: () => void;
  pauseHistory: () => void;
  resumeHistory: () => void;
  startLabelEdit: (obj: FabricObject) => void;
}

export function ContextMenuPanel({
  getCanvas,
  containerRef,
  saveSnapshot,
  pauseHistory,
  resumeHistory,
  startLabelEdit,
}: ContextMenuPanelProps) {
  const contextTargetRef = useRef<FabricObject | null>(null);
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
  }, [getCanvas, containerRef]);

  const target = contextTargetRef.current;

  return (
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
          fillStyle={(target as any).data?.fillStyle ?? "hachure"}
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
                  const f = child.fill as string;
                  if (s && (s.startsWith("rgba") || s === "transparent")) {
                    child.set({ stroke: fillLight });
                    // Solid fill paths store visible color in fill, not stroke
                    if (f && f.startsWith("rgba")) {
                      child.set({ fill: fillLight });
                    }
                  } else {
                    child.set({ stroke: color });
                  }
                }
              }
            }
            canvas.requestRenderAll();
            saveSnapshot();
          }}
          onFillStyleChange={target instanceof Group ? (style: string) => {
            const canvas = getCanvas();
            if (!canvas || !target) return;
            const data = (target as any).data;
            const shapeType = data?.shapeType;
            const geo = data?.geo as Record<string, number> | undefined;
            if (!shapeType || !["rect", "circle", "ellipse"].includes(shapeType) || !geo) return;

            const color = getObjectColor(target);
            const isUser = data?.layer === "user";

            // Re-create shape at same internal coordinates
            let newShape: Group;
            if (shapeType === "rect") {
              newShape = isUser
                ? userRoughRect(0, 0, geo.width, geo.height, color || "#000000", style)
                : wobbleRect(geo.x, geo.y, geo.width, geo.height, style);
            } else if (shapeType === "circle") {
              const d = geo.radius * 2;
              newShape = isUser
                ? userRoughEllipse(0, 0, d, d, color || "#000000", style)
                : wobbleCircle(geo.x, geo.y, geo.radius, style);
            } else {
              newShape = isUser
                ? userRoughEllipse(0, 0, geo.width, geo.height, color || "#000000", style)
                : wobbleEllipse(geo.x, geo.y, geo.width / 2, geo.height / 2, style);
            }

            // Copy all spatial transforms -- preserves moves, rotation, scaling
            newShape.set({
              left: target.left,
              top: target.top,
              angle: target.angle,
              scaleX: target.scaleX,
              scaleY: target.scaleY,
              flipX: target.flipX,
              flipY: target.flipY,
              originX: target.originX,
              originY: target.originY,
              data: { ...data, fillStyle: style },
              opacity: target.opacity,
              selectable: target.selectable,
              evented: target.evented,
              hasControls: target.hasControls,
            });
            if (!isUser && color) applyColor(newShape, color);
            newShape.setCoords();

            // Pause undo history so remove+add is atomic (one undo step)
            pauseHistory();
            const idx = canvas.getObjects().indexOf(target);
            canvas.remove(target);
            canvas.insertAt(idx, newShape);
            resumeHistory();

            canvas.setActiveObject(newShape);
            canvas.requestRenderAll();
            contextTargetRef.current = newShape;
            saveSnapshot();
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
  );
}
