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
  await expect(page.locator("#business-name")).toBeVisible();
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

test("local business profile creates, trims, updates, and survives reload", async ({ page }) => {
  await page.goto("/");
  const name = page.locator("#business-name");
  await name.fill("  Northside Kitchen  ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(name).toHaveValue("Northside Kitchen");
  await expect(page.locator("#profile-state")).toContainText("Saved on this device");
  await expect(page.locator("#profile-state")).toContainText("local version 1");
  await page.reload();
  await expect(name).toHaveValue("Northside Kitchen");
  await expect(page.locator("#profile-state")).toContainText("not synced");
  await name.fill("Northside Kitchen Two");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("local version 2");
  await page.reload();
  await expect(name).toHaveValue("Northside Kitchen Two");
  const record = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("kitchai-local", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("profiles", "readonly");
      const read = transaction.objectStore("profiles").getAll();
      read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
      read.onerror = () => reject(read.error);
    };
  }));
  expect(record.name).toBe("Northside Kitchen Two");
  expect(record).not.toHaveProperty("ownerId");
  expect(record).not.toHaveProperty("revision");
});

test("invalid blank names and unavailable storage never report a successful save", async ({ page }) => {
  await page.goto("/");
  await page.locator("#business-name").fill("    ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Enter a business name");
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined }));
  await page.reload();
  await expect(page.locator("#profile-state")).toContainText("Local storage is unavailable");
  await page.locator("#business-name").fill("Storage Failure Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Could not save locally; your changes were not saved");
  await expect(page.locator("#profile-state")).not.toContainText("Saved on this device");
});
