import { Router } from "express";
import { broadcastDraw, broadcastClear, broadcastAsk, requestScreenshot, getClientCount } from "./state.js";
import { saveScreenshot } from "../utils/screenshot.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", clients: getClientCount() });
});

router.post("/api/draw", (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.commands)) {
    res.status(400).json({ error: "Invalid DrawPayload: commands array required" });
    return;
  }
  broadcastDraw(payload);
  res.json({ ok: true, commands: payload.commands.length });
});

router.post("/api/clear", (req, res) => {
  const layer = req.query.layer as string | undefined;
  broadcastClear(layer);
  res.json({ ok: true });
});

router.post("/api/ask", (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.questions)) {
    res.status(400).json({ error: "Invalid AskPayload: questions array required" });
    return;
  }
  broadcastAsk(payload);
  res.json({ ok: true, questions: payload.questions.length });
});

router.get("/api/screenshot", async (_req, res) => {
  try {
    const { image, answers } = await requestScreenshot();
    const filepath = saveScreenshot(image);
    const processedAnswers = answers.map((a) => {
      if (a.canvasSnapshot && a.canvasSnapshot.startsWith("data:")) {
        return { ...a, canvasSnapshot: saveScreenshot(a.canvasSnapshot) };
      }
      return a;
    });
    res.json({ ok: true, path: filepath, answers: processedAnswers });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
