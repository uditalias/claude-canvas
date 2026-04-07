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

## Drawing Format (DSL)

The canvas supports a concise DSL (domain-specific language) for drawing. Use `--dsl` with `draw` and `ask` commands. The DSL handles layout automatically — no manual coordinate math needed.

### Shapes

```
box "Label" WIDTHxHEIGHT                           # Rectangle
box "Label" WIDTHxHEIGHT fill=solid color=#8AAD5A   # With attributes
box "Container" pad=20 { ...children... }            # Auto-sized container
circle "Node" 60                                     # Circle (radius)
circle "Dot" 30 fill=solid color=#D4726A
ellipse "Badge" 180x100                              # Ellipse
```

Attributes: `fill` (hachure/solid/zigzag/cross-hatch/dots/dashed/zigzag-line/none), `color` (#hex), `opacity` (0-1), `pad` (container only)

### Text

```
text "Hello World"
text "Title" size=28 align=center weight=bold
text "Subtitle" size=14 style=italic color=#555555 opacity=0.5
```

Attributes: `size` (font px), `align` (left/center/right), `weight` (bold/normal), `style` (italic/normal), `color`, `opacity`

### Layout

```
row gap=40 {                    # Horizontal: [A] [B] [C]
  box "A" 200x150
  box "B" 200x150
}

stack gap=20 {                  # Vertical
  box "Header" 400x60
  box "Content" 400x200
}

stack gap=20 {                  # Nesting
  box "Nav" 600x50 fill=none
  row gap=20 {
    box "Sidebar" 150x300 fill=none
    box "Main" 430x300 fill=none
  }
}
```

### Lines & Arrows

```
line 100,200 -> 400,200                        # Absolute coords
arrow 100,300 -> 400,300 "data flow"           # With label
arrow "Frontend" -> "Backend" "API calls"      # Label-based (auto-routes edge to edge)
```

### Groups & Connectors

```
group #start { box "Start" 140x60 }
group #process { box "Process" 140x60 }
group #end { box "End" 140x60 }
connector #start -> #process
connector #process -> #end "next step"
```

Shorthand: `#start -> #process` (without `connector` keyword)

### Ask Blocks

```
ask {
  question #q1 single "Which layout?" {
    options "Layout A" | "Layout B"
    row gap=40 {
      box "Layout A" 200x150 fill=none color=#7198C9
      box "Layout B" 200x150 fill=none color=#8AAD5A
    }
  }
  question #q2 text "Any notes?"
}
```

Question types: `single` (pick one), `multi` (pick many), `text` (free text), `canvas` (draw)

### Draw Attributes

```
narration "Here is the architecture"    # Animated text while shapes render
animate=false                           # Instant rendering
```

### Other DSL Features

- Semicolons separate statements on one line: `box "A" 200x100; box "B" 200x100`
- Comments: `# This is a comment`
- Colors: `#000000` (black), `#555555` (gray), `#D4726A` (red), `#D9925E` (orange), `#C4A73A` (yellow), `#8AAD5A` (green), `#6DBDAD` (teal), `#7198C9` (blue), `#9B85B5` (purple), `#D47C9A` (pink)

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

Send draw commands using DSL format (use `--session` if multiple sessions are running):

```bash
claude-canvas draw --dsl --session a1b2c3d4 'row gap=40 { box "Frontend" 200x120; box "Backend" 200x120 }'
```

Or pipe from stdin for large payloads:

```bash
echo 'row gap=40 { box "A" 200x150; box "B" 200x150 }' | claude-canvas draw --dsl --session a1b2c3d4 -
```

> Or use JSON format without `--dsl` flag: `claude-canvas draw '{"commands": [...]}'`

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
claude-canvas draw --dsl 'narration "Here is the system architecture"; box "API" 200x120; box "DB" 200x120'
```

> Or JSON: `claude-canvas draw '{"narration": "Here is the system architecture", "commands": [...]}'`

### JSON Format (Alternative)

You can also use JSON without `--dsl`. See the protocol types in `src/protocol/types.ts` for the full `DrawCommand` schema. JSON requires manual x/y coordinates for every shape.

## Common Patterns

### Simple Diagram

```bash
claude-canvas draw --dsl '
row gap=40 {
  box "Frontend" 200x100
  box "Backend" 200x100
}
arrow "Frontend" -> "Backend" "API"
'
```

### Flowchart with Connectors

```bash
claude-canvas draw --dsl '
group #start { box "Start" 140x60; text "Begin" align=center }
group #process { box "Process" 140x60; text "Do work" align=center }
group #end { box "End" 140x60; text "Done" align=center }
#start -> #process
#process -> #end
'
```

### Wireframe Layout

```bash
claude-canvas draw --dsl '
stack gap=20 {
  box "Navigation" 500x60 fill=none
  row gap=20 {
    box "Sidebar" 150x300 fill=none
    box "Main Content" 330x300 fill=none
  }
}
'
```

### Drawing with Narration

```bash
claude-canvas draw --dsl '
narration "Let me show you how the components connect"
row gap=40 {
  box "Component A" 180x80 fill=hachure
  box "Component B" 180x80 fill=solid
}
arrow "Component A" -> "Component B" "data flow"
'
```

### Using Styled Text

```bash
claude-canvas draw --dsl '
text "Architecture Overview" size=28 align=center weight=bold
text "Draft — subject to change" size=14 align=center style=italic opacity=0.5
'
```

### Using Color and Opacity

```bash
claude-canvas draw --dsl '
row gap=40 {
  box "Active" 200x100 color=#8AAD5A fill=solid
  box "Deprecated" 200x100 color=#D4726A fill=hachure opacity=0.4
}
'
```

## Visual Q&A

Ask the user structured questions with visual context. Each question can have its own canvas drawing.

**IMPORTANT: Make each option visually descriptive.** Don't just draw colored shapes — draw what the option actually represents. Include labels, inner text, example content, and structure so the user can understand each option at a glance without reading the question text.

```bash
claude-canvas ask --dsl '
ask {
  question #q1 single "Which layout do you prefer?" {
    options "Layout A" | "Layout B"
    row gap=40 {
      box "Layout A" pad=10 {
        stack gap=8 {
          box "Header / Nav" 230x40 fill=hachure color=#7198C9
          row gap=8 {
            box "Side" 70x120 fill=hachure color=#7198C9
            box "Main Content" 150x120 fill=none color=#7198C9
          }
        }
      }
      box "Layout B" pad=10 {
        stack gap=8 {
          box "Header / Nav" 230x40 fill=hachure color=#8AAD5A
          box "Full-Width Content" 230x120 fill=none color=#8AAD5A
        }
      }
    }
  }
}
'
```

You can also pipe from stdin for large payloads:

```bash
echo 'ask { question #q1 text "Your name?" }' | claude-canvas ask --dsl -
```

> Or use JSON format without `--dsl` flag: `claude-canvas ask '{"questions": [...]}'`

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
claude-canvas ask --dsl '
ask {
  question #q1 single "Pick a layout" {
    options "A" | "B"
    row gap=40 { box "A" 200x150 fill=none; box "B" 200x150 fill=none }
  }
  question #q2 text "Name this feature" {
    text "Feature Name" size=24 align=center
  }
  question #q3 canvas "Draw your changes" {
    box "Draw here" 400x250 fill=none
  }
}
'
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

## Status Updates (MANDATORY)

**IMPORTANT: Always send status updates so the user sees activity on the canvas while you work.** Generating draw/ask commands takes time — without status updates, the user stares at a blank canvas wondering if anything is happening.

The status text appears in the top badge next to the green connection dot.

```bash
claude-canvas status 'Designing diagram layout...'   # Send immediately
# ... then generate and send your draw/ask command
```

### Required status flow for drawing

Send the status command **as your first tool call**, before generating the draw payload:

```bash
# Step 1: Status update (executes immediately — user sees it on canvas)
claude-canvas status 'Drawing architecture diagram...'

# Step 2: Draw command (takes time to generate — user sees status while waiting)
claude-canvas draw --dsl 'row gap=40 { box "A" 200x120; box "B" 200x120 }'

# Step 3: Clear status when done
claude-canvas status ''
```

### Required status flow for Q&A

For `ask` commands, send a status update first so the user knows questions are being prepared:

```bash
# Step 1: Status update (executes immediately)
claude-canvas status 'Preparing questions...'

# Step 2: Ask command (takes time to generate — user sees status while waiting)
claude-canvas ask --dsl 'ask { question #q1 single "Pick one" { options "A" | "B" } }'
```

The `ask` command blocks until the user submits answers, so no need to clear status — the question panel provides its own feedback.

### Status message examples

Use descriptive, context-aware messages:
- `'Designing layout options...'` — before drawing layout comparisons
- `'Sketching architecture diagram...'` — before drawing system diagrams
- `'Preparing wireframe...'` — before drawing UI wireframes
- `'Setting up questions...'` — before ask commands
- `'Processing your feedback...'` — after collecting answers
- `''` — clear status (resets to "Connected")

## Session Lifecycle

Always stop the canvas session when you are done with it:

```bash
claude-canvas stop --session a1b2c3d4
```

After collecting answers from `ask` or finishing your drawing work, call `stop` to clean up the session. This frees the port and closes the browser tab.

Use `claude-canvas list` to check which sessions are currently running before starting a new one.

## Tips

- **Prefer DSL format** (`--dsl`) — it handles layout automatically, no coordinate math needed.
- Use `row` and `stack` to arrange shapes instead of calculating positions manually.
- Use `fill=none` for wireframe outlines, `fill=solid` for filled shapes.
- Use label-based arrows (`arrow "A" -> "B"`) to connect shapes by name.
- After drawing, call `screenshot` to capture and verify what the user sees.
- Use `clear --layer claude` to remove your drawings without erasing user drawings.
- Connectors automatically route between group edges — just specify `#fromId -> #toId`.
- Use `narration` to explain what you're drawing as it appears on screen.
- Use `--no-animate` or `animate=false` when rendering many shapes at once for speed.
- The user can draw, annotate, move, and resize shapes on the canvas alongside your drawings.
- Use different `color` values to visually distinguish different parts of a diagram.
- Use `opacity` to de-emphasize background elements or show deprecated components.
- **For Q&A questions**: draw the actual content each option represents, not just colored shapes. Include inner structure, labels, and example text so the user can visually compare options.
- **Always stop sessions** when done — call `claude-canvas stop --session <id>` after collecting answers.
