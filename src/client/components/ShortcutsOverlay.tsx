import { useEffect } from "react";

const POPPINS_STYLE = { fontFamily: "'Poppins', sans-serif" };

const SHORTCUTS = [
  { section: "Tools", items: [
    { keys: "V", desc: "Pointer" },
    { keys: "H", desc: "Hand (pan)" },
    { keys: "P", desc: "Pencil" },
    { keys: "M", desc: "Marker" },
    { keys: "R", desc: "Rectangle" },
    { keys: "C", desc: "Circle / Ellipse" },
    { keys: "A", desc: "Arrow" },
    { keys: "L", desc: "Line" },
    { keys: "T", desc: "Text" },
    { keys: "B", desc: "Paint bucket" },
  ]},
  { section: "Actions", items: [
    { keys: "⌘ Z", desc: "Undo" },
    { keys: "⌘ ⇧ Z", desc: "Redo" },
    { keys: "⌘ C", desc: "Copy" },
    { keys: "⌘ V", desc: "Paste" },
    { keys: "⌘ G", desc: "Group" },
    { keys: "⌘ ⇧ G", desc: "Ungroup" },
    { keys: "Delete", desc: "Delete selected" },
    { keys: "Esc", desc: "Deselect" },
  ]},
  { section: "Canvas", items: [
    { keys: "Space + drag", desc: "Pan" },
    { keys: "Scroll", desc: "Zoom" },
    { keys: "Shift + drag", desc: "Constrain shape" },
    { keys: "Right-click", desc: "Context menu" },
    { keys: "?", desc: "Toggle this panel" },
  ]},
];

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-popover border border-border rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
        style={POPPINS_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-popover-foreground">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-popover-foreground text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
        {SHORTCUTS.map(({ section, items }) => (
          <div key={section} className="mb-4 last:mb-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{section}</h3>
            <div className="space-y-1">
              {items.map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between py-0.5">
                  <span className="text-sm text-popover-foreground">{desc}</span>
                  <kbd className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
