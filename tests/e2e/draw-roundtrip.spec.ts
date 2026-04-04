import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";

test("draw command renders on canvas and screenshot captures it", async ({ page }) => {
  await page.goto("/");

  // Wait for WebSocket to connect - give WS time to establish
  await page.waitForTimeout(1000);

  // Send draw commands via API
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", {
    commands: [
      { type: "rect", x: 100, y: 100, width: 200, height: 150, label: "Test Box" },
      { type: "text", x: 350, y: 50, content: "Hello E2E", fontSize: 24 },
    ],
  });
  expect(drawResult.ok).toBe(true);
  expect(drawResult.commands).toBe(2);

  // Wait for rendering
  await page.waitForTimeout(1500);

  // Take screenshot via API
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
  expect(screenshotResult.answers).toBeDefined();
});
