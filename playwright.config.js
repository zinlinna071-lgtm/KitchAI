import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "stock-count-ui.browser.spec.js",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4179/",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/build.mjs && node scripts/serve.mjs",
    url: "http://127.0.0.1:4179/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
