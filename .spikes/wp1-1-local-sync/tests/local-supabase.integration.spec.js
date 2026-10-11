import { test, expect } from "@playwright/test";

const password = "Kitchen-Sync-42!";

async function createAccount(page) {
  const email = "wp16-" + Date.now() + "-" + Math.random().toString(16).slice(2) + "@example.test";
  await page.goto("/");
  await expect(page.locator("#auth-panel")).toBeVisible();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#auth-state")).toContainText("Account created and signed in", { timeout: 10000 });
  return email;
}

test("local Supabase Auth creates a profile, syncs offline edits after reconnect, and survives reload", async ({ page, context }) => {
  await createAccount(page);
  const name = page.locator("#business-name");
  await name.fill("Offline First Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 10000 });

  await context.setOffline(true);
  await name.fill("Offline Updated Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("waiting to sync");
  await page.reload();
  await expect(name).toHaveValue("Offline Updated Kitchen");
  await expect(page.locator("#profile-state")).toContainText("waiting to sync");

  await context.setOffline(false);
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 2", { timeout: 15000 });
  await page.reload();
  await expect(name).toHaveValue("Offline Updated Kitchen");
  await expect(page.locator("#profile-state")).toContainText("revision 2");
});

test("anonymous local draft is not silently uploaded when signing in; import is explicit", async ({ page }) => {
  await page.goto("/");
  await page.locator("#business-name").fill("Private Device Draft");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("not synced");
  await createAccount(page);
  await expect(page.locator("#business-name")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copy local draft into my account" })).toBeVisible();
  await page.getByRole("button", { name: "Copy local draft into my account" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 10000 });
  await expect(page.locator("#business-name")).toHaveValue("Private Device Draft");
});

test("two sessions based on the same revision preserve both candidates and require conflict resolution", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const email = await createAccount(firstPage);
  const passwordInput = firstPage.locator("#auth-password");
  await firstPage.locator("#business-name").fill("Shared Base Kitchen");
  await firstPage.getByRole("button", { name: "Save profile" }).click();
  await expect(firstPage.locator("#profile-state")).toContainText("revision 1", { timeout: 10000 });

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/");
  await secondPage.locator("#auth-email").fill(email);
  await secondPage.locator("#auth-password").fill(password);
  await secondPage.getByRole("button", { name: "Sign in" }).click();
  await expect(secondPage.locator("#business-name")).toHaveValue("Shared Base Kitchen", { timeout: 10000 });

  await secondContext.setOffline(true);
  await secondPage.locator("#business-name").fill("Local Candidate Kitchen");
  await secondPage.getByRole("button", { name: "Save profile" }).click();
  await expect(secondPage.locator("#profile-state")).toContainText("waiting to sync");

  await firstPage.locator("#business-name").fill("Remote Candidate Kitchen");
  await firstPage.getByRole("button", { name: "Save profile" }).click();
  await expect(firstPage.locator("#profile-state")).toContainText("revision 2", { timeout: 10000 });

  await secondContext.setOffline(false);
  await expect(secondPage.locator("#conflict-panel")).toBeVisible({ timeout: 15000 });
  await expect(secondPage.locator("#conflict-base")).toContainText("Shared Base Kitchen");
  await expect(secondPage.locator("#conflict-local")).toContainText("Local Candidate Kitchen");
  await expect(secondPage.locator("#conflict-remote")).toContainText("Remote Candidate Kitchen");
  await secondPage.getByRole("button", { name: "Keep local" }).click();
  await expect(secondPage.locator("#profile-state")).toContainText("revision 3", { timeout: 15000 });
  await expect(secondPage.locator("#business-name")).toHaveValue("Local Candidate Kitchen");

  await firstContext.close();
  await secondContext.close();
});
