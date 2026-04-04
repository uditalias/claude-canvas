import { FabricObject, FabricText, Group, Path } from "fabric";
import { RoughLineObject, RoughArrowObject } from "./rough-line";
import { hexToRgba } from "./wobble";

/** Extract the primary color from a Fabric object */
export function getObjectColor(obj: FabricObject): string | undefined {
  if (obj instanceof RoughLineObject || obj instanceof RoughArrowObject) {
    return (obj as RoughLineObject).strokeColor;
  }
  if (obj instanceof FabricText) {
    return obj.fill as string || undefined;
  }
  if (obj instanceof Path) {
    return obj.stroke as string || undefined;
  }
  if (obj instanceof Group) {
    // Find the solid stroke color from child paths (not the rgba fill paths)
    for (const child of obj.getObjects()) {
      if (child instanceof Path) {
        const s = child.stroke as string;
        if (s && !s.startsWith("rgba") && s !== "transparent") {
          return s;
        }
      }
    }
  }
  return undefined;
}

/** Apply a color to a Fabric object (mirrors context menu onColorChange logic) */
export function applyColor(obj: FabricObject, color: string): void {
  if (obj instanceof Group) {
    const fillLight = hexToRgba(color, 0.35);
    for (const child of obj.getObjects()) {
      if (child instanceof Path) {
        const s = child.stroke as string;
        const f = child.fill as string;
        if (s && (s.startsWith("rgba") || s === "transparent")) {
          // Hachure/pattern fill path (color in stroke) or solid fill path (color in fill)
          child.set({ stroke: fillLight });
          if (f && f.startsWith("rgba")) {
            child.set({ fill: fillLight });
          }
        } else {
          child.set({ stroke: color });
        }
      }
    }
  }
}
