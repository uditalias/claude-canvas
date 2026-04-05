---
name: claude-canvas
description: Draw visual diagrams, wireframes, and flowcharts on a shared canvas. Ask the user visual Q&A questions with interactive answer panels. Collect visual feedback instead of terminal-only text.
---

# Claude Canvas

A visual canvas tool for Claude Code — instead of asking questions in the terminal, draw diagrams, wireframes, and mockups on a shared canvas and collect visual feedback from the user.

## When to Use

Use this skill when you want to:
- Show the user a visual diagram, wireframe, or layout
- Draw architecture diagrams or flowcharts with connected boxes
- Present visual options and ask the user to choose (visual Q&A)
- Sketch UI mockups or component layouts
- Illustrate concepts with shapes, arrows, and text
- Ask the user to draw or annotate on the canvas as feedback

## Prerequisites

The canvas server must be running. Start it first:

```bash
claude-canvas start
```

This opens a browser window with a new canvas session and returns JSON:
```json
{"sessionId":"a1b2c3d4","port":7890,"url":"http://127.0.0.1:7890","pid":1234}
```

Use the `sessionId` in all subsequent commands. If only one session is running, `--session` can be omitted.

Stop a specific session or all sessions when done:

```bash
claude-canvas stop --session a1b2c3d4   # stop one
claude-canvas stop --all                 # stop all
```

## Drawing Shapes

Send draw commands as JSON (use `--session` if multiple sessions are running):

```bash
claude-canvas draw --session a1b2c3d4 '{"commands": [...]}'
```

Or pipe from stdin for large payloads:

```bash
echo '{"commands": [...]}' | claude-canvas draw --session a1b2c3d4 -
```

### DrawPayload Options

The draw command accepts a JSON object with these top-level properties:

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `DrawCommand[]` | Required. Array of draw commands |
| `narration` | `string` | Optional. Narration text that animates on screen while shapes render |
| `animate` | `boolean` | Optional. Set `false` to render shapes instantly (default: `true`) |

You can also disable animation via the CLI flag `--no-animate`.

**Example with narration:**
```bash
claude-canvas draw '{"narration": "Here is the system architecture", "commands": [...]}'
```

### DrawCommand Types

**Shapes** (all support `label?`, `color?`, `opacity?`, `fillStyle?`):

| Type | Parameters | Example |
|------|-----------|---------|
| `rect` | `x, y, width, height` | `{"type":"rect","x":50,"y":50,"width":200,"height":120,"label":"Header"}` |
| `circle` | `x, y, radius` | `{"type":"circle","x":200,"y":200,"radius":60,"label":"Node"}` |
| `ellipse` | `x, y, width, height` | `{"type":"ellipse","x":300,"y":150,"width":180,"height":100}` |

**Lines:**

| Type | Parameters | Example |
|------|-----------|---------|
| `line` | `x1, y1, x2, y2` | `{"type":"line","x1":100,"y1":100,"x2":300,"y2":100}` |
| `arrow` | `x1, y1, x2, y2` | `{"type":"arrow","x1":100,"y1":200,"x2":300,"y2":200,"label":"flow"}` |

**Text:**

| Type | Parameters | Example |
|------|-----------|---------|
| `text` | `x, y, content, fontSize?, textAlign?, fontWeight?, fontStyle?, underline?, linethrough?` | `{"type":"text","x":200,"y":50,"content":"Title","fontSize":24,"textAlign":"center"}` |

Text supports rich formatting:
- `fontWeight`: `"bold"` or `"normal"` (default)
- `fontStyle`: `"italic"` or `"normal"` (default)
- `underline`: `true` to underline
- `linethrough`: `true` for strikethrough

**Freehand:**

| Type | Parameters | Example |
|------|-----------|---------|
| `freehand` | `points: [[x,y],...]` | `{"type":"freehand","points":[[10,10],[50,30],[90,10]]}` |

**Groups and Connectors** (for flowcharts/diagrams):

| Type | Parameters | Example |
|------|-----------|---------|
| `group` | `id, commands: DrawCommand[]` | `{"type":"group","id":"box-a","commands":[...]}` |
| `connector` | `from, to, label?` | `{"type":"connector","from":"box-a","to":"box-b"}` |

### Common Properties

These optional properties work on all shapes, lines, and text:

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Floating text label above the shape |
| `color` | `string` | Hex color string (e.g. `"#D4726A"`). Default: muted blue |
| `opacity` | `number` | Transparency from `0` (invisible) to `1` (opaque). Default: `1` |
| `fillStyle` | `string` | Fill pattern for shapes (see below) |

### Fill Styles

Shapes default to `"hachure"` (hand-drawn cross-hatch). Options:
`"hachure"` | `"solid"` | `"zigzag"` | `"cross-hatch"` | `"dots"` | `"dashed"` | `"zigzag-line"` | `"none"`

Use `"none"` for wireframe outlines.

### Colors

Pass `color` as a hex string: `"color": "#D4726A"`. Default is a muted blue.

Available preset colors for reference:
`#000000` (black), `#555555` (gray), `#D4726A` (red), `#D9925E` (orange), `#C4A73A` (yellow), `#8AAD5A` (green), `#6DBDAD` (teal), `#7198C9` (blue), `#9B85B5` (purple), `#D47C9A` (pink)

## Common Patterns

### Simple Diagram

```bash
claude-canvas draw '{"commands": [
  {"type": "rect", "x": 50, "y": 50, "width": 200, "height": 100, "label": "Frontend"},
  {"type": "rect", "x": 350, "y": 50, "width": 200, "height": 100, "label": "Backend"},
  {"type": "arrow", "x1": 250, "y1": 100, "x2": 350, "y2": 100, "label": "API"}
]}'
```

### Flowchart with Connectors

```bash
claude-canvas draw '{"commands": [
  {"type": "group", "id": "start", "commands": [
    {"type": "rect", "x": 200, "y": 30, "width": 140, "height": 60},
    {"type": "text", "x": 270, "y": 50, "content": "Start", "textAlign": "center"}
  ]},
  {"type": "group", "id": "process", "commands": [
    {"type": "rect", "x": 200, "y": 150, "width": 140, "height": 60},
    {"type": "text", "x": 270, "y": 170, "content": "Process", "textAlign": "center"}
  ]},
  {"type": "group", "id": "end", "commands": [
    {"type": "rect", "x": 200, "y": 270, "width": 140, "height": 60},
    {"type": "text", "x": 270, "y": 290, "content": "End", "textAlign": "center"}
  ]},
  {"type": "connector", "from": "start", "to": "process"},
  {"type": "connector", "from": "process", "to": "end"}
]}'
```

### Wireframe Layout

```bash
claude-canvas draw '{"commands": [
  {"type": "rect", "x": 50, "y": 30, "width": 500, "height": 60, "label": "Navigation", "fillStyle": "none"},
  {"type": "rect", "x": 50, "y": 110, "width": 150, "height": 300, "label": "Sidebar", "fillStyle": "none"},
  {"type": "rect", "x": 220, "y": 110, "width": 330, "height": 300, "label": "Main Content", "fillStyle": "none"}
]}'
```

### Drawing with Narration

```bash
claude-canvas draw '{"narration": "Let me show you how the components connect", "commands": [
  {"type": "rect", "x": 100, "y": 100, "width": 180, "height": 80, "label": "Component A", "fillStyle": "hachure"},
  {"type": "rect", "x": 400, "y": 100, "width": 180, "height": 80, "label": "Component B", "fillStyle": "solid"},
  {"type": "arrow", "x1": 280, "y1": 140, "x2": 400, "y2": 140, "label": "data flow"}
]}'
```

### Using Styled Text

```bash
claude-canvas draw '{"commands": [
  {"type": "text", "x": 300, "y": 30, "content": "Architecture Overview", "fontSize": 28, "fontWeight": "bold", "textAlign": "center"},
  {"type": "text", "x": 300, "y": 60, "content": "Draft — subject to change", "fontSize": 14, "fontStyle": "italic", "textAlign": "center", "opacity": 0.5}
]}'
```

### Using Color and Opacity

```bash
claude-canvas draw '{"commands": [
  {"type": "rect", "x": 50, "y": 50, "width": 200, "height": 100, "label": "Active", "color": "#8AAD5A", "fillStyle": "solid"},
  {"type": "rect", "x": 300, "y": 50, "width": 200, "height": 100, "label": "Deprecated", "color": "#D4726A", "fillStyle": "hachure", "opacity": 0.4}
]}'
```

## Visual Q&A

Ask the user structured questions with visual context. Each question can have its own canvas drawing.

**IMPORTANT: Make each option visually descriptive.** Don't just draw colored shapes — draw what the option actually represents. Include labels, inner text, example content, and structure so the user can understand each option at a glance without reading the question text.

```bash
claude-canvas ask '{"questions": [
  {
    "id": "q1",
    "text": "Which layout do you prefer?",
    "type": "single",
    "options": ["Layout A", "Layout B"],
    "commands": [
      {"type": "rect", "x": 50, "y": 80, "width": 250, "height": 200, "label": "Layout A", "fillStyle": "none", "color": "#7198C9"},
      {"type": "rect", "x": 60, "y": 100, "width": 230, "height": 40, "fillStyle": "hachure", "color": "#7198C9"},
      {"type": "text", "x": 175, "y": 110, "content": "Header / Nav", "textAlign": "center", "fontSize": 14},
      {"type": "rect", "x": 60, "y": 150, "width": 70, "height": 120, "fillStyle": "hachure", "color": "#7198C9"},
      {"type": "text", "x": 95, "y": 200, "content": "Side", "textAlign": "center", "fontSize": 12},
      {"type": "rect", "x": 140, "y": 150, "width": 150, "height": 120, "fillStyle": "none", "color": "#7198C9"},
      {"type": "text", "x": 215, "y": 200, "content": "Main Content", "textAlign": "center", "fontSize": 12},
      {"type": "rect", "x": 380, "y": 80, "width": 250, "height": 200, "label": "Layout B", "fillStyle": "none", "color": "#8AAD5A"},
      {"type": "rect", "x": 390, "y": 100, "width": 230, "height": 40, "fillStyle": "hachure", "color": "#8AAD5A"},
      {"type": "text", "x": 505, "y": 110, "content": "Header / Nav", "textAlign": "center", "fontSize": 14},
      {"type": "rect", "x": 390, "y": 150, "width": 230, "height": 120, "fillStyle": "none", "color": "#8AAD5A"},
      {"type": "text", "x": 505, "y": 200, "content": "Full-Width Content", "textAlign": "center", "fontSize": 12}
    ]
  }
]}'
```

You can also pipe from stdin for large payloads:

```bash
echo '{"questions": [...]}' | claude-canvas ask -
```

### Question Types

| Type | Description | Answer Format |
|------|------------|---------------|
| `single` | Pick one option (pill buttons) | `"value": "Option A"` |
| `multi` | Pick multiple options (toggle pills) | `"value": ["Option A", "Option C"]` |
| `text` | Type free text | `"value": "user's text"` |
| `canvas` | Draw on canvas as answer | `"value": "see canvas", "canvasSnapshot": "<base64 png>"` |

Use `canvas` type when you want the user to draw, annotate, or visually modify your diagram as their answer.

### Collecting Answers

The `ask` command **blocks until the user clicks Done** and returns answers + screenshot directly:

```json
{
  "ok": true,
  "status": "answered",
  "path": "/tmp/claude-canvas/canvas-123.png",
  "answers": [
    {"questionId": "q1", "value": "Layout A"},
    {"questionId": "q2", "value": ["Fast", "Reliable"]},
    {"questionId": "q3", "value": "Alice"},
    {"questionId": "q4", "value": "see canvas", "canvasSnapshot": "/tmp/claude-canvas/canvas-q4-xxx.png"}
  ]
}
```

No separate `screenshot` call needed — `ask` handles everything in one round-trip.

If the browser disconnects before the user submits answers:

```json
{
  "ok": false,
  "status": "disconnected",
  "error": "Browser disconnected before answers were submitted"
}
```

The `path` field contains a PNG screenshot of the canvas. For `canvas`-type questions, the `canvasSnapshot` field contains the path to a PNG of what the user drew.

### Multi-Question Flow

You can send multiple questions in a single `ask` command. The user navigates between them using arrow buttons and each question gets its own canvas state:

```bash
claude-canvas ask '{"questions": [
  {"id": "q1", "text": "Pick a layout", "type": "single", "options": ["A", "B"], "commands": [...]},
  {"id": "q2", "text": "Name this feature", "type": "text", "commands": [...]},
  {"id": "q3", "text": "Draw your changes", "type": "canvas", "commands": [...]}
]}'
```

## Other Commands

All commands accept `--session <id>` (or `-s <id>`). Omit it if only one session is running.

```bash
claude-canvas list                                        # List all running sessions
claude-canvas status 'Drawing architecture...'            # Update status badge in browser
claude-canvas status ''                                   # Clear status (resets to "Connected")
claude-canvas stop --session a1b2c3d4                     # Stop a specific session
claude-canvas stop --all                                  # Stop all sessions
claude-canvas clear --session a1b2c3d4                    # Clear all objects
claude-canvas clear --session a1b2c3d4 --layer claude     # Clear only Claude's objects
claude-canvas screenshot --session a1b2c3d4               # Capture canvas as PNG + collect Q&A answers
claude-canvas export --session a1b2c3d4 -f png            # Export as PNG
claude-canvas export --session a1b2c3d4 -f svg            # Export as SVG
claude-canvas export --session a1b2c3d4 -f json           # Export as JSON
claude-canvas export --session a1b2c3d4 -f png --labels   # Export with shape labels included
```

## Status Updates

Send status messages to the canvas badge so the user knows what's happening:

```bash
claude-canvas status 'Drawing architecture diagram...'
claude-canvas status 'Waiting for your answers...'
claude-canvas status 'Processing responses...'
claude-canvas status ''    # Clear — resets to "Connected"
```

The status text appears in the top badge next to the green connection dot. Use it at key moments:
- Before drawing: `claude-canvas status 'Drawing diagram...'`
- Before asking: `claude-canvas status 'Waiting for your answers...'`
- After collecting answers: `claude-canvas status 'Processing your feedback...'`
- When done: clear the status or stop the session

## Session Lifecycle

Always stop the canvas session when you are done with it:

```bash
claude-canvas stop --session a1b2c3d4
```

After collecting answers from `ask` or finishing your drawing work, call `stop` to clean up the session. This frees the port and closes the browser tab.

Use `claude-canvas list` to check which sessions are currently running before starting a new one.

## Tips

- The visible canvas area is roughly 1200x800 pixels. Place shapes within this range.
- Use `label` on shapes for clarity — labels float above shapes as text overlays.
- Use `textAlign: "center"` with text inside groups to center text within boxes.
- For groups, place the text `x` at the center of the rect (`rect.x + rect.width/2`).
- After drawing, call `screenshot` to capture and verify what the user sees.
- Use `clear --layer claude` to remove your drawings without erasing user drawings.
- Connectors automatically route between group edges — just specify `from` and `to` group IDs.
- Use `narration` to explain what you're drawing as it appears on screen.
- Use `--no-animate` or `"animate": false` when rendering many shapes at once for speed.
- The user can draw, annotate, move, and resize shapes on the canvas alongside your drawings.
- Use different `color` values to visually distinguish different parts of a diagram.
- Use `opacity` to de-emphasize background elements or show deprecated components.
- **For Q&A questions**: draw the actual content each option represents, not just colored shapes. Include inner structure, labels, and example text so the user can visually compare options.
- **Always stop sessions** when done — call `claude-canvas stop --session <id>` after collecting answers.
