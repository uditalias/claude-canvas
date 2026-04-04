import { test, expect } from "@playwright/test";
import { httpGet, httpPost } from "../helpers";
import * as fs from "fs";

test("clear removes all objects from canvas", async ({ page }) => {
  await page.goto("/");

  // Wait for WebSocket to connect
  await page.waitForTimeout(1000);

  // Send a draw command via API
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "rect", x: 100, y: 100, width: 200, height: 150, label: "Clear Me" },
    ],
  });
  expect(drawResult.ok).toBe(true);

  // Wait for rendering
  await page.waitForTimeout(1000);

  // Clear all objects
  const clearResult = await httpPost("http://127.0.0.1:7890/api/clear", {});
  expect(clearResult.ok).toBe(true);

  // Wait for clear to propagate
  await page.waitForTimeout(500);

  // Take screenshot — should still work even though canvas is empty
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
});

test("clear with layer=claude removes only Claude objects", async ({ page }) => {
  await page.goto("/");

  // Wait for WebSocket to connect
  await page.waitForTimeout(1000);

  // Claude draws a rect via API
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "rect", x: 100, y: 100, width: 200, height: 150, label: "Claude Shape" },
    ],
  });
  expect(drawResult.ok).toBe(true);

  // Wait for rendering
  await page.waitForTimeout(1000);

  // Draw a user shape interactively: press r for rect tool, drag on canvas, press v to deselect
  await page.keyboard.press("r");
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 300, box!.y + 300);
  await page.mouse.down();
  await page.mouse.move(box!.x + 450, box!.y + 400, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press("v");

  // Wait for user shape to settle
  await page.waitForTimeout(500);

  // Clear only Claude's layer
  const clearResult = await httpPost(
    "http://127.0.0.1:7890/api/clear?layer=claude",
    {}
  );
  expect(clearResult.ok).toBe(true);

  // Wait for clear to propagate
  await page.waitForTimeout(500);

  // Export as JSON — user-drawn shape should still be present
  const exportResult = await httpGet(
    "http://127.0.0.1:7890/api/export?format=json"
  );
  expect(exportResult.ok).toBe(true);
  expect(exportResult.format).toBe("json");

  const jsonContent = fs.readFileSync(exportResult.path, "utf-8");
  const parsed = JSON.parse(jsonContent);
  expect(parsed.commands.length).toBeGreaterThan(0);

  // Now do a full clear
  const fullClearResult = await httpPost("http://127.0.0.1:7890/api/clear", {});
  expect(fullClearResult.ok).toBe(true);

  // Wait for clear to propagate
  await page.waitForTimeout(500);

  // Export again — should now be empty
  const exportResult2 = await httpGet(
    "http://127.0.0.1:7890/api/export?format=json"
  );
  expect(exportResult2.ok).toBe(true);

  const jsonContent2 = fs.readFileSync(exportResult2.path, "utf-8");
  const parsed2 = JSON.parse(jsonContent2);
  expect(parsed2.commands).toHaveLength(0);
});
