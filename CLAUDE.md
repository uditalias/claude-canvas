# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

claude-canvas is a shared visual canvas that runs as a local server + browser client. Claude Code can send draw commands (shapes, arrows, text, freehand paths) via CLI or HTTP API, and users can also draw interactively in the browser. Communication between server and browser happens over WebSocket.

The canvas also serves as a **visual Q&A tool**: Claude can send structured questions alongside canvas drawings, and users answer by picking options, typing text, or drawing on the canvas.

## Commands

- **Dev (full stack):** `npm run dev` — runs the server via tsx with hot reload
- **Dev (client only):** `npm run dev:client` — Vite dev server on :5173, proxies API/WS to :7890
- **Build:** `npm run build` — builds both client (Vite) and server (esbuild)
- **Build client only:** `npm run build:client`
- **Build server only:** `npm run build:server`
- **Run tests:** `npm test` (or `npx vitest run`)
- **Run single test:** `npx vitest run tests/protocol.test.ts`
- **Run E2E tests:** `npx playwright test` (requires `npm run build` first)
- **Run all tests:** `npm test && npx playwright test`

## CLI Usage

### Session management
Each `start` creates an isolated canvas session with its own server and browser tab:
```bash
claude-canvas start                    # → { sessionId, port, url, pid }
claude-canvas stop -s <sessionId>      # Stop a specific session
claude-canvas stop --all               # Stop all sessions
```

### Basic drawing
All commands accept `-s, --session <id>`. Omit if only one session is running.
```bash
claude-canvas draw '<DrawPayload>'     # Send draw commands
claude-canvas draw -                   # Read DrawPayload from stdin
claude-canvas clear                    # Clear all canvas objects
claude-canvas clear --layer claude     # Clear only Claude's objects
claude-canvas screenshot               # Returns JSON: { path, answers }
```

### Visual Q&A (ask command)
Send structured questions with per-question canvas drawings in a single batch:
```bash
claude-canvas ask '<AskPayload>'       # Send all questions at once
claude-canvas ask -                    # Read AskPayload from stdin
```

**AskPayload format:**
```json
{
  "questions": [
    {
      "id": "q1",
      "text": "Which layout do you prefer?",
      "type": "single",
      "options": ["Layout A", "Layout B"],
      "commands": [
        {"type": "rect", "x": 80, "y": 80, "width": 200, "height": 150, "label": "Layout A", "fill": false},
        {"type": "rect", "x": 350, "y": 80, "width": 200, "height": 150, "label": "Layout B", "fill": false}
      ]
    },
    {
      "id": "q2",
      "text": "What should the title be?",
      "type": "text",
      "commands": [
        {"type": "text", "x": 300, "y": 100, "content": "Your Title Here", "fontSize": 24, "textAlign": "center"}
      ]
    }
  ]
}
```

**Question types:**
- `single` — user picks one option (radio-style pill buttons)
- `multi` — user picks multiple options (toggle pill buttons)
- `text` — user types free text
- `canvas` — user draws on the canvas as their answer

**Flow:**
1. Claude sends `ask` with all questions
2. A floating panel appears at the bottom — user navigates and answers
3. User clicks Done when all answered
4. Claude calls `screenshot` — response includes `answers` array alongside the PNG path

**Screenshot response with answers:**
```json
{
  "ok": true,
  "path": "/tmp/claude-canvas/canvas-xxx.png",
  "answers": [
    {"questionId": "q1", "value": "Layout A"},
    {"questionId": "q2", "value": "My Custom Title"},
    {"questionId": "q3", "value": ["Option A", "Option C"]},
    {"questionId": "q4", "value": "see canvas", "canvasSnapshot": "/tmp/claude-canvas/canvas-q4-xxx.png"}
  ]
}
```

### DrawCommand reference

All shapes support `label?: string` (floating text above the shape).

```typescript
// Shapes (fillStyle defaults to "hachure"; set fillStyle: "none" for wireframes)
// fillStyle: "hachure" | "solid" | "zigzag" | "cross-hatch" | "dots" | "dashed" | "zigzag-line" | "none"
{ type: "rect", x, y, width, height, label?, fillStyle? }
{ type: "circle", x, y, radius, label?, fillStyle? }
{ type: "ellipse", x, y, width, height, label?, fillStyle? }

// Lines
{ type: "line", x1, y1, x2, y2, label? }
{ type: "arrow", x1, y1, x2, y2, label? }

// Text (textAlign: "left" | "center" | "right")
{ type: "text", x, y, content, fontSize?, textAlign? }

// Freehand
{ type: "freehand", points: [[x,y], ...] }

// Grouping
{ type: "group", id, commands: DrawCommand[] }
```

## Architecture

### Protocol (`src/protocol/types.ts`)
Central type definitions shared by server and client. `DrawCommand` is a discriminated union (rect, circle, ellipse, line, arrow, text, freehand, group, connector). `Question`, `Answer`, `AskPayload` define the Q&A system. `WsMessage` wraps draw/clear/ask/screenshot messages.

### Server (`src/server/`)
Express + WebSocket server. Key files:
- `state.ts` — in-memory state: connected WebSocket clients, broadcast helpers (DRY `broadcast()` function), screenshot request/resolve
- `router.ts` — REST endpoints: `POST /api/draw`, `POST /api/ask`, `POST /api/clear`, `GET /api/screenshot`, `GET /health`
- `websocket.ts` — attaches WS server, routes incoming screenshot responses (supports both legacy string and new `{image, answers}` format)
- `process.ts` — session management (PID/port stored in `~/.claude-canvas/session.json`), server spawning

### CLI (`src/bin/claude-canvas.ts`)
Commander-based CLI with subcommands: `start`, `stop`, `draw <json>`, `ask <json>`, `clear`, `screenshot`. Both `draw` and `ask` accept `-` for stdin.

### Client (`src/client/`)
React + Fabric.js + Tailwind CSS 4 + shadcn/ui (Radix primitives). Vite-built SPA.

Key hooks:
- `useCanvas` — initializes Fabric.js canvas, handles zoom/pan, renders incoming `DrawCommand[]` as rough.js wobble-styled shapes, dot grid background via `before:render`, shape labels via `after:render` + DOM overlay, ResizeObserver for auto-resize
- `useDrawingTools` — interactive drawing (rect, circle, line, arrow, freehand, text, paint) with tool state, theme-aware paint cursor
- `useWebSocket` — connects to `ws://host/ws`, parses `WsMessage`, auto-reconnects with exponential backoff (1s-30s)
- `useToolState` — active tool, color presets (soft muted palette), brush size, keyboard shortcuts
- `useUndoRedo` — canvas undo/redo via snapshots (50-state history), filters non-user objects
- `useSnapGuides` — alignment snap guides when moving objects (5px threshold, 9-point alignment)
- `useQuestionPanel` — Q&A state management: per-question canvas JSON snapshots, batch question support, answer collection

Key components:
- `Canvas.tsx` — main canvas view, wires all hooks, handles WS messages (draw/ask/clear/screenshot), context menu, label editing, screenshot with canvas-type answer PNGs
- `QuestionPanel.tsx` — floating bottom card with question navigation, answer types (single/multi/text/canvas), Done button
- `Toolbox.tsx` — vertical toolbar with drawing tools, color picker, brush size
- `Hud.tsx` — connection indicator with reconnect status, zoom controls with undo/redo
- `ContextMenu.tsx` — right-click menu: color, fill toggle, label edit, opacity, lock, layer order

Custom Fabric objects:
- `lib/rough-line.ts` — `RoughLineObject` and `RoughArrowObject` extend Fabric `Line` with rough.js rendering, endpoint controls, `objectCaching: false` to prevent clipping

Layer convention: objects have `data.layer` set to `"user"` (drawn interactively) or `"claude"` (drawn via API). During Q&A, Claude's shapes become interactive (selectable/movable). The `clear --layer` flag uses this to selectively clear.

Shape labels: stored on `data.label`. Rendered as floating DOM elements above the bounding box. User shapes: double-click or context menu to edit. Claude shapes: visible but not editable.

### Path alias
`@` maps to `src/client/` (configured in vite.config.ts and components.json).

## Skill Installation

Copy the skill folder to your Claude skills directory to enable Claude to use the canvas tool:

```bash
cp -r src/skill/claude-canvas ~/.claude/skills/
```
