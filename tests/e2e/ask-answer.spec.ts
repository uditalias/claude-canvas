import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";

test("ask command shows question panel and screenshot returns answers", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Send ask command
  const askResult = await httpPost("http://127.0.0.1:7890/api/ask", {
    questions: [
      {
        id: "q1",
        text: "Which layout do you prefer?",
        type: "single",
        options: ["Layout A", "Layout B"],
        commands: [
          { type: "rect", x: 100, y: 100, width: 200, height: 150, label: "Layout A" },
        ],
      },
    ],
  });
  expect(askResult.ok).toBe(true);

  // Wait for question panel to appear
  await page.waitForTimeout(1500);

  // The question panel should be visible - look for the question text
  const questionText = page.getByText("Which layout do you prefer?");
  await expect(questionText).toBeVisible({ timeout: 5000 });

  // Click an answer option - the pill button for "Layout A"
  // Use last() in case the label "Layout A" also appears on the canvas
  const optionA = page.getByText("Layout A").last();
  await optionA.click();

  // Click the Done button (check icon button) - find it by its title attribute
  const doneBtn = page.getByTitle("Submit answers");
  await doneBtn.click();

  // Wait for panel to close and answers to be registered
  await page.waitForTimeout(2000);

  // Verify the question panel is no longer visible
  await expect(page.getByText("Which layout do you prefer?")).not.toBeVisible({ timeout: 5000 });

  // Take screenshot to get answers
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
  expect(screenshotResult.answers).toBeDefined();
  expect(screenshotResult.answers.length).toBeGreaterThan(0);
  expect(screenshotResult.answers[0].questionId).toBe("q1");
  expect(screenshotResult.answers[0].value).toBe("Layout A");
});
