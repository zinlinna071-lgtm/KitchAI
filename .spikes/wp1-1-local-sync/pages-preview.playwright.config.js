});

import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";

const executablePath = await chromium.executablePath();

export default defineConfig({
  testDir: "./tests",
  testMatch: "pages-preview.smoke.spec.js",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179/KitchAI/",
    browserName: "chromium",
    headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      args: chromium.args.filter((argument) => argument !== "--single-process"),
      executablePath,
    },
  },
  webServer: {
    command: "node ../../scripts/build.mjs --base-path=/KitchAI/ --preview && KITCHAI_BASE_PATH=/KitchAI/ KITCHAI_SUPABASE_URL= KITCHAI_SUPABASE_ANON_KEY= node ../../scripts/serve.mjs",
    url: "http://127.0.0.1:4179/KitchAI/",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
