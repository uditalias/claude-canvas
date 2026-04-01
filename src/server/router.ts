import { Router } from "express";
import { broadcastDraw, broadcastClear, requestScreenshot, getClientCount } from "./state.js";
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

router.post("/api/clear", (_req, res) => {
  broadcastClear();
  res.json({ ok: true });
});

router.get("/api/screenshot", async (_req, res) => {
  try {
    const data = await requestScreenshot();
    const filepath = saveScreenshot(data);
    res.json({ ok: true, path: filepath });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
