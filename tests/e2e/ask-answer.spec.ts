import { test, expect } from "@playwright/test";
import { httpPost } from "../helpers";

test("ask command blocks until Done and returns answers", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Fire ask — this will block until user clicks Done
  const askPromise = httpPost("http://127.0.0.1:7890/api/ask", {
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

  // Wait for question panel to appear
  await page.waitForTimeout(1500);
  const questionText = page.getByText("Which layout do you prefer?");
  await expect(questionText).toBeVisible({ timeout: 5000 });

  // Click an answer
  const optionA = page.getByText("Layout A").last();
  await optionA.click();

  // Click Done
  const doneBtn = page.getByTitle("Submit answers");
  await doneBtn.click();

  // Now the ask request should resolve with answers
  const result = await askPromise;
  expect(result.ok).toBe(true);
  expect(result.status).toBe("answered");
  expect(result.path).toMatch(/\.png$/);
  expect(result.answers).toHaveLength(1);
  expect(result.answers[0].questionId).toBe("q1");
  expect(result.answers[0].value).toBe("Layout A");
});
