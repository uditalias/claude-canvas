---
name: claude-canvas
description: Draw visual diagrams, wireframes, and flowcharts on a shared canvas. Ask users visual Q&A questions with interactive answer panels.
---

# Claude Canvas

A shared visual canvas for drawing diagrams, wireframes, flowcharts, and visual Q&A.

## When to Use

Use this skill when you want to:
- Show the user a visual diagram, wireframe, or layout
- Draw architecture diagrams or flowcharts with connected boxes
- Present visual options and ask the user to choose (visual Q&A)
- Sketch UI mockups or component layouts
- Illustrate concepts with shapes, arrows, and text

## Prerequisites

The canvas server must be running. Start it first:

```bash
claude-canvas start
```

This opens a browser window with the shared canvas. Stop it when done:

```bash
claude-canvas stop
```

## Drawing Shapes

Send draw commands as JSON:

```bash
claude-canvas draw '{"commands": [...]}'
```

Or pipe from stdin for large payloads:

```bash
echo '{"commands": [...]}' | claude-canvas draw -
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
| `text` | `x, y, content, fontSize?, textAlign?` | `{"type":"text","x":200,"y":50,"content":"Title","fontSize":24,"textAlign":"center"}` |

**Freehand:**

| Type | Parameters | Example |
|------|-----------|---------|
| `freehand` | `points: [[x,y],...]` | `{"type":"freehand","points":[[10,10],[50,30],[90,10]]}` |

**Groups and Connectors** (for flowcharts/diagrams):

| Type | Parameters | Example |
|------|-----------|---------|
| `group` | `id, commands: DrawCommand[]` | `{"type":"group","id":"box-a","commands":[...]}` |
| `connector` | `from, to, label?` | `{"type":"connector","from":"box-a","to":"box-b"}` |

### Fill Styles

Shapes default to `"hachure"` (hand-drawn cross-hatch). Options:
`"hachure"` | `"solid"` | `"zigzag"` | `"cross-hatch"` | `"dots"` | `"dashed"` | `"zigzag-line"` | `"none"`

Use `"none"` for wireframe outlines.

### Colors

Pass `color` as a hex string: `"color": "#D4726A"`. Default is a muted blue.

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

## Visual Q&A

Ask the user structured questions with visual context. Each question can have its own canvas drawing.

```bash
claude-canvas ask '{"questions": [
  {
    "id": "q1",
    "text": "Which layout do you prefer?",
    "type": "single",
    "options": ["Layout A", "Layout B"],
    "commands": [
      {"type": "rect", "x": 80, "y": 80, "width": 200, "height": 150, "label": "Layout A"},
      {"type": "rect", "x": 350, "y": 80, "width": 200, "height": 150, "label": "Layout B"}
    ]
  }
]}'
```

### Question Types

| Type | Description | Answer Format |
|------|------------|---------------|
| `single` | Pick one option (pill buttons) | `"value": "Option A"` |
| `multi` | Pick multiple options (toggle pills) | `"value": ["Option A", "Option C"]` |
| `text` | Type free text | `"value": "user's text"` |
| `canvas` | Draw on canvas as answer | `"value": "see canvas", "canvasSnapshot": "/path/to/png"` |

### Collecting Answers

After asking, call `screenshot` to get answers:

```bash
claude-canvas screenshot
```

Response:
```json
{
  "ok": true,
  "path": "/tmp/claude-canvas/canvas-123.png",
  "answers": [
    {"questionId": "q1", "value": "Layout A"},
    {"questionId": "q2", "value": ["Fast", "Reliable"]},
    {"questionId": "q3", "value": "Alice"}
  ]
}
```

## Other Commands

```bash
claude-canvas clear                    # Clear all objects
claude-canvas clear --layer claude     # Clear only Claude's objects (keep user drawings)
claude-canvas screenshot               # Capture canvas as PNG + collect Q&A answers
claude-canvas export -f png            # Export as PNG
claude-canvas export -f svg            # Export as SVG
claude-canvas export -f json           # Export as JSON (DrawCommand format)
claude-canvas export -f png --labels   # Export with shape labels included
```

## Tips

- The visible canvas area is roughly 1200x800 pixels. Place shapes within this range.
- Use `label` on shapes for clarity — labels float above shapes as text overlays.
- Use `textAlign: "center"` with text inside groups to center text within boxes.
- For groups, place the text `x` at the center of the rect (`rect.x + rect.width/2`).
- After drawing, call `screenshot` to capture and verify what the user sees.
- Use `clear --layer claude` to remove your drawings without erasing user drawings.
- Connectors automatically route between group edges — just specify `from` and `to` group IDs.
