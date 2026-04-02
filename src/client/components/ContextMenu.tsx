import { useEffect, useRef, useState } from "react";
import { Slider } from "./ui/slider";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";

interface TextOptions {
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  underline: boolean;
  linethrough: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  opacity: number;
  locked: boolean;
  textOptions?: TextOptions;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onOpacityChange: (opacity: number) => void;
  onToggleLock: () => void;
  onTextChange?: (opts: Partial<TextOptions>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const POPPINS_STYLE = { fontFamily: "'Poppins', sans-serif" };

const menuItemClass =
  "w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent cursor-pointer transition-colors";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];

export function ContextMenu({ x, y, opacity: initialOpacity, locked, textOptions, onBringToFront, onSendToBack, onDuplicate, onOpacityChange, onToggleLock, onTextChange, onDelete, onClose }: ContextMenuProps) {
  const [opacity, setOpacity] = useState(Math.round(initialOpacity * 100));
  const [fontSize, setFontSize] = useState(textOptions?.fontSize ?? 16);
  const [fontWeight, setFontWeight] = useState(textOptions?.fontWeight ?? "normal");
  const [fontStyle, setFontStyle] = useState(textOptions?.fontStyle ?? "normal");
  const [underline, setUnderline] = useState(textOptions?.underline ?? false);
  const [linethrough, setLinethrough] = useState(textOptions?.linethrough ?? false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    document.addEventListener("keydown", handleEscape);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-[300] w-48"
      style={{ left: x, top: y, ...POPPINS_STYLE }}
    >
      <button className={menuItemClass} onClick={() => { onBringToFront(); onClose(); }}>
        Bring to front
      </button>
      <button className={menuItemClass} onClick={() => { onSendToBack(); onClose(); }}>
        Send to back
      </button>
      <button className={menuItemClass} onClick={() => { onDuplicate(); onClose(); }}>
        Duplicate
      </button>
      <button className={menuItemClass} onClick={() => { onToggleLock(); onClose(); }}>
        {locked ? "Unlock" : "Lock"}
      </button>
      <div className="h-px bg-border my-1" />
      {textOptions && onTextChange && (
        <>
          <div className="px-3 py-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Font size</span>
              <select
                value={fontSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFontSize(val);
                  onTextChange({ fontSize: val });
                }}
                className="text-xs bg-muted text-popover-foreground border-none rounded px-1.5 py-0.5 cursor-pointer"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const next = fontWeight === "bold" ? "normal" : "bold";
                  setFontWeight(next);
                  onTextChange({ fontWeight: next });
                }}
                className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                  fontWeight === "bold" ? "bg-accent text-popover-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = fontStyle === "italic" ? "normal" : "italic";
                  setFontStyle(next);
                  onTextChange({ fontStyle: next });
                }}
                className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                  fontStyle === "italic" ? "bg-accent text-popover-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = !underline;
                  setUnderline(next);
                  onTextChange({ underline: next });
                }}
                className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                  underline ? "bg-accent text-popover-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = !linethrough;
                  setLinethrough(next);
                  onTextChange({ linethrough: next });
                }}
                className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                  linethrough ? "bg-accent text-popover-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="h-px bg-border my-1" />
        </>
      )}
      <div className="px-3 py-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Opacity</span>
          <span className="text-xs text-muted-foreground">{opacity}%</span>
        </div>
        <Slider
          min={5}
          max={100}
          step={5}
          value={[opacity]}
          onValueChange={([val]) => {
            setOpacity(val);
            onOpacityChange(val / 100);
          }}
        />
      </div>
      <div className="h-px bg-border my-1" />
      <button
        className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
        onClick={() => { onDelete(); onClose(); }}
      >
        Delete
      </button>
    </div>
  );
}
