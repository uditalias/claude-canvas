import { test, expect } from "@playwright/test";
import { httpGet } from "../helpers";
import * as fs from "fs";

async function drawRectInteractively(
  page: import("@playwright/test").Page,
  offsetX: number,
  offsetY: number,
  dragX: number,
  dragY: number,
) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2 + offsetX;
  const startY = box!.y + box!.height / 2 + offsetY;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dragX, startY + dragY, { steps: 5 });
  await page.mouse.up();
}

async function exportAndCount(): Promise<number> {
  const result = await httpGet(
    "http://127.0.0.1:7890/api/export?format=json&labels=false",
  );
  expect(result.ok).toBe(true);
  const raw = fs.readFileSync(result.path, "utf-8");
  const data = JSON.parse(raw);
  const commands = Array.isArray(data) ? data : data.commands ?? [];
  return commands.length;
}

test("undo removes drawn shape and redo restores it", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Draw a rectangle interactively (user layer)
  await page.press("body", "r");
  await drawRectInteractively(page, 0, 0, 150, 100);

  // Switch to pointer
  await page.press("body", "v");
  await page.waitForTimeout(500);

  // Verify we have 1 object
  const countBefore = await exportAndCount();
  expect(countBefore).toBe(1);

  // Click the Undo button
  await page.click('button[aria-label="Undo"]');
  await page.waitForTimeout(500);

  // Verify 0 objects after undo
  const countAfterUndo = await exportAndCount();
  expect(countAfterUndo).toBe(0);

  // Click the Redo button
  await page.click('button[aria-label="Redo"]');
  await page.waitForTimeout(500);

  // Verify 1 object after redo
  const countAfterRedo = await exportAndCount();
  expect(countAfterRedo).toBe(1);
});

test("undo/redo via keyboard shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Draw a rectangle interactively (user layer)
  await page.press("body", "r");
  await drawRectInteractively(page, 0, 0, 150, 100);

  // Switch to pointer
  await page.press("body", "v");
  await page.waitForTimeout(500);

  // Verify we have 1 object
  const countBefore = await exportAndCount();
  expect(countBefore).toBe(1);

  // Undo via keyboard shortcut
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(500);

  // Verify 0 objects after undo
  const countAfterUndo = await exportAndCount();
  expect(countAfterUndo).toBe(0);

  // Redo via keyboard shortcut
  await page.keyboard.press("Meta+Shift+z");
  await page.waitForTimeout(500);

  // Verify 1 object after redo
  const countAfterRedo = await exportAndCount();
  expect(countAfterRedo).toBe(1);
});
