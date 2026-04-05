import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mock classes inside vi.hoisted so they are available to vi.mock factories
const {
  MockFabricObject,
  MockPath,
  MockFabricText,
  MockGroup,
  MockCanvas,
  MockRoughArrow,
  MockRoughLine,
} = vi.hoisted(() => {
  class MockFabricObject {
    props: Record<string, any> = {};
    data: any;
    set(opts: any) {
      Object.assign(this.props, opts);
      if (opts.data) this.data = opts.data;
      return this;
    }
    setCoords() {}
    get dirty() { return false; }
    set dirty(_v: boolean) {}
  }

  class MockPath extends MockFabricObject {
    pathData: string;
    constructor(pathData: string, opts: any) {
      super();
      this.pathData = pathData;
      this.set(opts);
    }
  }

  class MockFabricText extends MockFabricObject {
    text: string;
    constructor(text: string, opts: any) {
      super();
      this.text = text;
      this.set(opts);
    }
  }

  class MockGroup extends MockFabricObject {
    objects: any[];
    constructor(objects: any[], opts?: any) {
      super();
      this.objects = objects;
      if (opts) this.set(opts);
    }
    getObjects() { return this.objects; }
  }

  class MockCanvas {
    _objects: any[] = [];
    add(obj: any) { this._objects.push(obj); }
    remove(obj: any) { this._objects = this._objects.filter((o: any) => o !== obj); }
    getObjects() { return this._objects; }
  }

  class MockRoughArrow extends MockFabricObject {
    _coords: number[];
    constructor(coords: number[], opts: any) {
      super();
      this._coords = coords;
      this.set(opts);
    }
  }

  class MockRoughLine extends MockFabricObject {
    constructor(_coords: number[], opts: any) {
      super();
      this.set(opts);
    }
  }

  return {
    MockFabricObject,
    MockPath,
    MockFabricText,
    MockGroup,
    MockCanvas,
    MockRoughArrow,
    MockRoughLine,
  };
});

// ── Mock fabric ──────────────────────────────────────────────────────────────
vi.mock("fabric", () => ({
  Canvas: MockCanvas,
  Path: MockPath,
  FabricText: MockFabricText,
  FabricObject: MockFabricObject,
  Group: MockGroup,
  Point: class { constructor(public x: number, public y: number) {} },
  Line: MockFabricObject,
  Control: class {},
  controlsUtils: {},
}));

// ── Mock wobble ──────────────────────────────────────────────────────────────
vi.mock("../../src/client/lib/wobble", () => {
  const makeShape = (type: string) => (...args: any[]) => {
    const g = new MockGroup([]);
    g.set({ data: { _mockType: type, _mockArgs: args } });
    return g;
  };
  return {
    wobbleRect: makeShape("rect"),
    wobbleCircle: makeShape("circle"),
    wobbleEllipse: makeShape("ellipse"),
    wobbleLine: makeShape("line"),
    wobbleArrow: makeShape("arrow"),
    STROKE_COLOR: "#000000",
    FILL_COLOR: "#B5651D",
    STROKE_WIDTH: 1.5,
    FONT_FAMILY: "Inter, sans-serif",
    hexToRgba: (hex: string, alpha: number) => `rgba(0,0,0,${alpha})`,
  };
});

// ── Mock rough-line ──────────────────────────────────────────────────────────
vi.mock("../../src/client/lib/rough-line", () => ({
  RoughArrowObject: MockRoughArrow,
  RoughLineObject: MockRoughLine,
}));

// ── Mock colors ──────────────────────────────────────────────────────────────
vi.mock("../../src/client/lib/colors", () => ({
  applyColor: vi.fn(),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import { renderCommandsToCanvas as _renderCommandsToCanvas } from "../../src/client/lib/render-engine";
import { applyColor } from "../../src/client/lib/colors";
import { Canvas, FabricText, Path, Group } from "fabric";
import type { DrawCommand } from "../../src/protocol/types";

// Wrap to return `any[]` — mocked Fabric objects have dynamic `data` property
const renderCommandsToCanvas = _renderCommandsToCanvas as (canvas: any, commands: DrawCommand[]) => any[];

describe("renderCommandsToCanvas", () => {
  let canvas: any;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = new (Canvas as any)();
  });

  it("returns empty array for empty commands", () => {
    const result = renderCommandsToCanvas(canvas, []);
    expect(result).toEqual([]);
    expect(canvas.getObjects()).toHaveLength(0);
  });

  // ── Shape commands ─────────────────────────────────────────────────────────

  it("renders rect command", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 10, y: 20, width: 100, height: 50 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    expect(canvas.getObjects()).toHaveLength(1);
    const obj = result[0];
    expect(obj.data.layer).toBe("claude");
    expect(obj.data.shapeType).toBe("rect");
    expect(obj.data.geo).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("renders circle command", () => {
    const cmds: DrawCommand[] = [
      { type: "circle", x: 50, y: 60, radius: 30 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0];
    expect(obj.data.layer).toBe("claude");
    expect(obj.data.shapeType).toBe("circle");
    expect(obj.data.geo).toEqual({ x: 50, y: 60, radius: 30 });
  });

  it("renders ellipse command", () => {
    const cmds: DrawCommand[] = [
      { type: "ellipse", x: 100, y: 100, width: 80, height: 40 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0];
    expect(obj.data.shapeType).toBe("ellipse");
    expect(obj.data.geo).toEqual({ x: 100, y: 100, width: 80, height: 40 });
  });

  it("renders line command", () => {
    const cmds: DrawCommand[] = [
      { type: "line", x1: 0, y1: 0, x2: 100, y2: 100 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0];
    expect(obj.data.shapeType).toBe("line");
    expect(obj.data.layer).toBe("claude");
  });

  it("renders arrow command", () => {
    const cmds: DrawCommand[] = [
      { type: "arrow", x1: 10, y1: 20, x2: 200, y2: 300 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0];
    expect(obj.data.shapeType).toBe("arrow");
    expect(obj.data.layer).toBe("claude");
  });

  // ── Text command ───────────────────────────────────────────────────────────

  it("renders text command with defaults", () => {
    const cmds: DrawCommand[] = [
      { type: "text", x: 50, y: 100, content: "Hello World" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0] as any;
    expect(obj).toBeInstanceOf(FabricText);
    expect(obj.text).toBe("Hello World");
    expect(obj.props.left).toBe(50);
    expect(obj.props.top).toBe(100);
    expect(obj.props.fontSize).toBe(16);
    expect(obj.props.fontFamily).toBe("Inter, sans-serif");
    expect(obj.data.shapeType).toBe("text");
  });

  it("renders text command with custom fontSize and textAlign", () => {
    const cmds: DrawCommand[] = [
      { type: "text", x: 200, y: 50, content: "Centered", fontSize: 24, textAlign: "center" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    const obj = result[0] as any;
    expect(obj.props.fontSize).toBe(24);
    expect(obj.props.textAlign).toBe("center");
    expect(obj.props.originX).toBe("center");
  });

  it("renders text with right alignment", () => {
    const cmds: DrawCommand[] = [
      { type: "text", x: 200, y: 50, content: "Right", textAlign: "right" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    const obj = result[0] as any;
    expect(obj.props.originX).toBe("right");
  });

  // ── Freehand command ───────────────────────────────────────────────────────

  it("renders freehand command as Path", () => {
    const cmds: DrawCommand[] = [
      { type: "freehand", points: [[10, 20], [30, 40], [50, 60]] },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const obj = result[0] as any;
    expect(obj).toBeInstanceOf(Path);
    expect(obj.pathData).toBe("M 10 20 L 30 40 L 50 60");
    expect(obj.data.shapeType).toBe("freehand");
  });

  it("skips freehand with fewer than 2 points", () => {
    const cmds: DrawCommand[] = [
      { type: "freehand", points: [[10, 20]] },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(0);
    expect(canvas.getObjects()).toHaveLength(0);
  });

  // ── Group command ──────────────────────────────────────────────────────────

  it("renders group command wrapping child commands", () => {
    const cmds: DrawCommand[] = [
      {
        type: "group",
        id: "g1",
        commands: [
          { type: "rect", x: 0, y: 0, width: 50, height: 50 },
          { type: "circle", x: 25, y: 25, radius: 10 },
        ],
      },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(1);
    const group = result[0] as any;
    expect(group).toBeInstanceOf(Group);
    expect(group.data.shapeType).toBe("group");
    expect(group.data.groupId).toBe("g1");
    // The group should contain the 2 child objects
    expect(group.objects).toHaveLength(2);
  });

  it("replaces existing group with same ID", () => {
    const cmds1: DrawCommand[] = [
      { type: "group", id: "g1", commands: [{ type: "rect", x: 0, y: 0, width: 50, height: 50 }] },
    ];
    renderCommandsToCanvas(canvas, cmds1);
    expect(canvas.getObjects()).toHaveLength(1);

    const cmds2: DrawCommand[] = [
      { type: "group", id: "g1", commands: [{ type: "circle", x: 10, y: 10, radius: 20 }] },
    ];
    renderCommandsToCanvas(canvas, cmds2);
    expect(canvas.getObjects()).toHaveLength(1);
    const group = canvas.getObjects()[0] as any;
    expect(group.data.groupId).toBe("g1");
  });

  // ── Label ──────────────────────────────────────────────────────────────────

  it("sets label on shape data", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 100, height: 100, label: "My Box" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.label).toBe("My Box");
  });

  it("sets label on line commands", () => {
    const cmds: DrawCommand[] = [
      { type: "line", x1: 0, y1: 0, x2: 100, y2: 100, label: "Line Label" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.label).toBe("Line Label");
  });

  it("sets label on arrow commands", () => {
    const cmds: DrawCommand[] = [
      { type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100, label: "Arrow Label" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.label).toBe("Arrow Label");
  });

  // ── Color ──────────────────────────────────────────────────────────────────

  it("calls applyColor when color is set on a shape", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50, color: "#ff0000" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(applyColor).toHaveBeenCalledWith(result[0], "#ff0000");
  });

  it("calls applyColor for circle with color", () => {
    const cmds: DrawCommand[] = [
      { type: "circle", x: 50, y: 50, radius: 25, color: "#00ff00" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(applyColor).toHaveBeenCalledWith(result[0], "#00ff00");
  });

  it("calls applyColor for line with color", () => {
    const cmds: DrawCommand[] = [
      { type: "line", x1: 0, y1: 0, x2: 100, y2: 100, color: "#0000ff" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(applyColor).toHaveBeenCalledWith(result[0], "#0000ff");
  });

  it("does not call applyColor when no color is set", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50 },
    ];
    renderCommandsToCanvas(canvas, cmds);
    expect(applyColor).not.toHaveBeenCalled();
  });

  // ── Opacity ────────────────────────────────────────────────────────────────

  it("sets opacity on shape when specified", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50, opacity: 0.5 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect((result[0] as any).props.opacity).toBe(0.5);
  });

  it("sets opacity on text when specified", () => {
    const cmds: DrawCommand[] = [
      { type: "text", x: 0, y: 0, content: "Faded", opacity: 0.3 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect((result[0] as any).props.opacity).toBe(0.3);
  });

  it("sets opacity on freehand when specified", () => {
    const cmds: DrawCommand[] = [
      { type: "freehand", points: [[0, 0], [10, 10]], opacity: 0.7 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect((result[0] as any).props.opacity).toBe(0.7);
  });

  // ── FillStyle ──────────────────────────────────────────────────────────────

  it("stores non-default fillStyle in data", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50, fillStyle: "solid" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.fillStyle).toBe("solid");
  });

  it("does not store fillStyle when it is the default hachure", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.fillStyle).toBeUndefined();
  });

  it("resolves fill:false to fillStyle none", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50, fill: false },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.fillStyle).toBe("none");
  });

  it("explicit fillStyle overrides fill:false", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50, fill: false, fillStyle: "dots" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result[0].data.fillStyle).toBe("dots");
  });

  // ── Connector ──────────────────────────────────────────────────────────────

  it("skips connector when from/to groups not found", () => {
    const cmds: DrawCommand[] = [
      { type: "connector", from: "nonexistent1", to: "nonexistent2" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(0);
    expect(canvas.getObjects()).toHaveLength(0);
  });

  // ── Multiple commands ──────────────────────────────────────────────────────

  it("renders multiple commands in sequence", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 100, height: 50 },
      { type: "circle", x: 200, y: 200, radius: 40 },
      { type: "text", x: 50, y: 50, content: "Hi" },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    expect(result).toHaveLength(3);
    expect(canvas.getObjects()).toHaveLength(3);
    expect(result[0].data.shapeType).toBe("rect");
    expect(result[1].data.shapeType).toBe("circle");
    expect(result[2].data.shapeType).toBe("text");
  });

  // ── Tag as claude ──────────────────────────────────────────────────────────

  it("tags all shapes as non-selectable and non-evented", () => {
    const cmds: DrawCommand[] = [
      { type: "rect", x: 0, y: 0, width: 50, height: 50 },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    const obj = result[0] as any;
    expect(obj.props.selectable).toBe(false);
    expect(obj.props.evented).toBe(false);
  });

  // ── Text styling options ───────────────────────────────────────────────────

  it("applies text styling options (fontWeight, fontStyle, underline, linethrough)", () => {
    const cmds: DrawCommand[] = [
      {
        type: "text",
        x: 0,
        y: 0,
        content: "Styled",
        fontWeight: "bold",
        fontStyle: "italic",
        underline: true,
        linethrough: true,
      },
    ];
    const result = renderCommandsToCanvas(canvas, cmds);
    const obj = result[0] as any;
    expect(obj.props.fontWeight).toBe("bold");
    expect(obj.props.fontStyle).toBe("italic");
    expect(obj.props.underline).toBe(true);
    expect(obj.props.linethrough).toBe(true);
  });

  it("uses text color from command or falls back to FILL_COLOR", () => {
    const cmds1: DrawCommand[] = [
      { type: "text", x: 0, y: 0, content: "Red", color: "#ff0000" },
    ];
    const r1 = renderCommandsToCanvas(canvas, cmds1);
    expect((r1[0] as any).props.fill).toBe("#ff0000");

    canvas = new (Canvas as any)();
    const cmds2: DrawCommand[] = [
      { type: "text", x: 0, y: 0, content: "Default" },
    ];
    const r2 = renderCommandsToCanvas(canvas, cmds2);
    expect((r2[0] as any).props.fill).toBe("#B5651D");
  });
});
