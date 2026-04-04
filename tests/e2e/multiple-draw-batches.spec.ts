import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";

test("multiple draw batches accumulate on canvas", async ({ page }) => {
  await page.goto("/");

  // Wait for WebSocket to connect
  await page.waitForTimeout(1000);

  // Send first batch
  const batch1 = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "rect", x: 50, y: 50, width: 100, height: 80, label: "Batch1" },
    ],
  });
  expect(batch1.ok).toBe(true);

  await page.waitForTimeout(500);

  // Send second batch
  const batch2 = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "circle", x: 300, y: 100, radius: 50, label: "Batch2" },
      { type: "text", x: 300, y: 200, content: "Second batch" },
    ],
  });
  expect(batch2.ok).toBe(true);

  await page.waitForTimeout(500);

  // Send third batch
  const batch3 = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "arrow", x1: 150, y1: 90, x2: 250, y2: 100, label: "Batch3" },
    ],
  });
  expect(batch3.ok).toBe(true);

  // Wait for all batches to render
  await page.waitForTimeout(1500);

  // Verify all 3 labels are visible as DOM overlays
  await expect(page.locator("text=Batch1")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("text=Batch2")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("text=Batch3")).toBeVisible({ timeout: 5000 });

  // Verify canvas has all 4 objects (1 rect + 1 circle + 1 text + 1 arrow)
  const objectCount = await page.evaluate(() => {
    const canvas = (window as any).__fabricCanvas;
    return canvas ? canvas.getObjects().length : 0;
  });
  expect(objectCount).toBe(4);

  // Screenshot succeeds
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
});
