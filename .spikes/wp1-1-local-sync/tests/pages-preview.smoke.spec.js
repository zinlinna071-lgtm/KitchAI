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

test("Manage Mode exposes seven pages, preserves the Dashboard shell, and opens Sales", async ({ page }) => {
  await page.goto("./");
  await page.locator('[data-mode="manage"]').click();
  await expect(page.locator("#sidebar-content [data-page]")).toHaveCount(7);
  await page.locator('#sidebar-content [data-page="dashboard"]').evaluate(element => element.click());
  const dashboard = page.locator("#page-content .main-page-copy");
  await expect(dashboard.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(dashboard.locator("p")).toBeVisible();
  await expect(dashboard.getByRole("button", { name: /Choose date filter/ })).toBeVisible();
  const datePicker = dashboard.locator(".date-filter-trigger");
  await expect(datePicker).toContainText("Date Picker");
  await expect(datePicker.locator(".date-filter-chevron")).toBeVisible();
  const pickerWidth = await datePicker.evaluate(element => element.getBoundingClientRect().width);
  const dashboardContentWidth = await dashboard.evaluate(element => {
    const style = getComputedStyle(element);
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
  expect(pickerWidth).toBeGreaterThanOrEqual(dashboardContentWidth - 2);
  const metrics = dashboard.locator("[data-dashboard-metric]");
  await expect(metrics).toHaveCount(5);
  await expect(metrics.nth(0)).toHaveAttribute("data-dashboard-metric", "sale");
  await expect(dashboard.locator('[data-dashboard-metric="business-expense"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="net-profit"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="personal-expenses"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="profit-after-personal-spending"]')).toBeVisible();
  const metricOrder = await metrics.evaluateAll(elements => elements.map(element => element.dataset.dashboardMetric));
  expect(metricOrder).toEqual(["sale", "business-expense", "net-profit", "personal-expenses", "profit-after-personal-spending"]);
  await page.locator('#sidebar-content [data-page="menu"]').evaluate(element => element.click());
  const menu = page.locator("#page-content .main-page-copy");
  await expect(menu.getByRole("heading", { name: "Menu" })).toBeVisible();
  await expect(menu.locator("p")).toBeVisible();
  await expect(menu.locator("button, input, select, textarea, .ui-card")).toHaveCount(0);
  await expect(page.locator('#sidebar-content [data-page="personal-expenses"]')).toHaveCount(0);
  await page.locator('#sidebar-content [data-page="sales"]').evaluate(element => element.click());
  const sales = page.locator("#page-content .main-page-copy");
  await expect(sales.getByRole("heading", { name: "Sales" })).toBeVisible();
  await expect(sales.locator("p")).toBeVisible();
  await expect(sales.locator("button, input, select, textarea, .ui-card")).toHaveCount(0);
});

test("unknown project paths load the Pages fallback with project-scoped assets", async ({ page }) => {
  const response = await page.goto("preview-profile/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"]').first()).toHaveAttribute("href", /\/KitchAI\/src\/ui-preview\.css(?:\?.*)?$/);
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
