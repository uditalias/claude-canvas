/**
 * Playwright script to capture README screenshots of the actual UI.
 * Run: npx playwright test scripts/take-screenshots.ts --config playwright.config.ts
 */
import { test } from "@playwright/test";
import { httpPost } from "../helpers";
import path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/screenshots");
const BASE = "http://127.0.0.1:7890";

test.describe("README screenshots", () => {
  test("capture drawing UI", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForTimeout(1500);

    // Send a nice architecture-style drawing
    await httpPost(`${BASE}/api/draw`, {
      commands: [
        { type: "text", x: 500, y: 60, content: "System Architecture", fontSize: 28, textAlign: "center" },
        { type: "rect", x: 120, y: 130, width: 200, height: 90, label: "Frontend App", fillStyle: "hachure" },
        { type: "rect", x: 400, y: 130, width: 200, height: 90, label: "API Server", fillStyle: "solid" },
        { type: "rect", x: 680, y: 130, width: 200, height: 90, label: "Database", fillStyle: "cross-hatch" },
        { type: "arrow", x1: 320, y1: 175, x2: 400, y2: 175, label: "REST" },
        { type: "arrow", x1: 600, y1: 175, x2: 680, y2: 175, label: "SQL" },
        { type: "rect", x: 120, y: 300, width: 200, height: 70, label: "Auth Service", fillStyle: "zigzag" },
        { type: "rect", x: 400, y: 300, width: 200, height: 70, label: "Cache Layer", fillStyle: "dots" },
        { type: "rect", x: 680, y: 300, width: 200, height: 70, label: "Message Queue", fillStyle: "hachure" },
        { type: "arrow", x1: 220, y1: 220, x2: 220, y2: 300 },
        { type: "arrow", x1: 500, y1: 220, x2: 500, y2: 300 },
        { type: "arrow", x1: 780, y1: 220, x2: 780, y2: 300 },
        { type: "circle", x: 500, y: 470, radius: 55, label: "Monitoring", fillStyle: "dots" },
        { type: "arrow", x1: 320, y1: 370, x2: 455, y2: 430 },
        { type: "arrow", x1: 680, y1: 370, x2: 545, y2: 430 },
      ],
    });

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "ui-drawing.png"),
      type: "png",
    });
  });

  test("capture Q&A panel UI", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForTimeout(1500);

    // Send ask command with visual questions
    await httpPost(`${BASE}/api/ask`, {
      questions: [
        {
          id: "q1",
          text: "Which layout do you prefer for the dashboard?",
          type: "single",
          options: ["Grid Layout", "List Layout", "Card Layout"],
          commands: [
            { type: "rect", x: 130, y: 100, width: 220, height: 160, label: "Grid Layout", fillStyle: "hachure" },
            { type: "rect", x: 145, y: 125, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 245, y: 125, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 145, y: 185, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 245, y: 185, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 430, y: 100, width: 220, height: 160, label: "List Layout", fillStyle: "hachure" },
            { type: "rect", x: 445, y: 125, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 445, y: 170, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 445, y: 215, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 730, y: 100, width: 220, height: 160, label: "Card Layout", fillStyle: "hachure" },
            { type: "rect", x: 750, y: 120, width: 180, height: 120, fillStyle: "dots" },
          ],
        },
        {
          id: "q2",
          text: "What color theme should we use?",
          type: "single",
          options: ["Ocean Blue", "Forest Green", "Sunset Purple"],
          commands: [
            { type: "circle", x: 250, y: 200, radius: 70, label: "Ocean Blue", fillStyle: "solid" },
            { type: "circle", x: 500, y: 200, radius: 70, label: "Forest Green", fillStyle: "solid" },
            { type: "circle", x: 750, y: 200, radius: 70, label: "Sunset Purple", fillStyle: "solid" },
          ],
        },
        {
          id: "q3",
          text: "What should the project title be?",
          type: "text",
          commands: [
            { type: "text", x: 500, y: 180, content: "Your Title Here", fontSize: 32, textAlign: "center" },
            { type: "rect", x: 250, y: 140, width: 500, height: 100, fillStyle: "none" },
          ],
        },
      ],
    });

    await page.waitForTimeout(2000);

    // Wait for question panel to appear
    await page.waitForSelector("text=Which layout do you prefer", { timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "ui-ask.png"),
      type: "png",
    });
  });

  test("capture Q&A panel with answer selected", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForTimeout(1500);

    // Send ask command
    await httpPost(`${BASE}/api/ask`, {
      questions: [
        {
          id: "q1",
          text: "Which layout do you prefer for the dashboard?",
          type: "single",
          options: ["Grid Layout", "List Layout", "Card Layout"],
          commands: [
            { type: "rect", x: 130, y: 100, width: 220, height: 160, label: "Grid Layout", fillStyle: "hachure" },
            { type: "rect", x: 145, y: 125, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 245, y: 125, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 145, y: 185, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 245, y: 185, width: 90, height: 50, fillStyle: "solid" },
            { type: "rect", x: 430, y: 100, width: 220, height: 160, label: "List Layout", fillStyle: "hachure" },
            { type: "rect", x: 445, y: 125, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 445, y: 170, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 445, y: 215, width: 190, height: 35, fillStyle: "solid" },
            { type: "rect", x: 730, y: 100, width: 220, height: 160, label: "Card Layout", fillStyle: "hachure" },
            { type: "rect", x: 750, y: 120, width: 180, height: 120, fillStyle: "dots" },
          ],
        },
        {
          id: "q2",
          text: "What should the project title be?",
          type: "text",
          commands: [
            { type: "text", x: 500, y: 180, content: "Your Title Here", fontSize: 32, textAlign: "center" },
            { type: "rect", x: 250, y: 140, width: 500, height: 100, fillStyle: "none" },
          ],
        },
      ],
    });

    await page.waitForTimeout(2000);
    await page.waitForSelector("text=Which layout do you prefer", { timeout: 5000 });

    // Select "Grid Layout" answer
    const option = page.getByText("Grid Layout").last();
    await option.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "ui-ask-answered.png"),
      type: "png",
    });
  });

  test("capture canvas-type Q&A with user drawing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForTimeout(1500);

    // Send a canvas-type question where Claude draws a UI mockup
    // and asks the user to annotate/draw their changes
    await httpPost(`${BASE}/api/ask`, {
      questions: [
        {
          id: "q1",
          text: "Draw your preferred sidebar layout on the canvas",
          type: "canvas",
          commands: [
            // App shell wireframe drawn by Claude
            { type: "text", x: 500, y: 45, content: "App Layout — draw your changes below", fontSize: 20, textAlign: "center" },
            { type: "rect", x: 100, y: 70, width: 800, height: 50, label: "Navigation Bar", fillStyle: "solid" },
            { type: "rect", x: 100, y: 130, width: 200, height: 380, label: "Sidebar", fillStyle: "hachure" },
            { type: "rect", x: 310, y: 130, width: 590, height: 380, label: "Main Content", fillStyle: "none" },
            // Some placeholder content blocks
            { type: "rect", x: 330, y: 155, width: 260, height: 120, fillStyle: "dots" },
            { type: "rect", x: 610, y: 155, width: 270, height: 120, fillStyle: "dots" },
            { type: "rect", x: 330, y: 295, width: 550, height: 90, fillStyle: "dots" },
            { type: "rect", x: 330, y: 405, width: 550, height: 90, fillStyle: "dots" },
            // Sidebar menu items
            { type: "rect", x: 115, y: 160, width: 170, height: 30, fillStyle: "solid" },
            { type: "rect", x: 115, y: 200, width: 170, height: 30, fillStyle: "solid" },
            { type: "rect", x: 115, y: 240, width: 170, height: 30, fillStyle: "solid" },
            { type: "rect", x: 115, y: 280, width: 170, height: 30, fillStyle: "solid" },
          ],
        },
      ],
    });

    await page.waitForTimeout(2000);
    await page.waitForSelector("text=Draw your preferred sidebar layout", { timeout: 5000 });

    // Now simulate the user drawing on the canvas with freehand tool
    // Select the freehand tool via keyboard shortcut
    await page.press("body", "f");
    await page.waitForTimeout(300);

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Draw a circle/annotation around the sidebar area — user circling it
    const cx = box.x + 245;
    const cy = box.y + 310;
    const rx = 130;
    const ry = 190;
    const steps = 40;
    await page.mouse.move(cx + rx, cy);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const x = cx + rx * Math.cos(angle) + (Math.random() - 0.5) * 6;
      const y = cy + ry * Math.sin(angle) + (Math.random() - 0.5) * 6;
      await page.mouse.move(x, y, { steps: 2 });
    }
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Draw an arrow pointing to the sidebar — a quick diagonal stroke
    await page.mouse.move(box.x + 420, box.y + 170);
    await page.mouse.down();
    await page.mouse.move(box.x + 330, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Draw a small "X" mark on one of the content blocks — user crossing it out
    const xCenter = box.x + 730;
    const yCenter = box.y + 440;
    await page.mouse.move(xCenter - 25, yCenter - 15);
    await page.mouse.down();
    await page.mouse.move(xCenter + 25, yCenter + 15, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await page.mouse.move(xCenter + 25, yCenter - 15);
    await page.mouse.down();
    await page.mouse.move(xCenter - 25, yCenter + 15, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Draw a checkmark on another content block
    const chkX = box.x + 590;
    const chkY = box.y + 220;
    await page.mouse.move(chkX - 15, chkY);
    await page.mouse.down();
    await page.mouse.move(chkX - 5, chkY + 15, { steps: 4 });
    await page.mouse.move(chkX + 20, chkY - 15, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Switch back to pointer so no tool is active in the screenshot
    await page.press("body", "v");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "ui-canvas-answer.png"),
      type: "png",
    });
  });
});
