import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:7890",
  },
  webServer: {
    command: "npm run build && node dist/server/index.js",
    port: 7890,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
