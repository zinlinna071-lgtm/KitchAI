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
  const panelContentWidth = await dashboard.locator(".dashboard-financial-panel").evaluate(element => {
    const style = getComputedStyle(element);
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
  expect(pickerWidth).toBeGreaterThanOrEqual(panelContentWidth - 2);
  const metrics = dashboard.locator("[data-dashboard-metric]");
  await expect(metrics).toHaveCount(5);
  await expect(dashboard.locator(".dashboard-financial-panel")).toBeVisible();
  await expect(dashboard.locator(".dashboard-financial-panel .date-filter-trigger")).toBeVisible();
  await expect(metrics.locator(".dashboard-metric-chevron")).toHaveCount(5);
  await expect(metrics.locator(".dashboard-metric-chevron").first()).toHaveText(">");
  await expect(metrics.locator(".dashboard-metric-chevron").first()).toHaveCSS("grid-column", "2");
  await expect(dashboard.locator(".dashboard-financial-panel .dashboard-metric--net-profit")).toHaveCSS("grid-column", "1 / -1");
  await expect(metrics.nth(0)).toHaveAttribute("data-dashboard-metric", "sale");
  await expect(dashboard.locator('[data-dashboard-metric="business-expense"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="net-profit"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="personal-expenses"]')).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-metric="profit-after-personal-spending"]')).toBeVisible();
  const metricOrder = await metrics.evaluateAll(elements => elements.map(element => element.dataset.dashboardMetric));
  expect(metricOrder).toEqual(["sale", "business-expense", "net-profit", "personal-expenses", "profit-after-personal-spending"]);
  const languageSelect = page.locator("#language-select");
  await languageSelect.selectOption("en");
  await expect(metrics.first().locator(".dashboard-metric-label")).toHaveText("Sale");
  await expect(metrics.first().locator(".dashboard-metric-value")).not.toContainText("Sample");
  await expect(metrics.first().locator(".dashboard-metric-value")).toContainText("฿5,000");
  await expect(metrics.nth(1).locator(".dashboard-metric-value")).toContainText("฿1,800");
  await languageSelect.selectOption("my");
  await expect(metrics.first().locator(".dashboard-metric-label")).toHaveText("ရောင်းရငွေ");
  await expect(metrics.first().locator(".dashboard-metric-value")).not.toContainText("နမူနာ");
  await expect(metrics.first().locator(".dashboard-metric-value")).toContainText("฿5,000");
  await languageSelect.selectOption("en");
  await expect(metrics.first().locator(".dashboard-metric-value")).not.toContainText("Sample");
  await page.locator('#sidebar-content [data-page="menu"]').evaluate(element => element.click());
  const menu = page.locator("#page-content .main-page-copy");
  await expect(menu.getByRole("heading", { name: "Menu" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Create Menu" })).toBeVisible();
  await menu.getByRole("button", { name: "Create Menu" }).click();
  const menuForm = page.locator("#page-content #record-form");
  await expect(menuForm.getByRole("heading", { name: "Create Menu" })).toHaveCount(0);
  await expect(menuForm.locator('input[name="category"]')).toBeVisible();
  await expect(menuForm.locator('input[name="category"]')).toHaveAttribute("list", "menu-category-options");
  await expect(menuForm.locator('input[name="name"]')).toBeVisible();
  await expect(menuForm.locator('input[name="price"]')).toBeVisible();
  await expect(menuForm.locator('fieldset[name="ingredients"], .menu-ingredient-field')).toBeVisible();
  await expect(menuForm.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(menuForm.getByRole("button", { name: "Save" })).toBeVisible();
  await menuForm.locator('input[name="category"]').fill("Rice Rolls");
  await menuForm.locator('input[name="name"]').fill("Seaweed Rice Roll");
  await menuForm.locator('input[name="price"]').fill("35");
  await menuForm.getByRole("button", { name: "Save" }).click();
  await expect(menu.getByText("Seaweed Rice Roll")).toBeVisible();
  await expect(menu.locator('#menu-category-filter option[value="Rice Rolls"]')).toHaveCount(1);
  await expect(menu.locator("#menu-search")).toBeVisible();
  await expect(menu.locator("#menu-category-filter")).toBeVisible();
  await expect(menu.locator(".menu-list-row")).toHaveCount(1);
  await menu.locator("#menu-search").fill("not found");
  await expect(menu.locator(".menu-list-row")).toHaveCount(0);
  await menu.locator("#menu-search").fill("Seaweed");
  await expect(menu.locator(".menu-list-row")).toHaveCount(1);
  await menu.locator("#menu-category-filter").selectOption("Rice Rolls");
  await expect(menu.locator(".menu-list-row")).toHaveCount(1);
  await menu.locator(".menu-list-row").click();
  const details = page.locator("#page-content .menu-detail-page");
  await expect(details.getByRole("heading", { name: "Seaweed Rice Roll" })).toBeVisible();
  await expect(details).toContainText("Rice Rolls");
  await expect(details).toContainText("฿35");
  await expect(details).toContainText("Ingredients");
  await expect(details).toContainText("Sales History");
  await expect(details.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(details.getByRole("button", { name: "Delete" })).toBeVisible();
  await details.getByRole("button", { name: "Edit" }).click();
  const editForm = page.locator("#page-content #record-form");
  await expect(editForm.locator('input[name="category"]')).toBeVisible();
  await expect(editForm.locator('input[name="name"]')).toHaveValue("Seaweed Rice Roll");
  await expect(editForm.locator('input[name="price"]')).toHaveValue("35");
  await expect(editForm.locator('input[name="type"]')).toHaveCount(0);
  await expect(editForm.locator('input[name="image"]')).toHaveCount(0);
  await expect(editForm.locator('input[name="unit"]')).toHaveCount(0);
  await expect(editForm.locator('textarea[name="note"]')).toHaveCount(0);
  await expect(editForm.locator('input[name="quantity"]')).toHaveCount(0);
  await expect(editForm.locator('input[name="saleDate"]')).toHaveCount(0);
  await expect(editForm.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(editForm.getByRole("button", { name: "Save changes" })).toBeVisible();
  await editForm.getByRole("button", { name: "Cancel" }).click();
  await expect(details.getByRole("heading", { name: "Seaweed Rice Roll" })).toBeVisible();
  await details.getByRole("button", { name: /Back/ }).click();
  await expect(menu.getByRole("button", { name: "Create Menu" })).toBeVisible();
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
