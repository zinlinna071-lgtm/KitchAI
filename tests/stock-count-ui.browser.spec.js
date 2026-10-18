import { test, expect } from "@playwright/test";

test("rebuilt shell switches modes and preserves each mode's working page", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();

  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingredients" })).toBeVisible();
  await page.getByRole("button", { name: "Ingredients" }).click();
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();

  await page.getByRole("button", { name: /AI Mode/ }).click();
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("shared shell and mobile drawer remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/open/);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
