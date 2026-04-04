import { useCallback } from "react";
import { Canvas, Point } from "fabric";

export function useCanvasZoom(fabricRef: React.RefObject<Canvas | null>) {
  const zoomIn = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let zoom = canvas.getZoom() * 1.2;
    zoom = Math.min(10, zoom);
    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, zoom);
    canvas.requestRenderAll();
  }, []);

  const zoomOut = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let zoom = canvas.getZoom() / 1.2;
    zoom = Math.max(0.1, zoom);
    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, zoom);
    canvas.requestRenderAll();
  }, []);

  const resetZoom = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
  }, []);

  const fitToScreen = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
      const br = obj.getBoundingRect();
      minX = Math.min(minX, br.left);
      minY = Math.min(minY, br.top);
      maxX = Math.max(maxX, br.left + br.width);
      maxY = Math.max(maxY, br.top + br.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW === 0 || contentH === 0) return;
    const padding = 60;
    const vw = canvas.getWidth() - padding * 2;
    const vh = canvas.getHeight() - padding * 2;
    const zoom = Math.min(vw / contentW, vh / contentH, 3);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    canvas.zoomToPoint(new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), zoom);
    const vpt = canvas.viewportTransform!;
    vpt[4] = canvas.getWidth() / 2 - cx * zoom;
    vpt[5] = canvas.getHeight() / 2 - cy * zoom;
    canvas.requestRenderAll();
  }, []);

  const getZoom = useCallback((): number => {
    return fabricRef.current?.getZoom() ?? 1;
  }, []);

  return { zoomIn, zoomOut, resetZoom, fitToScreen, getZoom };
}
