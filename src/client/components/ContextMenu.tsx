import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
} from "./ui/dropdown-menu";
import { COLOR_PRESETS } from "../hooks/useToolState";

interface TextOptions {
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  underline: boolean;
  linethrough: boolean;
}

export interface CanvasContextMenuContentProps {
  opacity: number;
  locked: boolean;
  fillStyle?: string;
  label?: string;
  textOptions?: TextOptions;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onOpacityChange: (opacity: number) => void;
  onToggleLock: () => void;
  onCenterOnCanvas: () => void;
  onTextChange?: (opts: Partial<TextOptions>) => void;
  onColorChange?: (color: string) => void;
  onFillStyleChange?: (style: string) => void;
  onEditLabel?: () => void;
  onDelete: () => void;
}

const FILL_STYLE_LABELS: [string, string][] = [
  ["hachure", "Hachure"],
  ["solid", "Solid"],
  ["zigzag", "Zigzag"],
  ["cross-hatch", "Cross-hatch"],
  ["dots", "Dots"],
  ["dashed", "Dashed"],
  ["zigzag-line", "Zigzag line"],
  ["none", "None"],
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
const OPACITY_PRESETS = [100, 75, 50, 25, 10];

export function CanvasContextMenuContent(props: CanvasContextMenuContentProps) {
  const {
    opacity, locked, fillStyle, label, textOptions,
    onBringToFront, onSendToBack, onDuplicate, onOpacityChange,
    onToggleLock, onCenterOnCanvas, onTextChange, onColorChange, onFillStyleChange, onEditLabel, onDelete,
  } = props;

  return (
    <DropdownMenuContent className="w-52" side="right" align="start" sideOffset={0}>
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={onBringToFront}>Bring to front</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSendToBack}>Send to back</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleLock}>{locked ? "Unlock" : "Lock"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onCenterOnCanvas}>Center on canvas</DropdownMenuItem>
        {onEditLabel && (
          <DropdownMenuItem onSelect={onEditLabel}>
            {label ? "Edit label" : "Add label"}
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>

      {textOptions && onTextChange && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Font size ({textOptions.fontSize}px)</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={String(textOptions.fontSize)}
                onValueChange={(v) => onTextChange({ fontSize: Number(v) })}
              >
                {FONT_SIZES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={String(s)}>
                    {s}px
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={textOptions.fontWeight === "bold"}
            onCheckedChange={(checked) => onTextChange({ fontWeight: checked ? "bold" : "normal" })}
          >
            Bold
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={textOptions.fontStyle === "italic"}
            onCheckedChange={(checked) => onTextChange({ fontStyle: checked ? "italic" : "normal" })}
          >
            Italic
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={textOptions.underline}
            onCheckedChange={(checked) => onTextChange({ underline: !!checked })}
          >
            Underline
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={textOptions.linethrough}
            onCheckedChange={(checked) => onTextChange({ linethrough: !!checked })}
          >
            Strikethrough
          </DropdownMenuCheckboxItem>
        </>
      )}

      {onColorChange && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <div className="grid grid-cols-5 gap-1 p-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    onClick={() => onColorChange(c)}
                  />
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}

      {onFillStyleChange && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Fill style</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={fillStyle || "hachure"}
                onValueChange={(v) => onFillStyleChange(v)}
              >
                {FILL_STYLE_LABELS.map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}

      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Opacity ({Math.round(opacity * 100)}%)</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={String(Math.round(opacity * 100))}
            onValueChange={(v) => onOpacityChange(Number(v) / 100)}
          >
            {OPACITY_PRESETS.map((v) => (
              <DropdownMenuRadioItem key={v} value={String(v)}>
                {v}%
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={onDelete}
        className="text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
