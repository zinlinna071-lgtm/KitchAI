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
    await expect(section.locator("button, input, select, textarea, .ui-card")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator('#page-content section.page-section[aria-label="Menu"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
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
  await page.locator("#menu-toggle").click();
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

  await page.mouse.move(80, 260);
  await page.mouse.down();
  await page.mouse.move(200, 260, { steps: 6 });
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
