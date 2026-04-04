import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";

test("connector lines between groups render correctly", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Send draw commands with 2 groups and a connector
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      {
        type: "group",
        id: "box-a",
        commands: [
          { type: "rect", x: 50, y: 100, width: 120, height: 80 },
          { type: "text", x: 110, y: 130, content: "Box A", textAlign: "center" },
        ],
      },
      {
        type: "group",
        id: "box-b",
        commands: [
          { type: "rect", x: 350, y: 100, width: 120, height: 80 },
          { type: "text", x: 410, y: 130, content: "Box B", textAlign: "center" },
        ],
      },
      {
        type: "connector",
        from: "box-a",
        to: "box-b",
        label: "connects",
      },
    ],
  });
  expect(drawResult.ok).toBe(true);

  // Wait for rendering
  await page.waitForTimeout(2000);

  // Verify objects rendered on canvas (2 groups + 1 connector = 3 objects)
  const objectCount = await page.evaluate(() => {
    const canvas = (window as any).__fabricCanvas;
    return canvas ? canvas.getObjects().length : 0;
  });
  expect(objectCount).toBe(3);

  // Take screenshot to confirm visual rendering
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
});

test("multiple groups with connectors form a diagram", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Send a 3-node flowchart with 2 connectors
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      {
        type: "group",
        id: "start",
        commands: [
          { type: "rect", x: 200, y: 30, width: 120, height: 60 },
          { type: "text", x: 260, y: 50, content: "Start", textAlign: "center" },
        ],
      },
      {
        type: "group",
        id: "process",
        commands: [
          { type: "rect", x: 200, y: 150, width: 120, height: 60 },
          { type: "text", x: 260, y: 170, content: "Process", textAlign: "center" },
        ],
      },
      {
        type: "group",
        id: "end",
        commands: [
          { type: "rect", x: 200, y: 270, width: 120, height: 60 },
          { type: "text", x: 260, y: 290, content: "End", textAlign: "center" },
        ],
      },
      { type: "connector", from: "start", to: "process" },
      { type: "connector", from: "process", to: "end" },
    ],
  });
  expect(drawResult.ok).toBe(true);

  // Wait for rendering
  await page.waitForTimeout(2000);

  // Verify all 5 objects rendered (3 groups + 2 connectors)
  const objectCount = await page.evaluate(() => {
    const canvas = (window as any).__fabricCanvas;
    return canvas ? canvas.getObjects().length : 0;
  });
  expect(objectCount).toBe(5);

  // Screenshot succeeds
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
});
