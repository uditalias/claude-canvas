# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

claude-canvas is a shared visual canvas that runs as a local server + browser client. Claude Code can send draw commands (shapes, arrows, text, freehand paths) via CLI or HTTP API, and users can also draw interactively in the browser. Communication between server and browser happens over WebSocket.

## Commands

- **Dev (full stack):** `npm run dev` — runs the server via tsx with hot reload
- **Dev (client only):** `npm run dev:client` — Vite dev server on :5173, proxies API/WS to :7890
- **Build:** `npm run build` — builds both client (Vite) and server (esbuild)
- **Build client only:** `npm run build:client`
- **Build server only:** `npm run build:server`
- **Run tests:** `npx vitest run`
- **Run single test:** `npx vitest run tests/protocol.test.ts`

## Architecture

### Protocol (`src/protocol/types.ts`)
Central type definitions shared by server and client. `DrawCommand` is a discriminated union (rect, circle, ellipse, line, arrow, text, freehand, group, connector). `WsMessage` wraps draw/clear/screenshot messages.

### Server (`src/server/`)
Express + WebSocket server. Key files:
- `state.ts` — in-memory state: connected WebSocket clients, broadcast helpers, screenshot request/resolve
- `router.ts` — REST endpoints: `POST /api/draw`, `POST /api/clear`, `GET /api/screenshot`, `GET /health`
- `websocket.ts` — attaches WS server, routes incoming screenshot responses to state
- `process.ts` — session management (PID/port stored in `~/.claude-canvas/session.json`), server spawning

### CLI (`src/bin/claude-canvas.ts`)
Commander-based CLI with subcommands: `start`, `stop`, `draw <json>`, `clear`, `screenshot`. The `draw` command accepts a JSON `DrawPayload` (or `-` for stdin).

### Client (`src/client/`)
React + Fabric.js + Tailwind CSS 4 + shadcn/ui (Radix primitives). Vite-built SPA.

Key hooks:
- `useCanvas` — initializes Fabric.js canvas, handles zoom/pan, renders incoming `DrawCommand[]` as wobble-styled shapes (via roughjs-inspired path generation in `lib/wobble.ts`)
- `useDrawingTools` — interactive drawing (rect, circle, line, arrow, freehand, text) with tool state
- `useWebSocket` — connects to `ws://host/ws`, parses `WsMessage`, auto-reconnects
- `useToolState` — active tool, color, brush size, keyboard shortcuts
- `useUndoRedo` — canvas undo/redo via snapshots
- `useSnapGuides` — alignment snap guides when moving objects

Layer convention: objects have `data.layer` set to `"user"` (drawn interactively) or `"claude"` (drawn via API). The `clear --layer` flag uses this to selectively clear.

### Path alias
`@` maps to `src/client/` (configured in vite.config.ts and components.json).
