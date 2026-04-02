import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onBringToFront, onSendToBack, onDuplicate, onDelete, onClose }: ContextMenuProps) {
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
    // Delay attaching listener so the opening right-click doesn't immediately close the menu
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
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[300] min-w-[160px]"
      style={{
        left: x,
        top: y,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <button
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => { onBringToFront(); onClose(); }}
      >
        Bring to front
      </button>
      <button
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => { onSendToBack(); onClose(); }}
      >
        Send to back
      </button>
      <button
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => { onDuplicate(); onClose(); }}
      >
        Duplicate
      </button>
      <div className="h-px bg-gray-200 my-1" />
      <button
        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
        onClick={() => { onDelete(); onClose(); }}
      >
        Delete
      </button>
    </div>
  );
}
