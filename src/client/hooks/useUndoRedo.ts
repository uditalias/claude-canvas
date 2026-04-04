import { useEffect, useRef, useCallback } from "react";
import { Canvas, FabricObject, util } from "fabric";

const MAX_HISTORY = 50;

function isUserLayer(obj: FabricObject): boolean {
  return (obj as any).data?.layer === "user";
}

function serializeUserObjects(canvas: Canvas): string {
  const userObjs = canvas.getObjects().filter(isUserLayer);
  const data = userObjs.map((obj) => obj.toObject(["data", "originX", "originY"]));
  return JSON.stringify(data);
}

interface UseUndoRedoOptions {
  getCanvas: () => Canvas | null;
}

export function useUndoRedo({ getCanvas }: UseUndoRedoOptions) {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const restoringRef = useRef(false);
  const pausedRef = useRef(false);

  const saveSnapshot = useCallback(() => {
    if (restoringRef.current || pausedRef.current) return;
    const canvas = getCanvas();
    if (!canvas) return;

    const snapshot = serializeUserObjects(canvas);

    // If we're not at the end of history, truncate forward history
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    }

    // Don't save duplicate consecutive snapshots
    if (historyRef.current[historyRef.current.length - 1] === snapshot) return;

    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    indexRef.current = historyRef.current.length - 1;
  }, [getCanvas]);

  const restoreSnapshot = useCallback(
    async (snapshot: string) => {
      const canvas = getCanvas();
      if (!canvas) return;

      restoringRef.current = true;

      // Remove all user objects
      const userObjs = canvas.getObjects().filter(isUserLayer);
      for (const obj of userObjs) {
        canvas.remove(obj);
      }

      // Restore from snapshot
      const data = JSON.parse(snapshot);
      if (data.length > 0) {
        const objects = await util.enlivenObjects(data);
        for (const obj of objects) {
          canvas.add(obj as FabricObject);
        }
      }

      canvas.discardActiveObject();
      canvas.requestRenderAll();
      restoringRef.current = false;
    },
    [getCanvas]
  );

  const undo = useCallback(async () => {
    if (indexRef.current <= 0) return;
    indexRef.current--;
    await restoreSnapshot(historyRef.current[indexRef.current]);
  }, [restoreSnapshot]);

  const redo = useCallback(async () => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current++;
    await restoreSnapshot(historyRef.current[indexRef.current]);
  }, [restoreSnapshot]);

  // Pause/resume — for atomic multi-step operations (remove+add = one snapshot)
  const pauseHistory = useCallback(() => { pausedRef.current = true; }, []);
  const resumeHistory = useCallback(() => { pausedRef.current = false; }, []);

  // Listen to canvas events to auto-save snapshots
  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    // Save initial empty state
    if (historyRef.current.length === 0) {
      saveSnapshot();
    }

    const onAddedOrRemoved = (opt: { target: FabricObject }) => {
      // Skip non-user objects (e.g. snap guide lines added/removed during moves)
      if (!isUserLayer(opt.target)) return;
      saveSnapshot();
    };

    // object:modified fires once when a transform (move/scale/rotate) ends
    const onModified = () => saveSnapshot();

    canvas.on("object:added", onAddedOrRemoved);
    canvas.on("object:removed", onAddedOrRemoved);
    canvas.on("object:modified", onModified);

    return () => {
      canvas.off("object:added", onAddedOrRemoved);
      canvas.off("object:removed", onAddedOrRemoved);
      canvas.off("object:modified", onModified);
    };
  }, [getCanvas, saveSnapshot]);

  return { undo, redo, saveSnapshot, pauseHistory, resumeHistory };
}
