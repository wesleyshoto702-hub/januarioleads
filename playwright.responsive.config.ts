import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Secondary UI-engine check; normal CI keeps Chromium for the full suite. */
export default defineConfig({
  ...base,
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
