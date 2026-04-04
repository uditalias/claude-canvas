import { useRef, useCallback } from "react";
import { Canvas, FabricObject, FabricImage, IText } from "fabric";

function isUserLayer(obj: FabricObject): boolean {
  return (obj as unknown as { data?: { layer?: string } }).data?.layer === "user";
}

function tagAsUser(obj: FabricObject): void {
  obj.set({ data: { layer: "user" } });
}

export function useClipboardAndDragDrop(opts: {
  getCanvas: () => Canvas | null;
  saveSnapshot?: () => void;
}) {
  const clipboardRef = useRef<FabricObject[]>([]);
  const getCanvasRef = useRef(opts.getCanvas);
  getCanvasRef.current = opts.getCanvas;
  const saveSnapshotRef = useRef(opts.saveSnapshot);
  saveSnapshotRef.current = opts.saveSnapshot;

  const addImageToCanvas = useCallback((file: File | Blob, left: number, top: number) => {
    const canvas = getCanvasRef.current();
    if (!canvas) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const fImg = new FabricImage(img, {
          left,
          top,
          originX: "left",
          originY: "top",
        });
        tagAsUser(fImg);
        canvas.add(fImg);
        canvas.setActiveObject(fImg);
        canvas.requestRenderAll();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

    const canvas = getCanvasRef.current();
    if (!canvas) return;

    if (e.key === "Escape") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }

    // Copy
    if ((e.metaKey || e.ctrlKey) && e.key === "c") {
      const activeObj = canvas.getActiveObject();
      if (activeObj && (activeObj as IText).isEditing) return;
      const selected = canvas.getActiveObjects().filter(isUserLayer);
      if (selected.length > 0) {
        clipboardRef.current = selected;
        e.preventDefault();
      }
      return;
    }

    // Paste
    if ((e.metaKey || e.ctrlKey) && e.key === "v") {
      if (clipboardRef.current.length === 0) return;
      e.preventDefault();
      const clonePromises = clipboardRef.current.map((obj) => obj.clone());
      Promise.all(clonePromises).then((clones) => {
        canvas.discardActiveObject();
        for (const cloned of clones) {
          cloned.set({
            left: (cloned.left ?? 0) + 20,
            top: (cloned.top ?? 0) + 20,
          });
          (cloned as any).data = { layer: "user" };
          canvas.add(cloned);
        }
        if (clones.length === 1) {
          canvas.setActiveObject(clones[0]);
        }
        canvas.requestRenderAll();
        // Update clipboard to the new clones so next paste offsets further
        clipboardRef.current = clones;
      });
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      // Don't delete when editing text
      const activeObj = canvas.getActiveObject();
      if (activeObj && (activeObj as IText).isEditing) return;

      const activeObjects = canvas.getActiveObjects();
      const userObjects = activeObjects.filter(isUserLayer);
      for (const obj of userObjects) {
        canvas.remove(obj);
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, []);

  const onPaste = useCallback((e: ClipboardEvent) => {
    const canvas = getCanvasRef.current();
    if (!canvas) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        addImageToCanvas(blob, (canvas.width ?? 800) / 2, (canvas.height ?? 600) / 2);
        break;
      }
    }
  }, [addImageToCanvas]);

  const onDragOver = useCallback((e: DragEvent) => { e.preventDefault(); }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const canvas = getCanvasRef.current();
    if (!canvas) return;
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const pointer = canvas.getScenePoint(e);
      addImageToCanvas(file, pointer.x, pointer.y);
    }
  }, [addImageToCanvas]);

  return { onKeyDown, onPaste, onDragOver, onDrop };
}
