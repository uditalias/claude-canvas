import { test, expect } from "@playwright/test";
import { httpGet } from "../helpers";
import * as fs from "fs";

async function drawOnCanvas(
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

test("user can draw a rectangle interactively", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Select rectangle tool
  await page.click('button[aria-label="Rectangle"]');

  // Draw a rectangle via mouse drag
  await drawOnCanvas(page, 0, 0, 150, 100);

  // Switch to pointer
  await page.press("body", "v");
  await page.waitForTimeout(500);

  // Export and verify
  const commands = await exportAndParse();
  expect(commands.length).toBeGreaterThanOrEqual(1);
});

test("user can draw a circle interactively", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Select circle tool via button
  await page.click('button[aria-label="Circle"]');

  // Draw a circle via mouse drag
  await drawOnCanvas(page, 0, 0, 150, 100);

  // Switch to pointer
  await page.press("body", "c");
  await page.waitForTimeout(500);

  // Export and verify
  const commands = await exportAndParse();
  expect(commands.length).toBeGreaterThanOrEqual(1);
});

test("user can draw an arrow interactively", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Select arrow tool via button
  await page.click('button[aria-label="Arrow"]');

  // Draw an arrow via mouse drag
  await drawOnCanvas(page, 0, 0, 150, 100);

  // Switch to pointer
  await page.press("body", "a");
  await page.waitForTimeout(500);

  // Export and verify
  const commands = await exportAndParse();
  expect(commands.length).toBeGreaterThanOrEqual(1);
});

test("user can draw with keyboard shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Press 'r' to select rect tool, draw a rectangle
  await page.press("body", "r");
  await drawOnCanvas(page, -100, -50, 150, 100);

  // Press 'c' to select circle tool, draw a circle
  await page.press("body", "c");
  await drawOnCanvas(page, 100, 50, 120, 80);

  // Switch to pointer
  await page.press("body", "v");
  await page.waitForTimeout(500);

  // Export and verify at least 2 objects
  const commands = await exportAndParse();
  expect(commands.length).toBeGreaterThanOrEqual(2);
});
