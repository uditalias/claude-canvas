import { test, expect } from "@playwright/test";
import { httpGet } from "../helpers";
import * as fs from "fs";

async function drawRect(
  page: import("@playwright/test").Page,
  offsetX: number,
  offsetY: number,
  dragX: number,
  dragY: number,
) {
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2 + offsetX;
  const startY = box!.y + box!.height / 2 + offsetY;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dragX, startY + dragY, { steps: 5 });
  await page.mouse.up();
}

async function clickOnCanvas(
  page: import("@playwright/test").Page,
  offsetX: number,
  offsetY: number,
) {
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width / 2 + offsetX;
  const y = box!.y + box!.height / 2 + offsetY;
  await page.mouse.click(x, y);
}

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

test("copy and paste a shape", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Select rectangle tool via keyboard shortcut
  await page.press("body", "r");

  // Draw a rectangle at the center of the canvas
  await drawRect(page, 0, 0, 150, 100);

  // After drawing, the shape is auto-selected and tool switches to pointer.
  // Wait for auto-select to settle.
  await page.waitForTimeout(500);

  // Verify 1 object before copy/paste
  const countBefore = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countBefore).toBe(1);

  // Copy the shape
  await page.keyboard.press("Meta+c");
  await page.waitForTimeout(200);

  // Paste the shape
  await page.keyboard.press("Meta+v");
  await page.waitForTimeout(500);

  // Verify at least 2 objects exist on canvas (original + paste)
  const countAfter = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countAfter).toBeGreaterThanOrEqual(2);
});

test("delete a shape with Backspace", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Select rectangle tool via keyboard shortcut
  await page.press("body", "r");

  // Draw a rectangle at the center of the canvas
  await drawRect(page, 0, 0, 150, 100);

  // After drawing, the shape is auto-selected and tool switches to pointer.
  // Wait for auto-select to settle.
  await page.waitForTimeout(500);

  // Delete the shape with Backspace
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);

  // Export and verify 0 objects remain
  const commands = await exportAndParse();
  expect(commands.length).toBe(0);
});

test("group and ungroup shapes", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Draw first rectangle at top-left area
  await page.press("body", "r");
  await drawRect(page, -150, -100, 100, 80);
  await page.waitForTimeout(300);

  // Draw second rectangle at bottom-right area
  await page.press("body", "r");
  await drawRect(page, 50, 50, 100, 80);
  await page.waitForTimeout(300);

  // Verify we have 2 top-level canvas objects before grouping
  const countBefore = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countBefore).toBe(2);

  // Deselect any active shape before marquee selection
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Select both shapes by dragging a selection box around them
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  // Drag from well above-left to well below-right to cover both shapes
  const selStartX = box!.x + box!.width / 2 - 200;
  const selStartY = box!.y + box!.height / 2 - 150;
  const selEndX = box!.x + box!.width / 2 + 200;
  const selEndY = box!.y + box!.height / 2 + 180;

  await page.mouse.move(selStartX, selStartY);
  await page.mouse.down();
  await page.mouse.move(selEndX, selEndY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Group the selected shapes
  await page.keyboard.press("Meta+g");
  await page.waitForTimeout(500);

  // Verify grouping reduced top-level objects to 1
  const countAfterGroup = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countAfterGroup).toBe(1);

  // Click on where shapes are to select the group
  await clickOnCanvas(page, -100, -60);
  await page.waitForTimeout(300);

  // Ungroup
  await page.keyboard.press("Meta+Shift+g");
  await page.waitForTimeout(500);

  // Verify ungrouping restored original count
  const countAfterUngroup = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c ? c.getObjects().length : -1;
  });
  expect(countAfterUngroup).toBe(countBefore);
});
