import { test, expect } from "@playwright/test";

test("shell is responsive and reports connection state at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Online");
  await page.setViewportSize({ width: 1365, height: 900 });
  const desktopColumns = await page.locator(".status-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(desktopColumns).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width);
  const mobileColumns = await page.locator(".status-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(mobileColumns).toBe(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});

test("service worker keeps the app shell navigable after going offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await context.setOffline(false);
});

test("install prompt handler reveals the button and calls the prompt", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => { window.__kitchaiPromptCalled = true; };
    window.dispatchEvent(event);
  });
  const button = page.getByRole("button", { name: "Install app" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toBeHidden();
  expect(await page.evaluate(() => window.__kitchaiPromptCalled)).toBe(true);
});
