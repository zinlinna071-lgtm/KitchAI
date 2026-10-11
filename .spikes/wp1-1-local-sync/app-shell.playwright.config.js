import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const executablePath = await chromium.executablePath();
export default defineConfig({ testDir: "./tests", testMatch: "app-shell.smoke.spec.js", fullyParallel: false, reporter: "list", use: { baseURL: "http://127.0.0.1:4179", browserName: "chromium", headless: true, viewport: { width: 1365, height: 900 }, launchOptions: { args: chromium.args.filter((argument) => argument !== "--single-process"), executablePath } }, webServer: { command: "node ../../scripts/serve.mjs", url: "http://127.0.0.1:4179", reuseExistingServer: false, timeout: 30000 } });
