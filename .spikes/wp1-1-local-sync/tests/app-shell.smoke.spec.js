import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

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
      id: coalesced.profile.id, businessId: coalesced.profile.id, name: coalesced.profile.name,
      createdAt: coalesced.profile.createdAt, updatedAt: new Date(Date.now() + 1).toISOString(), revision: 1,
    });
    const syncedState = (await sync.listOwnerProfiles("owner-a"))[0].syncState;
    const edited = await sync.saveOwnerProfileDraft({
      ownerId: "owner-a", id: created.profile.id, name: "Alpha Kitchen Local", baseRevision: 1,
    });
    await sync.preserveConflict(edited.operation, {
      id: created.profile.id, businessId: created.profile.id, name: "Alpha Kitchen Remote",
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
    const sameScope = await store.listIngredients({ ownerId: "local:" + profile.id, businessId: profile.id });
    const otherScope = await store.listIngredients({ ownerId: "other-owner", businessId: profile.id });
    return { profile, sameScope, otherScope };
  });
  expect(partitionResult.sameScope).toHaveLength(1);
  expect(partitionResult.sameScope[0].name).toBe("Fresh basil");
  expect(partitionResult.sameScope[0].ownerId).toBe("local:" + partitionResult.profile.id);
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
    const sameScope = await store.listMenuItems({ ownerId: "local:" + profile.id, businessId: profile.id });
    const otherScope = await store.listMenuItems({ ownerId: "other-owner", businessId: profile.id });
    return { profile, sameScope, otherScope };
  });
  expect(partitionResult.sameScope).toHaveLength(1);
  expect(partitionResult.sameScope[0].name).toBe("Noodle Soup");
  expect(partitionResult.sameScope[0].ownerId).toBe("local:" + partitionResult.profile.id);
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
    const scope = { ownerId: "local:" + profile.id, businessId: profile.id };
    const own = await module.listRecipes(scope);
    const other = await module.listRecipes({ ownerId: "different-owner", businessId: profile.id });
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
    const ownScope = { ownerId: "local:" + profile.id, businessId: profile.id };
    const ownRecipes = await recipes.listRecipes(ownScope);
    const lines = await recipes.listRecipeLines(ownScope, ownRecipes[0].id);
    try {
      await recipes.saveRecipeLine({ ownerId: "different-owner", businessId: profile.id }, {
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

test("WP2.5a disposable migration preserves sources, rolls back interruption, and is idempotent", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const seed = async (databaseName, stores) => new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        for (const [storeName, rows] of Object.entries(stores)) {
          const keyPath = ["ownerId", "businessId", "id"];
          const store = request.result.createObjectStore(storeName, { keyPath });
          if (storeName !== "recipeLines") store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
          for (const row of rows) store.put(row);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(Object.keys(stores), "readwrite");
        for (const [storeName, rows] of Object.entries(stores)) {
          for (const row of rows) tx.objectStore(storeName).put(row);
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
    const stamp = "2026-10-12T00:00:00.000Z";
    const scope = { ownerId: "owner-1", businessId: "business-1" };
    await seed("kitchai-ingredients", { ingredients: [{ ...scope, id: "ingredient-1", name: "Rice noodles", status: "active", createdAt: stamp, updatedAt: stamp }] });
    await seed("kitchai-menu", { menuItems: [{ ...scope, id: "menu-1", name: "Noodle soup", status: "active", createdAt: stamp, updatedAt: stamp }] });
    await seed("kitchai-recipes", {
      recipes: [{ ...scope, id: "recipe-1", menuItemId: "menu-1", name: "House recipe", status: "draft", yieldPortions: 2, createdAt: stamp, updatedAt: stamp }],
      recipeLines: [{ ...scope, id: "line-1", recipeId: "recipe-1", ingredientId: "ingredient-1", quantity: 250, unit: "g", position: 0, createdAt: stamp, updatedAt: stamp }],
    });
  });
  await page.addScriptTag({ path: resolve(process.cwd(), "../../.spikes/wp2-5-entity-sync/migration-prototype.js") });
  const interrupted = await page.evaluate(async () => {
    try {
      await window.KitchAIEntityMigrationSpike.migratePhase2Entities({ targetName: "kitchai-business-data-spike", failAfterWrites: 2 });
      return "unexpected success";
    } catch (error) {
      return error instanceof Error ? error.message : "rejected";
    }
  });
  expect(interrupted).toContain("transaction rolled back");

  const afterRollback = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data-spike");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const counts = await new Promise((resolve, reject) => {
      const tx = db.transaction(["ingredients", "menuItems", "recipes", "recipeLines", "metadata"], "readonly");
      const result = {};
      for (const name of ["ingredients", "menuItems", "recipes", "recipeLines", "metadata"]) {
        const request = tx.objectStore(name).count();
        request.onsuccess = () => { result[name] = request.result; };
        request.onerror = () => reject(request.error);
      }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => reject(tx.error);
    });
    return counts;
  });
  expect(afterRollback).toEqual({ ingredients: 0, menuItems: 0, recipes: 0, recipeLines: 0, metadata: 0 });

  const first = await page.evaluate(() => window.KitchAIEntityMigrationSpike.migratePhase2Entities({ targetName: "kitchai-business-data-spike" }));
  expect(first.alreadyCompleted).toBe(false);
  expect(first.imported).toBe(4);
  expect(first.sourceCounts).toEqual({ ingredients: 1, menuItems: 1, recipes: 1, recipeLines: 1 });

  const second = await page.evaluate(() => window.KitchAIEntityMigrationSpike.migratePhase2Entities({ targetName: "kitchai-business-data-spike" }));
  expect(second.alreadyCompleted).toBe(true);
  expect(second.imported).toBe(0);

  const result = await page.evaluate(async () => {
    const readAll = async (name, storeName) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return rows;
    };
    return {
      ingredients: await readAll("kitchai-business-data-spike", "ingredients"),
      menuItems: await readAll("kitchai-business-data-spike", "menuItems"),
      recipes: await readAll("kitchai-business-data-spike", "recipes"),
      recipeLines: await readAll("kitchai-business-data-spike", "recipeLines"),
      sourceIngredients: await readAll("kitchai-ingredients", "ingredients"),
      sourceMenuItems: await readAll("kitchai-menu", "menuItems"),
      sourceRecipes: await readAll("kitchai-recipes", "recipes"),
      sourceLines: await readAll("kitchai-recipes", "recipeLines"),
    };
  });
  expect(result.ingredients[0].name).toBe("Rice noodles");
  expect(result.menuItems[0].name).toBe("Noodle soup");
  expect(result.recipes[0].menuItemId).toBe("menu-1");
  expect(result.recipeLines[0]).toMatchObject({ recipeId: "recipe-1", ingredientId: "ingredient-1", quantity: 250, unit: "g" });
  expect([result.sourceIngredients.length, result.sourceMenuItems.length, result.sourceRecipes.length, result.sourceLines.length]).toEqual([1, 1, 1, 1]);
});

test("WP2.5b migrates legacy entities to stable profile scope and preserves concurrent changes", async ({ page }) => {
  await page.goto("/favicon.svg");
  await page.evaluate(async () => {
    const deleteDatabase = (name) => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Could not clear disposable test database " + name));
    });
    for (const name of ["kitchai-business-data", "kitchai-ingredients", "kitchai-menu", "kitchai-recipes", "kitchai-local", "kitchai-sync"]) {
      await deleteDatabase(name);
    }
    const stamp = "2026-10-12T00:00:00.000Z";
    const scope = { ownerId: "local:business-old", businessId: "business-old" };
    const seed = (name, definitions) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const [storeName, definition] of Object.entries(definitions)) {
          const store = request.result.createObjectStore(storeName, { keyPath: definition.keyPath });
          for (const [indexName, keyPath] of definition.indexes ?? []) store.createIndex(indexName, keyPath, { unique: false });
          for (const row of definition.rows) store.put(row);
        }
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    await seed("kitchai-local", {
      profiles: { keyPath: "id", rows: [{ id: "profile-1", businessId: "business-old", name: "Migration Kitchen", createdAt: stamp, updatedAt: stamp }] },
      metadata: { keyPath: "key", rows: [{ key: "businessId", value: "business-old" }, { key: "localRevision:profile-1", value: 1 }] },
    });
    await seed("kitchai-ingredients", {
      ingredients: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [{ ...scope, id: "ingredient-1", name: "Legacy Basil", status: "active", createdAt: stamp, updatedAt: stamp }] },
    });
    await seed("kitchai-menu", {
      menuItems: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [{ ...scope, id: "menu-1", name: "Legacy Soup", status: "active", createdAt: stamp, updatedAt: stamp }] },
    });
    await seed("kitchai-recipes", {
      recipes: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]], rows: [{ ...scope, id: "recipe-1", menuItemId: "menu-1", name: "Legacy Recipe", status: "draft", yieldPortions: 2, createdAt: stamp, updatedAt: stamp }] },
      recipeLines: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]], rows: [{ ...scope, id: "line-1", recipeId: "recipe-1", ingredientId: "ingredient-1", quantity: 200, unit: "g", position: 0, createdAt: stamp, updatedAt: stamp }] },
    });
  });

  await page.goto("/");
  await expect(page.locator("#business-name")).toHaveValue("Migration Kitchen");
  await expect(page.locator("#ingredient-list")).toContainText("Legacy Basil");
  await expect(page.locator("#menu-item-list")).toContainText("Legacy Soup");
  await expect(page.locator("#recipe-list")).toContainText("Legacy Recipe");
  await expect(page.locator("#recipe-line-list")).toContainText("200 g");

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-ingredients");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("ingredients", "readwrite");
      const store = tx.objectStore("ingredients");
      const read = store.get(["local:business-old", "business-old", "ingredient-1"]);
      read.onsuccess = () => store.put({ ...read.result, name: "Legacy Basil updated by old tab", updatedAt: "2026-10-12T00:01:00.000Z" });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
  await page.reload();
  await expect(page.locator("#ingredient-list")).toContainText("Legacy Basil updated by old tab");

  const queued = await page.evaluate(async () => {
    const profileDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-local");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const profile = await new Promise((resolve, reject) => {
      const tx = profileDb.transaction("profiles", "readonly");
      const request = tx.objectStore("profiles").get("profile-1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => profileDb.close();
    });
    const module = await import("/src/ingredient-store.js");
    const scope = { ownerId: "local:" + profile.id, businessId: profile.id };
    await module.saveIngredient(scope, { id: "ingredient-1", name: "New app edit" });
    const first = await module.listIngredients(scope);
    await module.saveIngredient(scope, { id: "ingredient-1", name: "New app edit v2" });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const operations = await new Promise((resolve, reject) => {
      const tx = db.transaction("operations", "readonly");
      const request = tx.objectStore("operations").index("byOwnerBusinessEntityRecord").getAll([scope.ownerId, scope.businessId, "ingredient", "ingredient-1"]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    return { first: first[0], operations };
  });
  expect(queued.first.name).toBe("New app edit v2");
  expect(queued.operations).toHaveLength(1);
  expect(queued.operations[0]).toMatchObject({ operation: "create", state: "pending", baseRevision: null });
  expect(queued.operations[0].payload.name).toBe("New app edit v2");
  const operationId = queued.operations[0].operationId;

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-ingredients");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("ingredients", "readwrite");
      const store = tx.objectStore("ingredients");
      const read = store.get(["local:business-old", "business-old", "ingredient-1"]);
      read.onsuccess = () => store.put({ ...read.result, name: "Legacy concurrent edit", updatedAt: "2026-10-12T00:02:00.000Z" });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator("#ingredient-state")).toContainText("Both the legacy and shared Phase 2 record changed independently");
  const preserved = await page.evaluate(async (operationId) => {
    const read = async (databaseName, storeName, key) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const row = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
      return row;
    };
    return {
      source: await read("kitchai-ingredients", "ingredients", ["local:business-old", "business-old", "ingredient-1"]),
      target: await read("kitchai-business-data", "ingredients", ["local:profile-1", "profile-1", "ingredient-1"]),
      operation: await read("kitchai-business-data", "operations", operationId),
    };
  }, operationId);
  expect(preserved.source.name).toBe("Legacy concurrent edit");
  expect(preserved.target.name).toBe("New app edit v2");
  expect(preserved.operation.payload.name).toBe("New app edit v2");
});
