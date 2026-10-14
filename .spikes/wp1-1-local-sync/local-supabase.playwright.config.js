import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const executablePath = await chromium.executablePath();
export default defineConfig({
  testDir: "./tests",
  testMatch: "local-supabase.integration.spec.js",
  fullyParallel: false,
  reporter: "list",
  timeout: 30000,
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:4179",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1365, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: { args: chromium.args.filter(argument => argument !== "--single-process"), executablePath },
  },
  webServer: {
    command: "node ../../scripts/serve.mjs",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
