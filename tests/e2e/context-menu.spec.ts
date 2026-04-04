import { test, expect } from "@playwright/test";
import { httpGet } from "../helpers";
import * as fs from "fs";

async function exportAndParse(): Promise<any[]> {
  const result = await httpGet(
    "http://127.0.0.1:7890/api/export?format=json&labels=false",
  );
  expect(result.ok).toBe(true);
  expect(result.path).toMatch(/\.json$/);
  const raw = fs.readFileSync(result.path, "utf-8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data.commands ?? [];
}

test("right-click context menu can duplicate a shape", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Use the last canvas element — Fabric.js upper canvas receives mouse events
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  // Select rectangle tool and draw a rect
  await page.press("body", "r");
  await page.mouse.move(cx - 75, cy - 50);
  await page.mouse.down();
  await page.mouse.move(cx + 75, cy + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // After drawing, the tool auto-selects pointer and selects the shape.
  // Right-click on the shape to open context menu
  await page.mouse.click(cx, cy, { button: "right" });

  // Wait for context menu to appear
  await page.waitForSelector('[role="menuitem"]', { timeout: 3000 });

  // Click "Duplicate"
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await page.waitForTimeout(500);

  // Verify there are at least 2 objects on canvas (original + duplicate)
  const count = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(count).toBeGreaterThanOrEqual(2);
});

test("right-click context menu can delete a shape", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Use the last canvas element — Fabric.js upper canvas receives mouse events
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  // Select rectangle tool and draw a rect
  await page.press("body", "r");
  await page.mouse.move(cx - 75, cy - 50);
  await page.mouse.down();
  await page.mouse.move(cx + 75, cy + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Verify we have 1 object
  const commandsBefore = await exportAndParse();
  expect(commandsBefore.length).toBe(1);

  // After drawing, the tool auto-selects pointer and selects the shape.
  // Right-click on the shape to open context menu
  await page.mouse.click(cx, cy, { button: "right" });

  // Wait for context menu to appear
  await page.waitForSelector('[role="menuitem"]', { timeout: 3000 });

  // Click "Delete"
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.waitForTimeout(500);

  // Verify the shape was removed from canvas
  const countAfter = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countAfter).toBe(0);
});
