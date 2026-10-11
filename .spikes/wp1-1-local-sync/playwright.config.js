import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";

const executablePath = await chromium.executablePath();

export default defineConfig({
  testDir: "./tests",
  testMatch: "sync.spec.js",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      args: chromium.args.filter((argument) => argument !== "--single-process"),
      executablePath,
    },
  },
  webServer: {
    command: "node ./test-server.js",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
});
