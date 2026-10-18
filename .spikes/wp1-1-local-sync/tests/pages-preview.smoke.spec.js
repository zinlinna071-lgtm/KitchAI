import { expect, test } from "@playwright/test";

test("project-path frontend preview loads scoped assets without backend credentials", async ({ page }) => {
  const outOfScopeRequests = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:4179" && !url.pathname.startsWith("/KitchAI/")) outOfScopeRequests.push(url.pathname);
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Online");
  await expect(page.getByRole("button", { name: /Sign in|Create account/ })).toHaveCount(0);
  const configuration = await page.evaluate(async () => {
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const manifest = await fetch(manifestUrl).then(response => response.json());
    const registration = await navigator.serviceWorker.ready;
    return {
      runtimeConfig: window.KITCHAI_CONFIG,
      manifestUrl,
      manifest,
      registrationScope: registration.scope,
      basePath: document.querySelector('meta[name="kitchai-base-path"]').content,
    };
  });
  expect(configuration.basePath).toBe("/KitchAI/");
  expect(configuration.manifestUrl).toContain("/KitchAI/manifest.webmanifest");
  expect(configuration.manifest.start_url).toBe("/KitchAI/");
  expect(configuration.manifest.scope).toBe("/KitchAI/");
  expect(configuration.manifest.icons[0].src).toBe("/KitchAI/favicon.svg");
  expect(configuration.registrationScope).toBe("http://127.0.0.1:4179/KitchAI/");
  expect(configuration.runtimeConfig).toEqual({ supabaseUrl: "", supabaseAnonKey: "" });
  expect(outOfScopeRequests).toEqual([]);
});

test("Manage Mode exposes the seven confirmed pages and the Ingredients form", async ({ page }) => {
  await page.goto("./");
  await page.locator('[data-mode="manage"]').click();
  await expect(page.locator("[data-page]")).toHaveCount(7);
  for (const pageId of ["dashboard", "menu", "ingredients", "equipment", "expenses", "reports", "settings"]) {
    await expect(page.locator('[data-page="' + pageId + '"]')).toBeVisible();
  }
  await page.locator('[data-page="ingredients"]').click();
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No data yet" })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();
  await page.locator('[data-action="new-ingredient"]').first().click();
  await expect(page.locator('#record-form input[name="name"]')).toBeVisible();
  await expect(page.locator('#record-form select[name="type"]')).toBeVisible();
});

test("unknown project paths load the Pages fallback with project-scoped assets", async ({ page }) => {
  const response = await page.goto("preview-profile/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"]').first()).toHaveAttribute("href", "/KitchAI/src/ui-preview.css");
});

test("the scoped worker serves the UI shell after offline navigation", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto("offline-preview-route/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await context.setOffline(false);
});
