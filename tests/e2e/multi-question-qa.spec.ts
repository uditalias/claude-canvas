import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";

test("multi-question Q&A with navigation and different types", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Send ask command with 3 questions of different types
  const askResult = await httpPost("http://127.0.0.1:7890/api/ask", {
    questions: [
      {
        id: "q1",
        text: "Pick a color",
        type: "single",
        options: ["Red", "Blue", "Green"],
        commands: [{ type: "rect", x: 100, y: 100, width: 100, height: 100 }],
      },
      {
        id: "q2",
        text: "Select features",
        type: "multi",
        options: ["Fast", "Reliable", "Cheap"],
        commands: [{ type: "circle", x: 200, y: 200, radius: 50 }],
      },
      {
        id: "q3",
        text: "Enter your name",
        type: "text",
        commands: [{ type: "text", x: 150, y: 150, content: "Name here" }],
      },
    ],
  });
  expect(askResult.ok).toBe(true);

  // Wait for question panel to appear
  await page.waitForTimeout(1500);

  // Q1 should be visible
  await expect(page.getByText("Pick a color")).toBeVisible({ timeout: 5000 });

  // Answer Q1: click "Blue" pill button
  await page.getByText("Blue").last().click();

  // Navigate to Q2: click the next button (ChevronRight)
  // The navigation has: [prev button] [counter "1/3"] [next button]
  // The next button is the one after the counter text
  const nextButton = page.locator("button").filter({ hasText: "" }).filter({
    has: page.locator('svg.lucide-chevron-right'),
  });
  await nextButton.click();

  // Verify Q2 is visible
  await expect(page.getByText("Select features")).toBeVisible({ timeout: 3000 });

  // Answer Q2: click "Fast" and "Reliable" (multi-select)
  await page.getByText("Fast").last().click();
  await page.getByText("Reliable").last().click();

  // Navigate to Q3
  await nextButton.click();

  // Verify Q3 is visible
  await expect(page.getByText("Enter your name")).toBeVisible({ timeout: 3000 });

  // Answer Q3: fill the text input
  await page.locator('input[placeholder="Type your answer..."]').fill("Alice");

  // Click Done button
  const doneBtn = page.getByTitle("Submit answers");
  await doneBtn.click();

  // Wait for panel to close and answers to be registered
  await page.waitForTimeout(2000);

  // Verify the question panel is no longer visible
  await expect(page.getByText("Enter your name")).not.toBeVisible({ timeout: 5000 });

  // Take screenshot to get answers
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
  expect(screenshotResult.answers).toBeDefined();
  expect(screenshotResult.answers).toHaveLength(3);

  // Verify q1 answer
  const a1 = screenshotResult.answers.find((a: { questionId: string }) => a.questionId === "q1");
  expect(a1).toBeDefined();
  expect(a1.value).toBe("Blue");

  // Verify q2 answer (multi-select returns array)
  const a2 = screenshotResult.answers.find((a: { questionId: string }) => a.questionId === "q2");
  expect(a2).toBeDefined();
  expect(Array.isArray(a2.value)).toBe(true);
  expect(a2.value).toContain("Fast");
  expect(a2.value).toContain("Reliable");

  // Verify q3 answer
  const a3 = screenshotResult.answers.find((a: { questionId: string }) => a.questionId === "q3");
  expect(a3).toBeDefined();
  expect(a3.value).toBe("Alice");
});
