import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { broadcastDraw, broadcastClear, requestAskWithAnswers, requestScreenshot, requestExport, getClientCount } from "./state.js";
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

router.post("/api/ask", async (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.questions)) {
    res.status(400).json({ error: "Invalid AskPayload: questions array required" });
    return;
  }
  try {
    const { image, answers } = await requestAskWithAnswers(payload);
    const filepath = saveScreenshot(image);
    const processedAnswers = answers.map((a) => {
      if (a.canvasSnapshot && a.canvasSnapshot.startsWith("data:")) {
        return { ...a, canvasSnapshot: saveScreenshot(a.canvasSnapshot) };
      }
      return a;
    });
    res.json({ ok: true, status: "answered", path: filepath, answers: processedAnswers });
  } catch (err) {
    res.status(500).json({ ok: false, status: "disconnected", error: (err as Error).message });
  }
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

router.get("/api/export", async (req, res) => {
  try {
    const format = (req.query.format as string) || "png";
    const labels = req.query.labels === "true";
    const data = await requestExport(format, labels);
    const dir = path.join(os.tmpdir(), "claude-canvas");
    fs.mkdirSync(dir, { recursive: true });
    if (format === "json") {
      const filepath = path.join(dir, `canvas-${Date.now()}.json`);
      fs.writeFileSync(filepath, data);
      res.json({ ok: true, path: filepath, format: "json" });
    } else if (format === "svg") {
      const filepath = path.join(dir, `canvas-${Date.now()}.svg`);
      fs.writeFileSync(filepath, data);
      res.json({ ok: true, path: filepath, format: "svg" });
    } else {
      const filepath = saveScreenshot(data);
      res.json({ ok: true, path: filepath, format: "png" });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
