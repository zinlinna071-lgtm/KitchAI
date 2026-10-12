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

  await firstPage.locator("#business-name").fill("Stale First Session Candidate");
  await firstPage.getByRole("button", { name: "Save profile" }).click();
  await expect(firstPage.locator("#conflict-panel")).toBeVisible({ timeout: 15000 });
  await expect(firstPage.locator("#conflict-remote")).toContainText("Local Candidate Kitchen");
  await firstPage.getByRole("button", { name: "Use remote" }).click();
  await expect(firstPage.locator("#business-name")).toHaveValue("Local Candidate Kitchen");
  await expect(firstPage.locator("#profile-state")).toContainText("revision 3");
  await expect(firstPage.locator("#conflict-panel")).toBeHidden();

  await firstContext.close();
  await secondContext.close();
});

test("sign-out locks the previous owner's unsynced queue before another account signs in", async ({ page, context }) => {
  await createAccount(page);
  const ownerA = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kitchai.auth.session")).user.id);
  await page.locator("#business-name").fill("Owner A Synced Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("revision 1", { timeout: 10000 });

  await context.setOffline(true);
  await page.locator("#business-name").fill("Owner A Unsynced Update");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("waiting to sync");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeHidden();
  await expect(page.locator("#business-name")).toHaveValue("");
  await context.setOffline(false);

  await createAccount(page);
  await expect(page.locator("#business-name")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copy local draft into my account" })).toBeHidden();
  const queueState = await page.evaluate(async (previousOwner) => {
    const sync = await import("/src/sync-store.js");
    const previous = await sync.listOperations(previousOwner);
    const active = JSON.parse(sessionStorage.getItem("kitchai.auth.session")).user.id;
    return {
      previousOwnerStillHasPending: previous.some(operation => ["pending", "retryable_error", "in_flight"].includes(operation.state)),
      activeOwnerHasPreviousQueue: (await sync.listOperations(active)).some(operation => operation.ownerId === previousOwner),
    };
  }, ownerA);
  expect(queueState.previousOwnerStillHasPending).toBe(true);
  expect(queueState.activeOwnerHasPreviousQueue).toBe(false);
});

test("an offline create colliding with an existing remote profile becomes a resolvable conflict", async ({ page, context }) => {
  await createAccount(page);
  await page.locator("#business-name").fill("Existing Remote Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("revision 1", { timeout: 10000 });
  const ownerAndProfile = await page.evaluate(async () => {
    const sync = await import("/src/sync-store.js");
    const profile = (await sync.listOwnerProfiles(JSON.parse(sessionStorage.getItem("kitchai.auth.session")).user.id))[0];
    return { ownerId: profile.ownerId, profileId: profile.id, businessId: profile.businessId };
  });
  await page.evaluate(async ({ ownerId, profileId }) => {
    const request = indexedDB.open("kitchai-sync", 2);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").delete([ownerId, profileId]);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, ownerAndProfile);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#business-name")).toHaveValue("");
  await page.locator("#business-name").fill("Offline Replacement Candidate");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("waiting to sync");
  await context.setOffline(false);
  await expect(page.locator("#conflict-panel")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#conflict-local")).toContainText("Offline Replacement Candidate");
  await expect(page.locator("#conflict-remote")).toContainText("Existing Remote Kitchen");
  await page.getByRole("button", { name: "Keep local" }).click();
  await expect(page.locator("#profile-state")).toContainText("revision 2", { timeout: 15000 });
  await expect(page.locator("#business-name")).toHaveValue("Offline Replacement Candidate");
  const finalProfile = await page.evaluate(async () => {
    const sync = await import("/src/sync-store.js");
    const ownerId = JSON.parse(sessionStorage.getItem("kitchai.auth.session")).user.id;
    return (await sync.listOwnerProfiles(ownerId))[0];
  });
  expect(finalProfile.id).toBe(ownerAndProfile.profileId);
  expect(finalProfile.businessId).toBe(ownerAndProfile.businessId);
});


test("Phase 2 ingredient, menu item, recipe, and recipe line sync end to end against local Supabase", async ({ page }) => {
  await createAccount(page);
  await page.locator("#business-name").fill("Phase Two Integration Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 15000 });
  await page.context().setOffline(true);

  await page.locator("#ingredient-name").fill("Integration Mushrooms");
  await page.locator("#ingredient-description").fill("Created by the Phase 2 integration test");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Integration Mushrooms");

  await page.locator("#menu-item-name").fill("Integration Mushroom Soup");
  await page.locator("#menu-item-description").fill("Phase 2 sync test menu item");
  await page.getByRole("button", { name: "Add menu item" }).click();
  await expect(page.locator("#menu-item-list")).toContainText("Integration Mushroom Soup");

  await page.locator("#recipe-menu-item").selectOption({ label: "Integration Mushroom Soup" });
  await page.locator("#recipe-name").fill("Integration Mushroom Soup Base");
  await page.locator("#recipe-yield").fill("4");
  await page.getByRole("button", { name: "Save recipe draft" }).click();
  await expect(page.locator("#recipe-list")).toContainText("Integration Mushroom Soup Base");

  await page.locator("#recipe-line-recipe").selectOption({ label: "Integration Mushroom Soup Base · Draft" });
  await page.locator("#recipe-line-ingredient").selectOption({ label: "Integration Mushrooms" });
  await page.locator("#recipe-line-quantity").fill("250");
  await page.locator("#recipe-line-unit").selectOption("g");
  await page.locator("#recipe-line-position").fill("0");
  await page.locator("#recipe-line-note").fill("Integration test line");
  await page.getByRole("button", { name: "Add ingredient line" }).click();
  await expect(page.locator("#recipe-line-list")).toContainText("250 g");

  await page.context().setOffline(false);
  await expect.poll(async () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.map(item => item.state).sort();
  }), { timeout: 20000 }).toEqual(["synced", "synced", "synced", "synced"]);

  const operationEvidence = await page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return {
      types: [...new Set(operations.map(item => item.entityType))].sort(),
      allAcknowledged: operations.length === 4 && operations.every(item => item.state === "synced" && Number.isInteger(item.remoteRevision) && item.remoteRevision > 0),
      operationIds: operations.map(item => item.operationId),
    };
  });
  expect(operationEvidence.types).toEqual(["ingredient", "menuItem", "recipe", "recipeLine"]);
  expect(operationEvidence.allAcknowledged).toBe(true);
  expect(new Set(operationEvidence.operationIds).size).toBe(4);

  await page.reload();
  await expect(page.locator("#ingredient-list")).toContainText("Integration Mushrooms");
  await expect(page.locator("#menu-item-list")).toContainText("Integration Mushroom Soup");
  await expect(page.locator("#recipe-list")).toContainText("Integration Mushroom Soup Base");
  await expect(page.locator("#recipe-line-list")).toContainText("250 g");
});
