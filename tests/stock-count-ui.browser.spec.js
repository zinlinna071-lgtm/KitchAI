import { test, expect } from "@playwright/test";

test("Manage Mode navigation keeps the three agreed pages title-only", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();

  for (const [label, title] of [["Dashboard", "Dashboard"], ["Menu", "Menu"], ["Ingredients", "Ingredients"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const section = page.locator("#page-content .page-title-only");
    await expect(section.getByRole("heading", { name: title })).toBeVisible();
    await expect(section.locator("button, input, select, textarea, .ui-card, p")).toHaveCount(0);
  }
  expect(pageErrors).toEqual([]);
});

test("shared shell and mobile drawer remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.locator("#sidebar-close").click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
});

test("AI Mode keeps its frontend-only chat composer", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask KitchAI about your kitchen" })).toBeVisible();
  await page.getByLabel("Message").fill("How should I organize ingredients?");
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByText("How should I organize ingredients?")).toBeVisible();
  await expect(page.getByText(/AI is not connected yet/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("desktop swipe switches mode from both drawer and main screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const aiMode = page.getByRole("button", { name: /AI Mode/ });
  const manageMode = page.getByRole("button", { name: /Manage Mode/ });
  await expect(aiMode).toHaveAttribute("aria-pressed", "true");

  // A horizontal drag starting in the drawer must switch modes too.
  await page.mouse.move(80, 260);
  await page.mouse.down();
  await page.mouse.move(200, 260, { steps: 6 });
  await page.mouse.up();
  await expect(manageMode).toHaveAttribute("aria-pressed", "true");

  // Swiping the opposite direction from the main screen switches back.
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
