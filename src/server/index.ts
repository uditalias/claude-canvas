import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import express from "express";
import { attachWebSocket } from "./websocket.js";
import router from "./router.js";

const port = parseInt(process.env.PORT || "7890", 10);
const host = process.env.CANVAS_HOST || "127.0.0.1";

const app = express();
app.use(express.json());

// API routes must come before static serving
app.use(router);

// Serve Vite-built client files
const clientDir = path.join(__dirname, "../client");
const clientIndexPath = path.join(clientDir, "index.html");

app.use(express.static(clientDir));

// SPA fallback: serve index.html for non-API routes
app.get("*", (_req, res) => {
  if (fs.existsSync(clientIndexPath)) {
    res.sendFile(clientIndexPath);
  } else {
    res.status(503).send("Client not built yet. Run: npm run build:client");
  }
});

const server = http.createServer(app);
attachWebSocket(server);

server.listen(port, host, () => {
  console.log(`claude-canvas server listening on http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
