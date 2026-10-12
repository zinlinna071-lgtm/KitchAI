import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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

test("capture desktop and mobile UI previews for review", async ({ page }) => {
  await mkdir("artifacts", { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Implemented for local testing" })).toBeVisible();
  await expect(page.getByText("Hosted sync is not configured", { exact: true })).toBeVisible();
  await expect(page.getByText("Cloud identity and sync will be introduced only after their security checks.")).toHaveCount(0);
  await expect(page.getByText("Full operational pages arrive in later phases.")).toBeVisible();
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.screenshot({ path: "artifacts/kitchai-ui-preview-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/kitchai-ui-preview-mobile.png", fullPage: true });
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
  const original = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("kitchai-local", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("profiles", "readonly");
      const read = transaction.objectStore("profiles").getAll();
      read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
      read.onerror = () => reject(read.error);
    };
  }));
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
  expect(record.createdAt).toBe(original.createdAt);
  expect(record.businessId).toBe(original.businessId);
  const metadata = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("kitchai-local", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("metadata", "readonly");
      const read = transaction.objectStore("metadata").getAll();
      read.onsuccess = () => { resolve(read.result); request.result.close(); };
      read.onerror = () => reject(read.error);
    };
  }));
  expect(metadata.find((item) => item.key === "schemaVersion").value).toBe(1);
  expect(metadata.find((item) => item.key === "localRevision:" + record.id).value).toBe(2);
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

test("owner-scoped outbox persists atomically and conflict snapshots survive resolution", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const sync = await import("/src/sync-store.js");
    const created = await sync.saveOwnerProfileDraft({ ownerId: "owner-a", name: "  Alpha Kitchen Draft  " });
    const coalesced = await sync.saveOwnerProfileDraft({ ownerId: "owner-a", id: created.profile.id, name: "Alpha Kitchen" });
    const ownerAProfiles = await sync.listOwnerProfiles("owner-a");
    const ownerBProfiles = await sync.listOwnerProfiles("owner-b");
    await sync.acknowledge(coalesced.operation.operationId, "owner-a", {
      id: coalesced.profile.id, businessId: coalesced.profile.businessId, name: coalesced.profile.name,
      createdAt: coalesced.profile.createdAt, updatedAt: new Date(Date.now() + 1).toISOString(), revision: 1,
    });
    const syncedState = (await sync.listOwnerProfiles("owner-a"))[0].syncState;
    const edited = await sync.saveOwnerProfileDraft({
      ownerId: "owner-a", id: created.profile.id, name: "Alpha Kitchen Local", baseRevision: 1,
    });
    await sync.preserveConflict(edited.operation, {
      id: created.profile.id, businessId: created.profile.businessId, name: "Alpha Kitchen Remote",
      createdAt: created.profile.createdAt, updatedAt: new Date(Date.now() + 2).toISOString(), revision: 2,
    });
    const conflicts = await sync.listConflicts("owner-a");
    const conflictState = (await sync.listOwnerProfiles("owner-a"))[0].syncState;
    await sync.keepLocalAndResolve(conflicts[0], "owner-a", {
      operationId: "resolution-operation", createdAt: new Date().toISOString(),
    });
    const operations = await sync.listOperations("owner-a");
    const resolved = await sync.listConflicts("owner-a");
    const resolutionState = (await sync.listOwnerProfiles("owner-a"))[0].syncState;
    localStorage.setItem("wp15-record-id", created.profile.id);
    return {
      profileCount: ownerAProfiles.length,
      otherOwnerCount: ownerBProfiles.length,
      syncedState,
      conflictState,
      resolutionState,
      initialOperation: created.operation,
      coalescedOperationId: coalesced.operation.operationId,
      operationStates: operations.map((operation) => operation.state),
      conflictCount: resolved.length,
      conflictRecordState: resolved[0].state,
      baseName: resolved[0].baseSnapshot.name,
      localName: resolved[0].localSnapshot.name,
      remoteName: resolved[0].remoteSnapshot.name,
      resolutionBaseRevision: operations.find((operation) => operation.operationId === "resolution-operation").baseRevision,
    };
  });
  expect(result.profileCount).toBe(1);
  expect(result.otherOwnerCount).toBe(0);
  expect(result.syncedState).toBe("synced");
  expect(result.conflictState).toBe("conflict");
  expect(result.conflictRecordState).toBe("resolved");
  expect(result.resolutionState).toBe("pending");
  expect(result.initialOperation.operation).toBe("create");
  expect(result.initialOperation.baseRevision).toBeNull();
  expect(result.coalescedOperationId).toBe(result.initialOperation.operationId);
  expect(result.operationStates).toContain("conflict_resolved");
  expect(result.operationStates).toContain("pending");
  expect(result.conflictCount).toBe(1);
  expect(result.conflictRecordState).toBe("resolved");
  expect(result.baseName).toBe("Alpha Kitchen");
  expect(result.localName).toBe("Alpha Kitchen Local");
  expect(result.remoteName).toBe("Alpha Kitchen Remote");
  expect(result.resolutionBaseRevision).toBe(2);
  await page.reload();
  const persisted = await page.evaluate(async () => {
    const sync = await import("/src/sync-store.js");
    return {
      operations: await sync.listOperations("owner-a"),
      conflicts: await sync.listConflicts("owner-a"),
      ownerBProfiles: await sync.listOwnerProfiles("owner-b"),
    };
  });
  expect(persisted.operations.some((operation) => operation.operationId === "resolution-operation")).toBe(true);
  expect(persisted.conflicts[0].state).toBe("resolved");
  expect(persisted.ownerBProfiles).toHaveLength(0);
});


test("keyboard skip link moves focus to main and primary controls have accessible names", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  await expect(page.getByRole("textbox", { name: "Business name" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();
  await expect(page.getByRole("status").first()).toBeVisible();
});

test("large text at narrow viewport does not introduce horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("heading", { name: "Good work starts with a clear view." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Business name" })).toBeVisible();
});

test("local ingredient catalog creates, edits, archives, reloads, and stays in its business partition", async ({ page }) => {
  await page.goto("/");
  await page.locator("#business-name").fill("Ingredient Test Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Saved on this device");
  const name = page.locator("#ingredient-name");
  await expect(name).toBeEnabled();
  await name.fill("  Fresh basil  ");
  await page.locator("#ingredient-description").fill("  Leaves for garnish  ");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-state")).toContainText("saved on this device");
  let item = page.locator(".ingredient-list-item").filter({ hasText: "Fresh basil" });
  await expect(item).toContainText("Leaves for garnish");
  await expect(item).toContainText("Active");

  const partitionResult = await page.evaluate(async () => {
    const request = indexedDB.open("kitchai-local", 1);
    const profile = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction("profiles", "readonly");
        const read = tx.objectStore("profiles").getAll();
        read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
        read.onerror = () => reject(read.error);
      };
    });
    const store = await import("/src/ingredient-store.js");
    const sameScope = await store.listIngredients({ ownerId: "local:" + profile.businessId, businessId: profile.businessId });
    const otherScope = await store.listIngredients({ ownerId: "other-owner", businessId: profile.businessId });
    return { profile, sameScope, otherScope };
  });
  expect(partitionResult.sameScope).toHaveLength(1);
  expect(partitionResult.sameScope[0].name).toBe("Fresh basil");
  expect(partitionResult.sameScope[0].ownerId).toBe("local:" + partitionResult.profile.businessId);
  expect(partitionResult.otherScope).toHaveLength(0);

  await page.reload();
  item = page.locator(".ingredient-list-item").filter({ hasText: "Fresh basil" });
  await expect(item).toContainText("Leaves for garnish");
  await item.getByRole("button", { name: "Edit" }).click();
  await page.locator("#ingredient-name").fill("Thai basil");
  await page.getByRole("button", { name: "Save changes" }).click();
  item = page.locator(".ingredient-list-item").filter({ hasText: "Thai basil" });
  await expect(item).toContainText("Active");
  await item.getByRole("button", { name: "Archive" }).click();
  await expect(item).toContainText("Archived");
  await item.getByRole("button", { name: "Reactivate" }).click();
  await expect(item).toContainText("Active");
});

test("local menu workflow creates, edits, archives, reloads, and stays in its business partition", async ({ page }) => {
  await page.goto("/");
  await page.locator("#business-name").fill("Menu Test Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Saved on this device");
  const name = page.locator("#menu-item-name");
  await expect(name).toBeEnabled();
  await name.fill("  Noodle Soup  ");
  await page.locator("#menu-item-description").fill("  House broth and rice noodles  ");
  await page.getByRole("button", { name: "Add menu item" }).click();
  await expect(page.locator("#menu-item-state")).toContainText("saved on this device");
  let item = page.locator("#menu-item-list .ingredient-list-item").filter({ hasText: "Noodle Soup" });
  await expect(item).toContainText("House broth and rice noodles");
  await expect(item).toContainText("Active");

  const partitionResult = await page.evaluate(async () => {
    const request = indexedDB.open("kitchai-local", 1);
    const profile = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction("profiles", "readonly");
        const read = tx.objectStore("profiles").getAll();
        read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
        read.onerror = () => reject(read.error);
      };
    });
    const store = await import("/src/menu-item-store.js");
    const sameScope = await store.listMenuItems({ ownerId: "local:" + profile.businessId, businessId: profile.businessId });
    const otherScope = await store.listMenuItems({ ownerId: "other-owner", businessId: profile.businessId });
    return { profile, sameScope, otherScope };
  });
  expect(partitionResult.sameScope).toHaveLength(1);
  expect(partitionResult.sameScope[0].name).toBe("Noodle Soup");
  expect(partitionResult.sameScope[0].ownerId).toBe("local:" + partitionResult.profile.businessId);
  expect(partitionResult.otherScope).toHaveLength(0);

  await page.reload();
  item = page.locator("#menu-item-list .ingredient-list-item").filter({ hasText: "Noodle Soup" });
  await expect(item).toContainText("House broth and rice noodles");
  await item.getByRole("button", { name: "Edit" }).click();
  await page.locator("#menu-item-name").fill("Chicken Noodle Soup");
  await page.getByRole("button", { name: "Save changes" }).click();
  item = page.locator("#menu-item-list .ingredient-list-item").filter({ hasText: "Chicken Noodle Soup" });
  await expect(item).toContainText("Active");
  await item.getByRole("button", { name: "Archive" }).click();
  await expect(item).toContainText("Archived");
  await item.getByRole("button", { name: "Reactivate" }).click();
  await expect(item).toContainText("Active");
});

test("recipe workflow links menu items and ingredients, validates activation, and preserves edited lines", async ({ page }) => {
  await page.goto("/");
  await page.locator("#business-name").fill("Recipe Test Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Saved on this device");

  await page.locator("#ingredient-name").fill("Rice noodles");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-state")).toContainText("saved on this device");
  await expect(page.locator("#recipe-line-ingredient option", { hasText: "Rice noodles" })).toHaveCount(1);

  await page.locator("#menu-item-name").fill("Noodle Soup");
  await page.getByRole("button", { name: "Add menu item" }).click();
  await expect(page.locator("#menu-item-state")).toContainText("saved on this device");
  await expect(page.locator("#recipe-menu-item option", { hasText: "Noodle Soup" })).toHaveCount(1);

  await page.locator("#recipe-menu-item").selectOption({ label: "Noodle Soup" });
  await page.locator("#recipe-name").fill("House Noodle Soup");
  await page.locator("#recipe-instructions").fill("Simmer the broth, then add noodles.");
  await page.locator("#recipe-yield").fill("2");
  await page.getByRole("button", { name: "Save recipe draft" }).click();
  let recipe = page.locator("#recipe-list .ingredient-list-item").filter({ hasText: "House Noodle Soup" });
  await expect(recipe).toContainText("Draft");
  await recipe.getByRole("button", { name: "Activate" }).click();
  await expect(page.locator("#recipe-state")).toContainText("Add at least one ingredient line");
  await expect(recipe).toContainText("Draft");
  await page.locator("#recipe-line-ingredient").selectOption({ label: "Rice noodles" });
  await page.locator("#recipe-line-quantity").fill("250");
  await page.locator("#recipe-line-unit").selectOption("g");
  await page.getByRole("button", { name: "Add ingredient line" }).click();
  let line = page.locator("#recipe-line-list .ingredient-list-item").filter({ hasText: "Rice noodles" });
  await expect(line).toContainText("250 g");

  await line.getByRole("button", { name: "Edit line" }).click();
  await page.locator("#recipe-line-quantity").fill("275");
  await page.getByRole("button", { name: "Save line changes" }).click();
  line = page.locator("#recipe-line-list .ingredient-list-item").filter({ hasText: "Rice noodles" });
  await expect(line).toContainText("275 g");
  await expect(page.locator("#recipe-line-list .ingredient-list-item")).toHaveCount(1);

  await recipe.getByRole("button", { name: "Activate" }).click();
  await expect(recipe).toContainText("Active");
  await page.reload();
  recipe = page.locator("#recipe-list .ingredient-list-item").filter({ hasText: "House Noodle Soup" });
  await expect(recipe).toContainText("Active");
  line = page.locator("#recipe-line-list .ingredient-list-item").filter({ hasText: "Rice noodles" });
  await expect(line).toContainText("275 g");

  const isolation = await page.evaluate(async () => {
    const request = indexedDB.open("kitchai-local", 1);
    const profile = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction("profiles", "readonly");
        const read = tx.objectStore("profiles").getAll();
        read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
        read.onerror = () => reject(read.error);
      };
    });
    const module = await import("/src/recipe-store.js");
    const scope = { ownerId: "local:" + profile.businessId, businessId: profile.businessId };
    const own = await module.listRecipes(scope);
    const other = await module.listRecipes({ ownerId: "different-owner", businessId: profile.businessId });
    return { own, other };
  });
  expect(isolation.own).toHaveLength(1);
  expect(isolation.own[0].name).toBe("House Noodle Soup");
  expect(isolation.other).toHaveLength(0);
  const foreignWrite = await page.evaluate(async () => {
    const request = indexedDB.open("kitchai-local", 1);
    const profile = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction("profiles", "readonly");
        const read = tx.objectStore("profiles").getAll();
        read.onsuccess = () => { resolve(read.result[0]); request.result.close(); };
        read.onerror = () => reject(read.error);
      };
    });
    const recipes = await import("/src/recipe-store.js");
    const ownScope = { ownerId: "local:" + profile.businessId, businessId: profile.businessId };
    const ownRecipes = await recipes.listRecipes(ownScope);
    const lines = await recipes.listRecipeLines(ownScope, ownRecipes[0].id);
    try {
      await recipes.saveRecipeLine({ ownerId: "different-owner", businessId: profile.businessId }, {
        recipeId: ownRecipes[0].id,
        ingredientId: lines[0].ingredientId,
        quantity: 1,
        unit: "g",
        position: 99,
      });
      return "unexpected success";
    } catch (error) {
      return error instanceof Error ? error.message : "rejected";
    }
  });
  expect(foreignWrite).toContain("recipe in this business");
});
