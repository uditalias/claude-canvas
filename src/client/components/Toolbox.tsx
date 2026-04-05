import {
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Square,
  Circle as CircleIcon,
  MoveRight,
  Minus,
  Type,
  PaintBucket,
  Palette,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
} from "lucide-react";
import LogoSvg from "../assets/logo.svg?raw";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Slider } from "./ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import type { ToolType, ToolState } from "../hooks/useToolState";
import { COLOR_PRESETS, TOOL_SHORTCUTS } from "../hooks/useToolState";
import type { ThemeMode } from "../hooks/useTheme";

const POPPINS_STYLE = { fontFamily: "'Poppins', sans-serif" };

const DRAWING_TOOLS: { type: ToolType; icon: React.ElementType; label: string }[] = [
  { type: "pointer", icon: MousePointer2, label: "Pointer" },
  { type: "hand", icon: Hand, label: "Hand" },
  { type: "pencil", icon: Pencil, label: "Pencil" },
  { type: "marker", icon: Highlighter, label: "Marker" },
];

const SHAPE_TOOLS: { type: ToolType; icon: React.ElementType; label: string }[] = [
  { type: "rect", icon: Square, label: "Rectangle" },
  { type: "circle", icon: CircleIcon, label: "Circle" },
  { type: "arrow", icon: MoveRight, label: "Arrow" },
  { type: "line", icon: Minus, label: "Line" },
];

const OTHER_TOOLS: { type: ToolType; icon: React.ElementType; label: string }[] = [
  { type: "text", icon: Type, label: "Text" },
  { type: "paint", icon: PaintBucket, label: "Paint" },
];

function getShortcutForTool(tool: ToolType): string {
  for (const [key, t] of Object.entries(TOOL_SHORTCUTS)) {
    if (t === tool) return key.toUpperCase();
  }
  return "";
}

function ToolButton({
  type,
  icon: Icon,
  label,
  activeTool,
  selectTool,
}: {
  type: ToolType;
  icon: React.ElementType;
  label: string;
  activeTool: ToolType;
  selectTool: (tool: ToolType) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => selectTool(type)}
          className={`w-9 h-9 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTool === type
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
              : "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#333338]"
          }`}
          aria-label={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" style={POPPINS_STYLE}>
        {label} ({getShortcutForTool(type)})
      </TooltipContent>
    </Tooltip>
  );
}

interface ToolboxProps extends ToolState {
  theme: { mode: ThemeMode; setThemeMode: (m: ThemeMode) => void };
  onShowShortcuts?: () => void;
}

export function Toolbox({ activeTool, selectTool, color, setColor, brushSize, setBrushSize, theme, onShowShortcuts }: ToolboxProps) {
  return (
    <div
      className="flex flex-col items-center w-[52px] min-w-[52px] h-full bg-white dark:bg-[#232328] border-r border-gray-200 dark:border-[#333338] py-3 gap-0.5 z-50 select-none"
      style={POPPINS_STYLE}
    >
      {/* Logo */}
      <div
        className="w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-300 mb-1"
        dangerouslySetInnerHTML={{ __html: LogoSvg }}
      />

      {/* Separator */}
      <div className="w-7 h-px bg-gray-200 dark:bg-[#333338] my-1.5" />

      {/* Drawing tools group */}
      <div className="flex flex-col items-center gap-0.5">
        {DRAWING_TOOLS.map(({ type, icon, label }) => (
          <ToolButton
            key={type}
            type={type}
            icon={icon}
            label={label}
            activeTool={activeTool}
            selectTool={selectTool}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="w-7 h-px bg-gray-200 dark:bg-[#333338] my-1.5" />

      {/* Shape tools group */}
      <div className="flex flex-col items-center gap-0.5">
        {SHAPE_TOOLS.map(({ type, icon, label }) => (
          <ToolButton
            key={type}
            type={type}
            icon={icon}
            label={label}
            activeTool={activeTool}
            selectTool={selectTool}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="w-7 h-px bg-gray-200 dark:bg-[#333338] my-1.5" />

      {/* Other tools group */}
      <div className="flex flex-col items-center gap-0.5">
        {OTHER_TOOLS.map(({ type, icon, label }) => (
          <ToolButton
            key={type}
            type={type}
            icon={icon}
            label={label}
            activeTool={activeTool}
            selectTool={selectTool}
          />
        ))}
      </div>

      {/* Separator between tools and color/size */}
      <div className="w-7 h-px bg-gray-300 dark:bg-[#333338] my-2" />

      {/* Color popover */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333338]"
                aria-label="Color"
              >
                <div
                  className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm"
                  style={{ backgroundColor: color }}
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" style={POPPINS_STYLE}>
            Color
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="right" className="w-auto p-3" sideOffset={8}>
          <div className="flex flex-col gap-2" style={POPPINS_STYLE}>
            <label className="text-xs text-gray-500">Color</label>
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className="w-6 h-6 rounded-full border border-gray-300 cursor-pointer transition-transform hover:scale-110"
                  style={{
                    backgroundColor: preset,
                    outline: color === preset ? "2px solid #2563EB" : "none",
                    outlineOffset: "1px",
                  }}
                  onClick={() => setColor(preset)}
                  aria-label={`Color ${preset}`}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-7 cursor-pointer border-0 p-0"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Brush size popover */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333338]"
                aria-label="Brush size"
              >
                <div
                  className="rounded-full"
                  style={{
                    width: Math.max(4, Math.min(brushSize * 2, 20)),
                    height: Math.max(4, Math.min(brushSize * 2, 20)),
                    backgroundColor: color,
                  }}
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" style={POPPINS_STYLE}>
            Brush size
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="right" className="w-auto p-3" sideOffset={8}>
          <div className="flex flex-col items-center gap-2" style={POPPINS_STYLE}>
            <label className="text-xs text-gray-500">Size: {brushSize}px</label>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[brushSize]}
              onValueChange={([val]) => setBrushSize(val)}
              className="w-32"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShowShortcuts}
            className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#333338]"
            aria-label="Keyboard shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" style={POPPINS_STYLE}>
          Shortcuts (?)
        </TooltipContent>
      </Tooltip>

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              const next: ThemeMode = theme.mode === "light" ? "dark" : theme.mode === "dark" ? "system" : "light";
              theme.setThemeMode(next);
            }}
            className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#333338]"
            aria-label="Toggle theme"
          >
            {theme.mode === "light" ? <Sun className="w-4 h-4" /> : theme.mode === "dark" ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" style={POPPINS_STYLE}>
          Theme: {theme.mode}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
