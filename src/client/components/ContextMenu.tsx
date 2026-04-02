import { useEffect, useRef, useState } from "react";
import { Slider } from "./ui/slider";

interface ContextMenuProps {
  x: number;
  y: number;
  opacity: number;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onOpacityChange: (opacity: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

const POPPINS_STYLE = { fontFamily: "'Poppins', sans-serif" };

const menuItemClass =
  "w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent cursor-pointer transition-colors";

export function ContextMenu({ x, y, opacity: initialOpacity, onBringToFront, onSendToBack, onDuplicate, onOpacityChange, onDelete, onClose }: ContextMenuProps) {
  const [opacity, setOpacity] = useState(Math.round(initialOpacity * 100));
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
      <div className="h-px bg-border my-1" />
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
