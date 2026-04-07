import { test, expect } from "@playwright/test";
import { httpPost, httpGet } from "../helpers";
import { parseDSL } from "../../src/bin/dsl/index";

test("DSL draw roundtrip — parsed layout renders on canvas", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Parse DSL into a DrawPayload
  const payload = parseDSL('row gap=40 { box "Hello" 200x100; box "World" 200x100 }');
  expect("commands" in payload).toBe(true);

  // Send the parsed payload to the draw endpoint
  const drawResult = await httpPost("http://127.0.0.1:7890/api/draw", payload);
  expect(drawResult.ok).toBe(true);
  expect(drawResult.commands).toBe(2);

  // Wait for rendering
  await page.waitForTimeout(1500);

  // Take screenshot to verify canvas received the shapes
  const screenshotResult = await httpGet("http://127.0.0.1:7890/api/screenshot");
  expect(screenshotResult.ok).toBe(true);
  expect(screenshotResult.path).toMatch(/\.png$/);
});

test("DSL ask roundtrip — parsed ask payload shows question panel", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Parse DSL into an AskPayload
  const payload = parseDSL(
    'ask { question #q1 single "Pick one" { options "A" | "B"; row gap=20 { box "A" 100x80; box "B" 100x80 } } }'
  );
  expect("questions" in payload).toBe(true);

  // Fire ask in the background — it blocks until the user clicks Done
  const askPromise = httpPost("http://127.0.0.1:7890/api/ask", payload);

  // Wait for the question panel to appear
  await page.waitForTimeout(1500);
  const questionText = page.getByText("Pick one");
  await expect(questionText).toBeVisible({ timeout: 5000 });

  // Verify the option buttons are rendered
  await expect(page.getByText("A").last()).toBeVisible({ timeout: 3000 });
  await expect(page.getByText("B").last()).toBeVisible({ timeout: 3000 });

  // Answer and submit so the ask request resolves (avoids hanging)
  await page.getByText("A").last().click();
  const doneBtn = page.getByTitle("Submit answers");
  await doneBtn.click();

  const result = await askPromise;
  expect(result.ok).toBe(true);
  expect(result.status).toBe("answered");
  expect(result.answers).toHaveLength(1);
  expect(result.answers[0].questionId).toBe("q1");
  expect(result.answers[0].value).toBe("A");
});
