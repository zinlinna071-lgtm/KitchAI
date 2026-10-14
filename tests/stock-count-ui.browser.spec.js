import { test, expect } from "@playwright/test";

test("stock-count review controls render accessibly and cannot post an empty draft", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Review a physical stock count." })).toBeVisible();

  const sessionPicker = page.getByRole("combobox", { name: "Stock-count session" });
  await expect(sessionPicker).toBeVisible();
  await expect(page.getByRole("list", { name: "Stock-count lines" })).toBeVisible();
  await expect(page.locator("#stock-count-state")).toContainText("Save or load a business profile");

  const postButton = page.getByRole("button", { name: "Post selected reviewed lines" });
  await expect(postButton).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create session" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add count line" })).toBeDisabled();

  await sessionPicker.focus();
  await expect(sessionPicker).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("stock-count review remains usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Review a physical stock count." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post selected reviewed lines" })).toBeDisabled();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
