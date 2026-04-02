import { useEffect, useRef } from "react";
import { Canvas, Line, FabricObject } from "fabric";

const SNAP_THRESHOLD = 5;
const GUIDE_COLOR = "#FF1493";

interface UseSnapGuidesOptions {
  getCanvas: () => Canvas | null;
}

interface Edges {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

function getEdges(obj: FabricObject): Edges {
  const rect = obj.getBoundingRect();
  return {
    left: rect.left,
    right: rect.left + rect.width,
    centerX: rect.left + rect.width / 2,
    top: rect.top,
    bottom: rect.top + rect.height,
    centerY: rect.top + rect.height / 2,
  };
}

export function useSnapGuides({ getCanvas }: UseSnapGuidesOptions) {
  const guideLinesRef = useRef<Line[]>([]);

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    function clearGuides() {
      const canvas = getCanvas();
      if (!canvas) return;
      for (const line of guideLinesRef.current) {
        canvas.remove(line);
      }
      guideLinesRef.current = [];
    }

    function createGuideLine(points: [number, number, number, number]): Line {
      return new Line(points, {
        stroke: GUIDE_COLOR,
        strokeWidth: 0.5,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
    }

    const onMoving = (opt: { target: FabricObject }) => {
      const canvas = getCanvas();
      if (!canvas) return;
      clearGuides();

      const moving = opt.target;
      const movingEdges = getEdges(moving);
      const canvasWidth = canvas.width ?? 2000;
      const canvasHeight = canvas.height ?? 2000;

      const others = canvas.getObjects().filter(
        (o) => o !== moving && !guideLinesRef.current.includes(o as Line)
      );

      let snappedX = false;
      let snappedY = false;
      const movingRect = moving.getBoundingRect();

      for (const other of others) {
        if (snappedX && snappedY) break;
        const otherEdges = getEdges(other);

        // Horizontal snaps (x-axis alignment)
        if (!snappedX) {
          const xPairs: [number, number][] = [
            [movingEdges.left, otherEdges.left],
            [movingEdges.left, otherEdges.right],
            [movingEdges.left, otherEdges.centerX],
            [movingEdges.right, otherEdges.left],
            [movingEdges.right, otherEdges.right],
            [movingEdges.right, otherEdges.centerX],
            [movingEdges.centerX, otherEdges.left],
            [movingEdges.centerX, otherEdges.right],
            [movingEdges.centerX, otherEdges.centerX],
          ];

          for (const [movVal, otherVal] of xPairs) {
            const diff = otherVal - movVal;
            if (Math.abs(diff) < SNAP_THRESHOLD) {
              moving.set({ left: (moving.left ?? 0) + diff });
              moving.setCoords();
              const guide = createGuideLine([otherVal, 0, otherVal, canvasHeight]);
              canvas.add(guide);
              guideLinesRef.current.push(guide);
              snappedX = true;
              break;
            }
          }
        }

        // Vertical snaps (y-axis alignment)
        if (!snappedY) {
          const yPairs: [number, number][] = [
            [movingEdges.top, otherEdges.top],
            [movingEdges.top, otherEdges.bottom],
            [movingEdges.top, otherEdges.centerY],
            [movingEdges.bottom, otherEdges.top],
            [movingEdges.bottom, otherEdges.bottom],
            [movingEdges.bottom, otherEdges.centerY],
            [movingEdges.centerY, otherEdges.top],
            [movingEdges.centerY, otherEdges.bottom],
            [movingEdges.centerY, otherEdges.centerY],
          ];

          for (const [movVal, otherVal] of yPairs) {
            const diff = otherVal - movVal;
            if (Math.abs(diff) < SNAP_THRESHOLD) {
              moving.set({ top: (moving.top ?? 0) + diff });
              moving.setCoords();
              const guide = createGuideLine([0, otherVal, canvasWidth, otherVal]);
              canvas.add(guide);
              guideLinesRef.current.push(guide);
              snappedY = true;
              break;
            }
          }
        }
      }

      canvas.requestRenderAll();
    };

    const onModified = () => {
      clearGuides();
      const canvas = getCanvas();
      if (canvas) canvas.requestRenderAll();
    };

    canvas.on("object:moving", onMoving as any);
    canvas.on("object:modified", onModified);
    canvas.on("mouse:up", onModified);

    return () => {
      clearGuides();
      canvas.off("object:moving", onMoving as any);
      canvas.off("object:modified", onModified);
      canvas.off("mouse:up", onModified);
    };
  }, [getCanvas]);
}
