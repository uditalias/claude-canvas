# Claude Canvas DSL Reference

A concise drawing language for the canvas. Use `--dsl` with `draw` and `ask` commands.

## Quick Start

```bash
# Simple shapes
claude-canvas draw --dsl 'box "Server" 200x120; box "Database" 200x120'

# Layout with row
claude-canvas draw --dsl 'row gap=40 { box "Frontend" 200x150; box "Backend" 200x150; box "DB" 200x150 }'

# Visual Q&A
claude-canvas ask --dsl 'ask { question #q1 single "Pick a style" { options "Modern" | "Classic" } }'
```

## Shapes

### box

Leaf box (fixed size):
```
box "Label" 200x150
box "Label" 200x150 fill=solid color=#8AAD5A
```

Container box (wraps children, auto-sized):
```
box "Container" pad=20 {
  box "Child A" 150x80
  box "Child B" 150x80
}
```

**Attributes:** `fill`, `color`, `opacity`, `pad` (container only)

### circle

```
circle "Node" 60
circle "Highlight" 40 fill=solid color=#D4726A
```

The number is the radius.

**Attributes:** `fill`, `color`, `opacity`

### ellipse

```
ellipse "Badge" 180x100
ellipse "Cloud" 220x140 fill=hachure color=#7198C9
```

**Attributes:** `fill`, `color`, `opacity`

### Shape Attributes

| Attribute | Values | Default | Description |
|-----------|--------|---------|-------------|
| `fill` | `hachure`, `solid`, `zigzag`, `cross-hatch`, `dots`, `dashed`, `zigzag-line`, `none` | `hachure` | Fill pattern. Use `none` for wireframes |
| `color` | Hex string (e.g., `#D4726A`) | Muted blue | Shape color |
| `opacity` | `0` to `1` | `1` | Transparency |
| `pad` | Number | `10` | Inner padding (container box only) |

## Text

```
text "Hello World"
text "Title" size=28 align=center weight=bold
text "Subtitle" size=14 style=italic color=#555555 opacity=0.5
```

| Attribute | Values | Default |
|-----------|--------|---------|
| `size` | Number (font size in px) | `16` |
| `align` | `left`, `center`, `right` | `left` |
| `weight` | `bold`, `normal` | `normal` |
| `style` | `italic`, `normal` | `normal` |
| `color` | Hex string | Default text color |
| `opacity` | `0` to `1` | `1` |

## Lines & Arrows

### With absolute coordinates

```
line 100,200 -> 400,200
arrow 100,300 -> 400,300 "data flow"
```

Format: `line|arrow x1,y1 -> x2,y2 "optional label"`

### With label-based routing

Reference shapes by their label string. The engine auto-routes from edge to edge:

```
box "Frontend" 200x120
box "Backend" 200x120
arrow "Frontend" -> "Backend" "API calls"
```

The arrow connects the edges of the two boxes automatically.

**Attributes:** `color`, `opacity`

## Layout

Layout containers position children automatically so you don't need coordinates.

### row

Places children side by side (horizontally):

```
row gap=40 {
  box "A" 200x150
  box "B" 200x150
  box "C" 200x150
}
```

Produces: `[A]  [B]  [C]` with 40px gaps between them.

### stack

Places children top to bottom (vertically):

```
stack gap=20 {
  box "Header" 400x60
  box "Content" 400x200
  box "Footer" 400x60
}
```

Produces:
```
[Header ]
[Content]
[Footer ]
```

### Nesting

Combine `row` and `stack` for complex layouts:

```
stack gap=20 {
  box "Nav" 600x50 fill=none
  row gap=20 {
    box "Sidebar" 150x300 fill=none
    box "Main" 430x300 fill=none
  }
}
```

### Top-level stacking

Multiple top-level shapes are stacked vertically with a default 20px gap:

```
box "First" 300x100
box "Second" 300x100
```

These render top-to-bottom automatically.

## Groups & Connectors

Use `group` with `#id` for flowcharts. Connectors auto-route between groups:

```
group #start {
  box "Start" 140x60
  text "Begin here" size=12 align=center
}
group #process {
  box "Process" 140x60
  text "Do work" size=12 align=center
}
group #end {
  box "End" 140x60
  text "Done" size=12 align=center
}

#start -> #process
#process -> #end
```

Connector shorthand: `#fromId -> #toId "optional label"`

## Ask Blocks

Send structured questions with visual context:

```bash
claude-canvas ask --dsl 'ask {
  question #q1 single "Which layout?" {
    options "Layout A" | "Layout B"
    row gap=40 {
      box "Layout A" 200x150 fill=none color=#7198C9
      box "Layout B" 200x150 fill=none color=#8AAD5A
    }
  }
  question #q2 text "What should the title be?" {
    text "Your Title Here" size=24 align=center
  }
}'
```

Or pipe from stdin:

```bash
claude-canvas ask --dsl -
```

### Question types

| Type | Description | User interaction |
|------|-------------|-----------------|
| `single` | Pick one option | Radio-style pill buttons |
| `multi` | Pick multiple options | Toggle pill buttons |
| `text` | Type free text | Text input |
| `canvas` | Draw on canvas | Freehand drawing |

### Question syntax

```
question #id type "Question text" {
  options "Option A" | "Option B"    # for single/multi types
  # draw commands for visual context:
  box "Example" 200x100
}
```

The draw commands inside a question block render on the canvas when that question is active.

## Draw Attributes

Top-level attributes for the draw payload:

```bash
# Add narration text that animates while shapes render
claude-canvas draw --dsl 'narration "Here is the architecture"; box "API" 200x120'

# Disable animation for instant rendering
claude-canvas draw --dsl 'animate=false; box "A" 200x100; box "B" 200x100'
```

| Attribute | Description |
|-----------|-------------|
| `narration "text"` | Text that animates on screen while shapes appear |
| `animate=false` | Render all shapes instantly (default: `true`) |

You can also use `--no-animate` CLI flag instead of `animate=false`.

## Full Examples

### Architecture Diagram

```bash
claude-canvas draw --dsl '
narration "System architecture overview"
row gap=60 {
  stack gap=20 {
    box "Web App" 180x80 fill=solid color=#7198C9
    box "Mobile App" 180x80 fill=solid color=#7198C9
  }
  stack gap=20 {
    box "API Gateway" 180x80 fill=solid color=#8AAD5A
    box "Auth Service" 180x80 fill=hachure color=#8AAD5A
  }
  stack gap=20 {
    box "PostgreSQL" 180x80 fill=solid color=#D9925E
    box "Redis" 180x80 fill=hachure color=#D9925E
  }
}
arrow "Web App" -> "API Gateway" "REST"
arrow "Mobile App" -> "API Gateway" "GraphQL"
arrow "API Gateway" -> "PostgreSQL" "queries"
arrow "Auth Service" -> "Redis" "sessions"
'
```

### UI Wireframe Comparison

```bash
claude-canvas draw --dsl '
row gap=60 {
  box "Option A" pad=10 {
    stack gap=8 {
      box "Header" 280x40 fill=none
      row gap=8 {
        box "Sidebar" 80x200 fill=none
        box "Content" 188x200 fill=none
      }
    }
  }
  box "Option B" pad=10 {
    stack gap=8 {
      box "Header" 280x40 fill=none
      box "Content" 280x200 fill=none
      box "Footer" 280x30 fill=none
    }
  }
}
'
```

### Flowchart

```bash
claude-canvas draw --dsl '
group #input {
  box "User Input" 160x60
}
group #validate {
  box "Validate" 160x60 color=#C4A73A
}
group #success {
  box "Save" 160x60 color=#8AAD5A
}
group #error {
  box "Show Error" 160x60 color=#D4726A
}
#input -> #validate
#validate -> #success "valid"
#validate -> #error "invalid"
'
```

### Multi-Question Ask

```bash
claude-canvas ask --dsl '
ask {
  question #layout single "Which page layout do you prefer?" {
    options "Two Column" | "Full Width"
    row gap=40 {
      box "Two Column" pad=10 {
        row gap=8 {
          box "Side" 80x150 fill=none color=#7198C9
          box "Main" 160x150 fill=none color=#7198C9
        }
      }
      box "Full Width" pad=10 {
        box "Content" 260x150 fill=none color=#8AAD5A
      }
    }
  }
  question #theme single "Light or dark theme?" {
    options "Light" | "Dark"
    row gap=40 {
      box "Light" 200x150 fill=solid color=#C4A73A
      box "Dark" 200x150 fill=solid color=#555555
    }
  }
  question #name text "What should we call this project?" {
    text "Project Name" size=24 align=center
  }
  question #sketch canvas "Draw your ideal homepage layout" {
    box "Canvas Area" 500x300 fill=none
  }
}
'
```

## Common Patterns

```bash
# Wireframe box (outline only)
box "Section" 300x200 fill=none

# Highlighted box
box "Important" 200x100 fill=solid color=#D4726A

# Faded/deprecated element
box "Legacy" 200x100 opacity=0.4

# Side-by-side comparison
row gap=40 { box "Before" 250x200; box "After" 250x200 }

# Vertical list
stack gap=10 { box "Step 1" 300x60; box "Step 2" 300x60; box "Step 3" 300x60 }

# Titled diagram
text "Architecture" size=28 weight=bold
row gap=40 { box "A" 200x120; box "B" 200x120; box "C" 200x120 }

# Semicolons separate statements on one line
box "A" 200x100; box "B" 200x100

# Comments start with # (space after hash)
# This is a comment
box "Visible" 200x100
```

## Colors Reference

| Color | Hex |
|-------|-----|
| Black | `#000000` |
| Gray | `#555555` |
| Red | `#D4726A` |
| Orange | `#D9925E` |
| Yellow | `#C4A73A` |
| Green | `#8AAD5A` |
| Teal | `#6DBDAD` |
| Blue | `#7198C9` |
| Purple | `#9B85B5` |
| Pink | `#D47C9A` |
