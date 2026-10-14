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
    // The isolated @sparticuz/chromium setup does not install Playwright's
    // ffmpeg binary. Keep trace and screenshot diagnostics without enabling
    // video, which otherwise prevents browser contexts from being created.
    video: "off",
    launchOptions: { args: chromium.args.filter(argument => argument !== "--single-process"), executablePath },
  },
  webServer: {
    command: "node ../../scripts/serve.mjs",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
