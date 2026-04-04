/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client"),
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:7890",
      "/health": "http://127.0.0.1:7890",
      "/ws": {
        target: "http://127.0.0.1:7890",
        ws: true,
      },
    },
  },
  test: {
    root: ".",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
  },
});
