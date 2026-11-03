import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: process.env["CHROMIUM_EXECUTABLE"]
      ? { executablePath: process.env["CHROMIUM_EXECUTABLE"] }
      : {},
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env["CI"],
  },
});
