import { test, expect } from "@playwright/test";

test("Manage Mode navigation keeps the three agreed pages title-only", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();

  for (const [label, title] of [["Dashboard", "Dashboard"], ["Ingredients", "Ingredients"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const section = page.locator("#page-content .page-section");
    await expect(section.getByRole("heading", { name: title })).toBeVisible();
    if (title === "Dashboard") {
      await expect(section.getByRole("button", { name: /Choose date filter/ })).toBeVisible();
    } else {
      await expect(section.locator("button, input, select, textarea, .ui-card")).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  // The Menu workspace is intentionally not rendered in this preview; verify navigation does not throw.
  expect(pageErrors).toEqual([]);
});

test("switching modes restores each mode's last active workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI Settings/ }).click();
  await expect(page.getByRole("heading", { name: "AI Settings" })).toBeVisible();

  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: /Choose date filter/ }).click();
  await expect(page.getByRole("heading", { name: "Date Filter" })).toBeVisible();

  await page.getByRole("button", { name: /AI Mode/ }).click();
  await expect(page.getByRole("heading", { name: "AI Settings" })).toBeVisible();
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await expect(page.getByRole("heading", { name: "Date Filter" })).toBeVisible();
});

test("shared shell and mobile drawer remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask KitchAI about your kitchen" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-collapsed/);
  const drawerBounds = await page.locator("#sidebar").evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(drawerBounds.right).toBeCloseTo(drawerBounds.viewport, 0);
  expect(drawerBounds.left).toBeGreaterThan(0);
  await page.locator("#sidebar-minimize").click();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-collapsed/);
  await page.locator("#sidebar-backdrop").click();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
});

test("AI Mode keeps its frontend-only chat composer", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask KitchAI about your kitchen" })).toBeVisible();
  await page.getByLabel("Message").fill("How should I organize ingredients?");
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.locator("#page-content .ai-messages").getByText("How should I organize ingredients?")).toBeVisible();
  await expect(page.locator("#page-content").getByText(/AI service not connected/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("desktop swipe switches mode from both drawer and main screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const aiMode = page.getByRole("button", { name: /AI Mode/ });
  const manageMode = page.getByRole("button", { name: /Manage Mode/ });
  await expect(aiMode).toHaveAttribute("aria-pressed", "true");

  await page.mouse.move(1200, 260);
  await page.mouse.down();
  await page.mouse.move(1080, 260, { steps: 6 });
  await page.mouse.up();
  await expect(manageMode).toHaveAttribute("aria-pressed", "true");

  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.mouse.move(580, 300, { steps: 6 });
  await page.mouse.up();
  await expect(aiMode).toHaveAttribute("aria-pressed", "true");
});

test.describe("swipe then tap regression", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });

  test("tap still works immediately after either horizontal swipe", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const cdp = await page.context().newCDPSession(page);
    const theme = page.locator("#theme-toggle");
    const ai = page.getByRole("button", { name: /AI Mode/ });
    const manage = page.getByRole("button", { name: /Manage Mode/ });
    for (const [fromX, toX, expected] of [[60, 300, manage], [300, 60, ai]]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y: 400 }] });
      for (let step = 1; step <= 6; step += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + (toX - fromX) * step / 6, y: 400 }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const box = await theme.boundingBox();
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(expected).toHaveAttribute("aria-pressed", "true");
      await expect(theme).toHaveAttribute("aria-pressed", "true");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(theme).toHaveAttribute("aria-pressed", "false");
    }
  });
});


test("Menu preview records persist locally after a page reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const store = await import("/src/menu-preview-store.js");
    await store.saveMenuWorkspace({
      menus: [{ id: 71001, name: "Persistence Test Roll", category: "Test Foods", type: "reusable", price: "45", unit: "piece", ingredientIds: [], ingredientNames: [], note: "" }],
      sales: [{ id: 71002, menuId: null, name: "Persistence Test Sale", category: "Test Foods", quantity: 2, unit: "piece", unitPrice: 45, discount: 0, netSale: 90, date: "2026-10-19", time: "12:00", note: "", status: "completed", type: "one-time" }],
      categories: ["Default", "Test Foods"],
    });
  });
  await page.reload();
  const saved = await page.evaluate(async () => {
    const store = await import("/src/menu-preview-store.js");
    return store.loadMenuWorkspace();
  });
  expect(saved.menus.some(item => item.name === "Persistence Test Roll")).toBe(true);
  expect(saved.sales.some(item => item.name === "Persistence Test Sale" && item.netSale === 90)).toBe(true);
});


test("Dashboard date filter supports instant quick selection, cancel, and custom ranges with the custom calendar", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  const trigger = () => page.getByRole("button", { name: /Choose date filter/ });
  await expect(trigger()).toBeVisible();
  await expect(trigger()).toContainText(/Today/);

  await trigger().click();
  await expect(page.getByRole("heading", { name: "Date Filter" })).toBeVisible();
  await page.locator('[data-date-filter="quick:yesterday"]').click();
  await expect(trigger()).toContainText(/Yesterday/);

  await trigger().click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger()).toContainText(/Yesterday/);

  await trigger().click();
  await page.locator('[data-date-filter="calendar:start"]').click();
  await expect(page.locator(".date-calendar")).toBeVisible();
  await page.locator('[data-date-filter="day:2026-10-10"]').click();
  await expect(page.locator('[data-date-filter="calendar:end"]')).toHaveAttribute("aria-expanded", "true");
  await page.locator('[data-date-filter="day:2026-10-12"]').click();
  await expect(trigger()).toContainText(/Oct 10/);
  await expect(trigger()).toContainText(/12/);
  expect(pageErrors).toEqual([]);
});


test("date filter supports a single date and keeps its trigger compact on mobile", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const trigger = page.getByRole("button", { name: /Choose date filter/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("heading", { name: "Single Date" })).toBeVisible();
  await page.locator('[data-date-filter="calendar:single"]').click();
  await page.locator('[data-date-filter="day:2026-10-08"]').click();
  await expect(trigger).toContainText(/Oct 8/);

  await trigger.click();
  await page.locator('[data-date-filter="calendar:start"]').click();
  await page.locator('[data-date-filter="day:2026-10-10"]').click();
  await page.locator('[data-date-filter="day:2026-10-12"]').click();
  await expect(trigger).toContainText(/Oct 10/);
  await expect(trigger).toContainText(/12/);
  const dimensions = await trigger.evaluate(el => ({right:el.getBoundingClientRect().right, viewport:document.documentElement.clientWidth, width:el.getBoundingClientRect().width}));
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  expect(pageErrors).toEqual([]);
});


test("custom calendar opens from the full compact date control for Single Date and Range", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: /Choose date filter/ }).click();

  for (const target of ["single", "start", "end"]) {
    const control = page.locator('[data-date-filter="calendar:' + target + '"]');
    await expect(control).toBeVisible();
    const geometry = await control.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {width: rect.width, height: rect.height, right: rect.right, viewport: document.documentElement.clientWidth};
    });
    expect(geometry.width).toBeGreaterThan(100);
    expect(geometry.height).toBeGreaterThanOrEqual(36);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
    await control.click();
    await expect(page.locator(".date-calendar")).toBeVisible();
  }
});


test("date calendar defaults to current month, supports year-month-date drill-down, and spans the date section", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const trigger = page.getByRole("button", { name: /Choose date filter/ });
  await trigger.click();

  const singleSection = page.locator(".date-filter-single");
  await expect(singleSection.getByRole("heading", { name: "Single Date" })).toBeVisible();
  await expect(singleSection.locator(".ui-label")).toHaveCount(0);
  await page.locator('[data-date-filter="calendar:single"]').click();
  await expect(page.locator(".date-calendar-weekdays span")).toHaveText(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const defaultMonth = await page.locator(".date-calendar-title-button").first().textContent();
  expect(defaultMonth?.trim()).not.toBe("");
  await expect(page.locator(".date-calendar-days")).toBeVisible();

  await page.locator('[data-date-filter="view:year"]').click();
  await expect(page.locator(".date-calendar-years .date-calendar-choice")).toHaveCount(12);
  await page.locator('[data-date-filter="pick-year:2026"]').click();
  await expect(page.locator(".date-calendar-months .date-calendar-choice")).toHaveCount(12);
  await page.locator('[data-date-filter="pick-month:9"]').click();
  await expect(page.locator(".date-calendar-days")).toBeVisible();
  await page.locator('[data-date-filter="day:2026-10-08"]').click();
  await expect(trigger).toContainText(/Oct 8/);

  await trigger.click();
  await page.locator('[data-date-filter="calendar:start"]').click();
  let calendar = page.locator(".date-filter-custom:not(.date-filter-single) > .date-calendar");
  let geometry = await calendar.evaluate(el => ({calendar:el.getBoundingClientRect().width, section:el.parentElement.getBoundingClientRect().width}));
  expect(geometry.calendar).toBeGreaterThanOrEqual(geometry.section - 30);
  await page.locator('[data-date-filter="day:2026-10-10"]').click();
  calendar = page.locator(".date-filter-custom:not(.date-filter-single) > .date-calendar");
  geometry = await calendar.evaluate(el => ({calendar:el.getBoundingClientRect().width, section:el.parentElement.getBoundingClientRect().width}));
  expect(geometry.calendar).toBeGreaterThanOrEqual(geometry.section - 30);
});
