import { useState, useEffect } from "react";
import { FabricObject, IText } from "fabric";
import type { Canvas } from "fabric";

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

export function useCanvasLabelEditor(opts: {
  getCanvas: () => Canvas | null;
  saveSnapshot: () => void;
}) {
  const { getCanvas, saveSnapshot } = opts;

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

  return { labelEdit, setLabelEdit, startLabelEdit, commitLabelEdit };
}
