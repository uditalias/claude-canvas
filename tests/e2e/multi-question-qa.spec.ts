import { test, expect } from "@playwright/test";
import { httpPost } from "../helpers";

test("multi-question Q&A blocks until Done and returns all answers", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Fire ask — blocks until Done
  const askPromise = httpPost("http://127.0.0.1:7890/api/ask", {
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

  // Wait for question panel
  await page.waitForTimeout(1500);
  await expect(page.getByText("Pick a color")).toBeVisible({ timeout: 5000 });

  // Answer Q1
  await page.getByText("Blue").last().click();

  // Navigate to Q2
  const nextButton = page.locator("button").filter({ hasText: "" }).filter({
    has: page.locator('svg.lucide-chevron-right'),
  });
  await nextButton.click();
  await expect(page.getByText("Select features")).toBeVisible({ timeout: 3000 });

  // Answer Q2
  await page.getByText("Fast").last().click();
  await page.getByText("Reliable").last().click();

  // Navigate to Q3
  await nextButton.click();
  await expect(page.getByText("Enter your name")).toBeVisible({ timeout: 3000 });

  // Answer Q3
  await page.locator('input[placeholder="Type your answer..."]').fill("Alice");

  // Click Done
  const doneBtn = page.getByTitle("Submit answers");
  await doneBtn.click();

  // Ask request should resolve with all answers
  const result = await askPromise;
  expect(result.ok).toBe(true);
  expect(result.status).toBe("answered");
  expect(result.path).toMatch(/\.png$/);
  expect(result.answers).toHaveLength(3);

  const a1 = result.answers.find((a: any) => a.questionId === "q1");
  expect(a1.value).toBe("Blue");

  const a2 = result.answers.find((a: any) => a.questionId === "q2");
  expect(Array.isArray(a2.value)).toBe(true);
  expect(a2.value).toContain("Fast");
  expect(a2.value).toContain("Reliable");

  const a3 = result.answers.find((a: any) => a.questionId === "q3");
  expect(a3.value).toBe("Alice");
});
