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
  const headerLayout = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const modeButtons = [...document.querySelectorAll(".mode-button")].map(button => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    return {
      menu: rect(".menu-toggle"),
      modes: rect(".topbar-mode-switch"),
      actions: rect(".topbar-actions"),
      modeButtons,
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    };
  });
  expect(headerLayout.modes.left).toBeGreaterThanOrEqual(headerLayout.menu.right - 1);
  expect(headerLayout.actions.top).toBeGreaterThanOrEqual(headerLayout.modes.bottom - 1);
  expect(headerLayout.modeButtons[0].right).toBeLessThanOrEqual(headerLayout.modeButtons[1].left + 1);
  expect(headerLayout.content).toBeLessThanOrEqual(headerLayout.viewport);
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


test("Ingredients page supports empty state, category creation, reusable and one-time forms", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Ingredients" }).click();
  await expect(page.getByRole("heading", { name: "No data yet" })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create Category" }).click();
  await page.getByLabel("Name *").fill("Dry goods");
  await page.getByRole("button", { name: "Create", exact: true }).last().click();
  await expect(page.getByText("Dry goods", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create Ingredient" }).click();
  await page.getByLabel("Name *").fill("Rice");
  await page.getByLabel("Category").fill("Dry goods");
  await page.getByRole("button", { name: "Create", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Rice" })).toBeVisible();
  await expect(page.getByText(/Reusable/)).toBeVisible();

  await page.getByRole("button", { name: "Create Ingredient" }).click();
  await page.getByLabel("Name *").fill("Oil");
  await page.getByLabel("Type").selectOption({ label: "One time" });
  await expect(page.getByLabel("Quantity")).toBeVisible();
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit").fill("liter");
  await page.getByLabel("Price").fill("50");
  await page.getByRole("button", { name: "Create", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Oil" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Menu form supports default category, ingredient selection, note and selling price", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No data yet" })).toBeVisible();
  await page.getByRole("button", { name: "Create Menu" }).click();
  await page.getByLabel("Name *").fill("Seaweed rice roll");
  await page.getByLabel("Note (optional)").fill("Preview test");
  await page.getByLabel("Selling price *").fill("100");
  await page.getByRole("button", { name: "Create", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Seaweed rice roll" })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("Preview test")).toBeVisible();
  await expect(page.getByText(/Selling price: 100/)).toBeVisible();
  await page.getByRole("button", { name: /AI Mode/ }).click();
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await expect(page.getByRole("heading", { name: "Seaweed rice roll" })).toBeVisible();
  await expect(page.getByText("Preview test")).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test("AI Mode renders a chat composer and keeps its preview conversation when switching modes", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask KitchAI about your kitchen" })).toBeVisible();
  await page.getByLabel("Message").fill("How should I organize ingredients?");
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByText("How should I organize ingredients?")).toBeVisible();
  await expect(page.getByText(/AI is not connected yet/)).toBeVisible();

  await page.getByRole("button", { name: /Manage Mode/ }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: /AI Mode/ }).click();
  await expect(page.getByText("How should I organize ingredients?")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
