});

import { expect, test } from "@playwright/test";

test("project-path preview loads local assets and exposes no backend sign-in controls", async ({ page }) => {
  const outOfScopeRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:4179" && !url.pathname.startsWith("/KitchAI/")) {
      outOfScopeRequests.push(url.pathname);
    }
  });

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.locator("#preview-notice")).toBeVisible();
  await expect(page.locator("#preview-notice")).toContainText("NON-PRODUCTION STATIC PREVIEW");
  await expect(page.locator("#auth-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Create account" })).toBeHidden();
  await expect(page.locator("#profile-state")).toContainText("No profile saved on this device yet");

  const pageConfiguration = await page.evaluate(async () => {
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const manifest = await fetch(manifestUrl).then((response) => response.json());
    const registration = await navigator.serviceWorker.ready;
    return {
      runtimeConfig: window.KITCHAI_CONFIG,
      manifestUrl,
      manifest,
      registrationScope: registration.scope,
      basePath: document.querySelector('meta[name="kitchai-base-path"]').content,
      controller: Boolean(navigator.serviceWorker.controller),
    };
  });

  expect(pageConfiguration.basePath).toBe("/KitchAI/");
  expect(pageConfiguration.manifestUrl).toContain("/KitchAI/manifest.webmanifest");
  expect(pageConfiguration.manifest.start_url).toBe("/KitchAI/");
  expect(pageConfiguration.manifest.scope).toBe("/KitchAI/");
  expect(pageConfiguration.manifest.icons[0].src).toBe("/KitchAI/favicon.svg");
  expect(pageConfiguration.registrationScope).toBe("http://127.0.0.1:4179/KitchAI/");
  expect(pageConfiguration.runtimeConfig).toEqual({ supabaseUrl: "", supabaseAnonKey: "" });
  expect(outOfScopeRequests).toEqual([]);
});

test("unknown project paths load the Pages fallback shell with scoped assets", async ({ page }) => {
  const response = await page.goto("preview-profile/");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.locator("#preview-notice")).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute("href", "/KitchAI/src/styles.css");
});

test("the scoped worker serves the app shell after offline navigation", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto("offline-preview-route/");

  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.locator("#preview-notice")).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await context.setOffline(false);
});
