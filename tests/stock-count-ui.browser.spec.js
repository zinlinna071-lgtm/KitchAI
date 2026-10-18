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
