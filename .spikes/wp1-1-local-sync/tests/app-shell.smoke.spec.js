import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";


test("populated IndexedDB v2 upgrades additively, failed legacy mapping retries, and reopens idempotently", async ({ page }) => {
  await page.goto("/");
  const first = await page.evaluate(async () => {
    const deleteDb = (name) => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("delete blocked: " + name));
    });
    const openDb = (name, version, upgrade) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("open blocked: " + name));
    });
    const requestResult = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const readAll = (db, storeName) => requestResult(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
    const owner = "owner-a";
    const business = "business-a";
    const ingredient = { id: "existing-ingredient", ownerId: owner, businessId: business, name: "Existing rice", status: "active" };
    await Promise.all(["kitchai-business-data", "kitchai-ingredients", "kitchai-local", "kitchai-sync"].map(deleteDb));
    const db = await openDb("kitchai-business-data", 2, (database) => {
      const define = (name, keyPath, indexes = []) => {
        const store = database.createObjectStore(name, { keyPath });
        for (const [indexName, path] of indexes) store.createIndex(indexName, path, { unique: false });
      };
      define("ingredients", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]);
      define("menuItems", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]);
      define("recipes", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]]);
      define("recipeLines", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]]);
      define("operations", "operationId", [["byOwner", "ownerId"], ["byOwnerAndRecord", ["ownerId", "recordId"]], ["byOwnerBusinessEntityRecord", ["ownerId", "businessId", "entityType", "recordId"]], ["byOwnerAndState", ["ownerId", "state"]]]);
      define("syncMetadata", ["ownerId", "businessId", "entityType", "recordId"], [["byOwner", "ownerId"], ["byScope", ["ownerId", "businessId"]]]);
      define("metadata", "key");
      define("migrationLedger", ["sourceDatabase", "sourceStore", "sourceOwnerId", "sourceBusinessId", "sourceRecordId"]);
      define("conflicts", "conflictId", [["byOwnerBusiness", ["ownerId", "businessId"]], ["byOwnerState", ["ownerId", "state"]], ["byOwnerBusinessRecord", ["ownerId", "businessId", "entityType", "recordId"]]]);
    });
    const tx = db.transaction(["ingredients", "menuItems", "recipes", "recipeLines", "operations", "syncMetadata", "metadata", "migrationLedger", "conflicts"], "readwrite");
    tx.objectStore("ingredients").add(ingredient);
    tx.objectStore("menuItems").add({ id: "existing-menu", ownerId: owner, businessId: business, name: "Kimbap", status: "active" });
    tx.objectStore("recipes").add({ id: "existing-recipe", ownerId: owner, businessId: business, menuItemId: "existing-menu", name: "Basic", yieldPortions: 1, status: "active" });
    tx.objectStore("recipeLines").add({ id: "existing-line", ownerId: owner, businessId: business, recipeId: "existing-recipe", ingredientId: "existing-ingredient", quantity: 1.25, unit: "kg", position: 0 });
    tx.objectStore("operations").add({ operationId: "existing-operation", ownerId: owner, businessId: business, entityType: "ingredient", recordId: "existing-ingredient", state: "synced", createdAt: "2026-10-13T00:00:00.000Z", payload: {} });
    tx.objectStore("syncMetadata").add({ ownerId: owner, businessId: business, entityType: "ingredient", recordId: "existing-ingredient", revision: 4, lastSyncedSnapshot: { name: "Existing rice" } });
    tx.objectStore("metadata").add({ key: "keep-me", value: { marker: "metadata-survives" } });
    tx.objectStore("migrationLedger").add({ sourceDatabase: "old-source", sourceStore: "ingredients", sourceOwnerId: "old-owner", sourceBusinessId: "old-business", sourceRecordId: "old-record", targetKey: [owner, business, ingredient.id], sourceSnapshot: { id: "old-record" }, targetSnapshot: ingredient, needsOutbox: false });
    tx.objectStore("conflicts").add({ conflictId: "conflict-existing", ownerId: owner, businessId: business, entityType: "ingredient", recordId: ingredient.id, state: "open", baseSnapshot: { name: "Base" }, localSnapshot: { name: "Local" }, remoteSnapshot: { name: "Remote" } });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    db.close();

    const legacy = await openDb("kitchai-ingredients", 1, (database) => database.createObjectStore("ingredients", { keyPath: "id" }));
    const legacyRow = { id: "legacy-ingredient", ownerId: "local:profile-1", businessId: "profile-1", name: "Legacy sesame", status: "active" };
    const legacyTx = legacy.transaction("ingredients", "readwrite");
    legacyTx.objectStore("ingredients").add(legacyRow);
    await new Promise((resolve, reject) => { legacyTx.oncomplete = resolve; legacyTx.onerror = () => reject(legacyTx.error); });

    const module = await import("/src/business-data-store.js");
    let firstError = "";
    try { await module.openBusinessDatabase(); } catch (error) { firstError = String(error.message || error); }
    const upgraded = await openDb("kitchai-business-data", 8, () => {});
    const upgradedNames = [...upgraded.objectStoreNames].sort();
    upgraded.close();
    const local = await openDb("kitchai-local", 1, (database) => database.createObjectStore("profiles", { keyPath: "id" }));
    const profileTx = local.transaction("profiles", "readwrite");
    profileTx.objectStore("profiles").put({ id: "profile-1", businessId: "profile-1", name: "Test Kitchen" });
    await new Promise((resolve, reject) => { profileTx.oncomplete = resolve; profileTx.onerror = () => reject(profileTx.error); });
    local.close();

    const opened = await module.openBusinessDatabase();
    const storeNames = [...opened.objectStoreNames].sort();
    const counts = {};
    for (const name of ["ingredients", "menuItems", "recipes", "recipeLines", "operations", "syncMetadata", "metadata", "migrationLedger", "conflicts", "stockMovements", "finishedLots", "inventoryCommands", "stockMovementLotAllocations", "productionBatches", "finishedLotHandlingEvents", "finishedStockSnapshots", "finishedStockCommands", "purchases", "stockCountSessions", "stockCountLines"]) {
      counts[name] = (await readAll(opened, name)).length;
    }
    const existingIngredient = (await readAll(opened, "ingredients")).find((row) => row.id === "existing-ingredient");
    const importedLegacy = (await readAll(opened, "ingredients")).find((row) => row.id === "legacy-ingredient");
    const recipeLine = (await readAll(opened, "recipeLines"))[0];
    const existingConflict = (await readAll(opened, "conflicts"))[0];
    const ledgerRows = await readAll(opened, "migrationLedger");
    const legacyRows = await readAll(legacy, "ingredients");
    const indexes = Object.fromEntries(["ingredients", "menuItems", "recipes", "recipeLines", "operations", "syncMetadata", "conflicts"].map((name) => [name, [...opened.transaction(name, "readonly").objectStore(name).indexNames].sort()]));
    opened.close();
    legacy.close();
    return {
      firstError, upgradedNames, storeNames, counts, existingIngredient, importedLegacy, recipeLine,
      existingConflict, ledgerRows, legacyRows, indexes,
    };
  });
  expect(first.firstError).toContain("Could not safely map a local Phase 2 record");
  expect(first.upgradedNames).toContain("stockMovements");
  expect(first.upgradedNames).toContain("productionBatches");
  expect(first.upgradedNames).toContain("finishedLotHandlingEvents");
  expect(first.upgradedNames).toContain("finishedStockSnapshots");
  expect(first.upgradedNames).toContain("finishedStockCommands");
  expect(first.upgradedNames).toContain("purchases");
  expect(first.upgradedNames).toContain("stockCountSessions");
  expect(first.upgradedNames).toContain("stockCountLines");
  expect(first.storeNames).toContain("inventoryCommands");
  expect(first.storeNames).toContain("stockMovementLotAllocations");
  expect(first.storeNames).toContain("productionBatches");
  expect(first.storeNames).toContain("finishedLotHandlingEvents");
  expect(first.storeNames).toContain("finishedStockSnapshots");
  expect(first.storeNames).toContain("finishedStockCommands");
  expect(first.storeNames).toContain("purchases");
  expect(first.storeNames).toContain("stockCountSessions");
  expect(first.storeNames).toContain("stockCountLines");
  expect(first.counts.ingredients).toBe(2);
  expect(first.counts.menuItems).toBe(1);
  expect(first.counts.recipes).toBe(1);
  expect(first.counts.recipeLines).toBe(1);
  expect(first.counts.syncMetadata).toBe(1);
  expect(first.counts.metadata).toBeGreaterThanOrEqual(2);
  expect(first.counts.conflicts).toBe(1);
  expect(first.counts.stockMovements).toBe(0);
  expect(first.counts.finishedLots).toBe(0);
  expect(first.counts.inventoryCommands).toBe(0);
  expect(first.counts.stockMovementLotAllocations).toBe(0);
  expect(first.counts.productionBatches).toBe(0);
  expect(first.counts.finishedLotHandlingEvents).toBe(0);
  expect(first.counts.finishedStockSnapshots).toBe(0);
  expect(first.counts.finishedStockCommands).toBe(0);
  expect(first.counts.purchases).toBe(0);
  expect(first.existingIngredient.name).toBe("Existing rice");
  expect(first.importedLegacy.ownerId).toBe("local:profile-1");
  expect(first.importedLegacy.businessId).toBe("profile-1");
  expect(first.recipeLine.quantity).toBe(1.25);
  expect(first.existingConflict.remoteSnapshot.name).toBe("Remote");
  expect(first.ledgerRows.some((row) => row.sourceRecordId === "old-record")).toBe(true);
  expect(first.ledgerRows.find((row) => row.sourceRecordId === "legacy-ingredient").needsOutbox).toBe(false);
  expect(first.legacyRows).toHaveLength(1);
  expect(first.legacyRows[0].name).toBe("Legacy sesame");
  expect(first.indexes.ingredients).toContain("byScope");
  expect(first.indexes.recipes).toContain("byScopeMenuItem");
  expect(first.indexes.recipeLines).toContain("byRecipePosition");
  expect(first.indexes.operations).toContain("byOwnerBusinessEntityRecord");
  expect(first.indexes.syncMetadata).toContain("byScope");
  expect(first.indexes.conflicts).toContain("byOwnerBusinessRecord");

  await page.reload();
  const reopened = await page.evaluate(async () => {
    const module = await import("/src/business-data-store.js");
    const db = await module.openBusinessDatabase();
    const readAll = (name) => new Promise((resolve, reject) => {
      const request = db.transaction(name, "readonly").objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [ingredients, operations, ledger, legacyRows] = await Promise.all([
      readAll("ingredients"), readAll("operations"), readAll("migrationLedger"),
      new Promise((resolve, reject) => {
        const request = indexedDB.open("kitchai-ingredients");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const read = request.result.transaction("ingredients", "readonly").objectStore("ingredients").getAll();
          read.onsuccess = () => { resolve(read.result); request.result.close(); };
          read.onerror = () => reject(read.error);
        };
      }),
    ]);
    db.close();
    return { ingredients, operations, ledger, legacyRows };
  });
  expect(reopened.ingredients.filter((row) => row.id === "legacy-ingredient")).toHaveLength(1);
  expect(reopened.operations.filter((row) => row.entityType === "ingredient" && row.recordId === "legacy-ingredient")).toHaveLength(1);
  expect(reopened.ledger.filter((row) => row.sourceRecordId === "legacy-ingredient")).toHaveLength(1);
  expect(reopened.legacyRows).toHaveLength(1);
});

test("new UI shell is responsive and reports online/offline state", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Online");
  await page.setViewportSize({ width: 1365, height: 900 });
  const desktop = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(desktop.content).toBeLessThanOrEqual(desktop.width);
  await page.setViewportSize({ width: 320, height: 720 });
  const mobile = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(mobile.content).toBeLessThanOrEqual(mobile.width);
  await context.setOffline(true);
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await context.setOffline(false);
  await expect(page.locator("#connection-status")).toContainText("Online");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});

test("capture desktop and mobile UI previews for review", async ({ page }) => {
  await mkdir("artifacts", { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.screenshot({ path: "artifacts/kitchai-ui-preview-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
  await page.screenshot({ path: "artifacts/kitchai-ui-preview-mobile.png", fullPage: true });

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.locator('[data-mode="manage"]').click();
  for (const [pageId, title, filename] of [
    ["dashboard", "Dashboard", "dashboard"],
    ["menu", "Menu", "menu"],
    ["ingredients", "Ingredients", "ingredients"],
  ]) {
    await page.locator('#sidebar-content [data-page="' + pageId + '"]').click({ force: true });
    const pageCopy = page.locator("#page-content .main-page-copy");
    await expect(pageCopy.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(pageCopy.locator("p")).toBeVisible();
    if (pageId === "dashboard") {
      await expect(pageCopy.getByRole("button", { name: /Choose date filter/ })).toBeVisible();
    } else {
      await expect(pageCopy.locator("button, input, select, textarea, .ui-card")).toHaveCount(0);
    }
    await page.screenshot({ path: "artifacts/kitchai-ui-preview-" + filename + ".png", fullPage: true });
  }
});

test("service worker keeps the new UI shell navigable while offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await context.setOffline(false);
});

test("install prompt handler reveals the button and calls the browser prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#install-button")).toBeHidden();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => { window.__installPromptCalled = true; };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await expect(page.locator("#install-button")).toBeVisible();
  await page.locator("#install-button").click();
  await expect.poll(() => page.evaluate(() => window.__installPromptCalled === true)).toBe(true);
  await expect(page.locator("#install-button")).toBeHidden();
});

test("local business profile creates, trims, updates, and survives reload", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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


test("keyboard skip link and mode controls have accessible names", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page.getByRole("button", { name: /AI Mode/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Manage Mode/ })).toBeVisible();
  await expect(page.getByRole("status").first()).toBeVisible();
});

test("large text at narrow viewport does not introduce horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
});

test("local ingredient catalog creates, edits, archives, reloads, and stays in its business partition", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
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

  const initialOutbox = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const operations = await new Promise((resolve, reject) => {
      const tx = db.transaction("operations", "readonly");
      const request = tx.objectStore("operations").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    return operations;
  });
  expect(initialOutbox).toHaveLength(4);
  const initialByRecord = Object.fromEntries(initialOutbox.map((operation) => [operation.recordId, operation]));
  expect(initialByRecord["ingredient-1"]).toMatchObject({ entityType: "ingredient", operation: "create", state: "pending" });
  expect(initialByRecord["menu-1"]).toMatchObject({ entityType: "menuItem", operation: "create", state: "pending" });
  expect(initialByRecord["recipe-1"]).toMatchObject({ entityType: "recipe", operation: "create", state: "blocked_dependency" });
  expect(initialByRecord["line-1"]).toMatchObject({ entityType: "recipeLine", operation: "create", state: "blocked_dependency" });
  expect(initialByRecord["recipe-1"].dependsOnOperationIds).toContain(initialByRecord["menu-1"].operationId);
  expect(initialByRecord["line-1"].dependsOnOperationIds).toEqual(expect.arrayContaining([
    initialByRecord["recipe-1"].operationId,
    initialByRecord["ingredient-1"].operationId,
  ]));

  await page.reload();
  const restartedOutboxCount = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction("operations", "readonly");
      const request = tx.objectStore("operations").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    return count;
  });
  expect(restartedOutboxCount).toBe(4);

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
    const latest = await module.listIngredients(scope);
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
    return { first: first[0], latest: latest[0], operations };
  });
  expect(queued.first.name).toBe("New app edit");
  expect(queued.latest.name).toBe("New app edit v2");
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


test("WP2.5b blocks recipe and recipe-line outbox operations behind unsynced parent records", async ({ page }) => {
  await page.goto("/favicon.svg");
  const result = await page.evaluate(async () => {
    const modulePaths = [
      "kitchai-business-data", "kitchai-ingredients", "kitchai-menu",
      "kitchai-recipes", "kitchai-local", "kitchai-sync",
    ];
    for (const name of modulePaths) {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Could not clear isolated test database " + name));
      });
    }
    const scope = { ownerId: "local:dependency-profile", businessId: "dependency-profile" };
    const menuStore = await import("/src/menu-item-store.js");
    const ingredientStore = await import("/src/ingredient-store.js");
    const recipeStore = await import("/src/recipe-store.js");
    const menu = await menuStore.saveMenuItem(scope, { name: "Dependency Test Soup" });
    const ingredient = await ingredientStore.saveIngredient(scope, { name: "Dependency Test Rice" });
    const recipe = await recipeStore.saveRecipe(scope, { menuItemId: menu.id, name: "Dependency Test Recipe" });
    const line = await recipeStore.saveRecipeLine(scope, {
      recipeId: recipe.id, ingredientId: ingredient.id, quantity: 1, unit: "g", position: 0,
    });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const operations = await new Promise((resolve, reject) => {
      const tx = db.transaction("operations", "readonly");
      const request = tx.objectStore("operations").index("byOwner").getAll(scope.ownerId);
      request.onsuccess = () => resolve(request.result.filter((operation) => operation.businessId === scope.businessId));
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    return { menu, ingredient, recipe, line, operations };
  });
  const operationFor = (entityType, recordId) => result.operations.find((operation) => operation.entityType === entityType && operation.recordId === recordId);
  const menuOperation = operationFor("menuItem", result.menu.id);
  const ingredientOperation = operationFor("ingredient", result.ingredient.id);
  const recipeOperation = operationFor("recipe", result.recipe.id);
  const lineOperation = operationFor("recipeLine", result.line.id);
  expect(menuOperation.state).toBe("pending");
  expect(ingredientOperation.state).toBe("pending");
  expect(recipeOperation.state).toBe("blocked_dependency");
  expect(recipeOperation.dependsOnOperationIds).toContain(menuOperation.operationId);
  expect(lineOperation.state).toBe("blocked_dependency");
  expect(lineOperation.dependsOnOperationIds).toContain(recipeOperation.operationId);
  expect(lineOperation.dependsOnOperationIds).toContain(ingredientOperation.operationId);
});


test("WP2.5b rolls back a failed migration transaction and retries safely after restart", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
  await page.goto("/favicon.svg");
  await page.evaluate(async () => {
    const deleteDatabase = (name) => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Could not clear disposable test database " + name));
    });
    for (const name of ["kitchai-business-data", "kitchai-ingredients", "kitchai-menu", "kitchai-recipes", "kitchai-local", "kitchai-sync"]) {
      await deleteDatabase(name);
    }
    const stamp = "2026-10-12T00:00:00.000Z";
    const seed = (name, definitions) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const [storeName, definition] of Object.entries(definitions)) {
          const store = request.result.createObjectStore(storeName, { keyPath: definition.keyPath });
          for (const [indexName, keyPath] of definition.indexes ?? []) store.createIndex(indexName, keyPath, { unique: false });
          for (const row of definition.rows ?? []) store.put(row);
        }
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    const scope = { ownerId: "local:old-business", businessId: "old-business" };
    await seed("kitchai-local", {
      profiles: { keyPath: "id", rows: [{ id: "profile-retry", businessId: "old-business", name: "Retry Kitchen", createdAt: stamp, updatedAt: stamp }] },
      metadata: { keyPath: "key", rows: [{ key: "businessId", value: "old-business" }] },
    });
    await seed("kitchai-ingredients", {
      ingredients: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [
        { ...scope, id: "ingredient-a", name: "First imported ingredient", status: "active", createdAt: stamp, updatedAt: stamp },
        { ...scope, id: "ingredient-z", name: "Legacy ingredient", status: "active", createdAt: stamp, updatedAt: stamp },
      ] },
    });
    await seed("kitchai-menu", { menuItems: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [] } });
    await seed("kitchai-recipes", {
      recipes: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]], rows: [] },
      recipeLines: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]], rows: [] },
    });
    await seed("kitchai-business-data", {
      ingredients: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [
        { ownerId: "local:profile-retry", businessId: "profile-retry", id: "ingredient-z", name: "Independent target edit", status: "active", createdAt: stamp, updatedAt: stamp },
      ] },
      menuItems: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]]], rows: [] },
      recipes: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]], rows: [] },
      recipeLines: { keyPath: ["ownerId", "businessId", "id"], indexes: [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]], rows: [] },
      operations: { keyPath: "operationId", indexes: [["byOwner", "ownerId"], ["byOwnerAndRecord", ["ownerId", "recordId"]], ["byOwnerBusinessEntityRecord", ["ownerId", "businessId", "entityType", "recordId"]], ["byOwnerAndState", ["ownerId", "state"]]], rows: [] },
      syncMetadata: { keyPath: ["ownerId", "businessId", "entityType", "recordId"], indexes: [["byOwner", "ownerId"], ["byScope", ["ownerId", "businessId"]]], rows: [] },
      metadata: { keyPath: "key", rows: [] },
      migrationLedger: { keyPath: ["sourceDatabase", "sourceStore", "sourceOwnerId", "sourceBusinessId", "sourceRecordId"], rows: [] },
    });
  });

  await page.goto("/");
  await expect(page.locator("#ingredient-state")).toContainText("Migration collision");
  const failedAttempt = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(["ingredients", "migrationLedger", "metadata"], "readonly");
      const ingredients = tx.objectStore("ingredients");
      const first = ingredients.get(["local:profile-retry", "profile-retry", "ingredient-a"]);
      const collision = ingredients.get(["local:profile-retry", "profile-retry", "ingredient-z"]);
      const marker = tx.objectStore("metadata").get("legacy-phase2-entities-v1");
      const ledger = tx.objectStore("migrationLedger").get(["kitchai-ingredients", "ingredients", "local:old-business", "old-business", "ingredient-a"]);
      const result = {};
      first.onsuccess = () => { result.first = first.result; };
      collision.onsuccess = () => { result.collision = collision.result; };
      marker.onsuccess = () => { result.marker = marker.result; };
      ledger.onsuccess = () => { result.ledger = ledger.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => reject(tx.error);
    });
    return result;
  });
  expect(failedAttempt.first).toBeUndefined();
  expect(failedAttempt.collision.name).toBe("Independent target edit");
  expect(failedAttempt.marker).toBeUndefined();
  expect(failedAttempt.ledger).toBeUndefined();

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("ingredients", "readwrite");
      tx.objectStore("ingredients").delete(["local:profile-retry", "profile-retry", "ingredient-z"]);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();
  await expect(page.locator("#ingredient-list")).toContainText("First imported ingredient");
  await expect(page.locator("#ingredient-list")).toContainText("Legacy ingredient");
  const recovered = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kitchai-business-data");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(["ingredients", "migrationLedger", "metadata"], "readonly");
      const rows = tx.objectStore("ingredients").index("byScope").getAll(["local:profile-retry", "profile-retry"]);
      const marker = tx.objectStore("metadata").get("legacy-phase2-entities-v1");
      const ledger = tx.objectStore("migrationLedger").get(["kitchai-ingredients", "ingredients", "local:old-business", "old-business", "ingredient-a"]);
      const value = {};
      rows.onsuccess = () => { value.rows = rows.result; };
      marker.onsuccess = () => { value.marker = marker.result; };
      ledger.onsuccess = () => { value.ledger = ledger.result; };
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = () => reject(tx.error);
    });
    return result;
  });
  expect(recovered.rows.map((row) => row.name).sort()).toEqual(["First imported ingredient", "Legacy ingredient"]);
  expect(recovered.marker).toBeTruthy();
  expect(recovered.ledger).toBeTruthy();
});


test("production batch usage, preparation, cancellation, and business scoping persist in IndexedDB", async ({ page }) => {
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const { openBusinessDatabase } = await import("/src/business-data-store.js");
    const {
      startProductionBatch,
      getProductionBatch,
      recordProductionBatchActualUsage,
      prepareProductionBatchForPosting,
      cancelProductionBatch,
    } = await import("/src/production-batch-store.js");
    const ownerId = "wp3-3-2-owner-" + crypto.randomUUID();
    const businessId = "wp3-3-2-business-" + crypto.randomUUID();
    const recipeId = "wp3-3-2-recipe-" + crypto.randomUUID();
    const scope = { ownerId, businessId };
    const db = await openBusinessDatabase();
    const transaction = db.transaction(["recipes", "recipeLines"], "readwrite");
    transaction.objectStore("recipes").put({
      ownerId, businessId, id: recipeId, menuItemId: "menu-rice",
      name: "Lifecycle test rice", instructions: "Cook", yieldPortions: 4, status: "active",
    });
    transaction.objectStore("recipeLines").put({
      ownerId, businessId, id: "rice-line-" + recipeId, recipeId,
      ingredientId: "rice", quantity: 1, quantityMode: "exact", unit: "kg", position: 0, note: "",
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Seed transaction aborted"));
    });

    const batch = await startProductionBatch(scope, recipeId);
    const lineId = batch.snapshot.lines[0].lineId;
    const usage = [{ lineId, disposition: "measured", quantity: "1", unit: "kg" }];
    await recordProductionBatchActualUsage(scope, batch.batchId, usage);
    const afterUsage = await getProductionBatch(scope, batch.batchId);
    const usageEvent = afterUsage.events.find((event) => event.type === "actual_usage_recorded");
    const prepared = await prepareProductionBatchForPosting(scope, batch.batchId, {
      productId: "menu-rice", quantity: "4", unit: "each",
    });
    let rejectsPostEdit = false;
    try {
      await recordProductionBatchActualUsage(scope, batch.batchId, usage);
    } catch {
      rejectsPostEdit = true;
    }
    const hiddenFromOtherBusiness = await getProductionBatch(
      { ownerId, businessId: businessId + "-other" }, batch.batchId,
    );

    const cancelled = await startProductionBatch(scope, recipeId);
    await cancelProductionBatch(scope, cancelled.batchId, "Kitchen closed early");
    let rejectsCancelledPrepare = false;
    try {
      await prepareProductionBatchForPosting(scope, cancelled.batchId, {
        productId: "menu-rice", quantity: "4", unit: "each",
      });
    } catch {
      rejectsCancelledPrepare = true;
    }
    const cancelledStored = await getProductionBatch(scope, cancelled.batchId);
    db.close();
    return {
      started: batch.state,
      hasStartEvent: batch.events.some((event) => event.type === "started"),
      actualUsagePersisted: afterUsage.actualUsage[0]?.quantity === "1",
      usageRevisionPreserved: usageEvent?.actualUsage?.[0]?.quantity === "1",
      preparedState: prepared.state,
      outputPersisted: prepared.output?.quantity === "4",
      rejectsPostEdit,
      hiddenFromOtherBusiness: hiddenFromOtherBusiness === null,
      cancelledState: cancelledStored.state,
      rejectsCancelledPrepare,
    };
  });

  expect(evidence).toEqual({
    started: "started",
    hasStartEvent: true,
    actualUsagePersisted: true,
    usageRevisionPreserved: true,
    preparedState: "ready_to_post",
    outputPersisted: true,
    rejectsPostEdit: true,
    hiddenFromOtherBusiness: true,
    cancelledState: "cancelled",
    rejectsCancelledPrepare: true,
  });
});


test("production posting retries the exact persisted command and only completes after RPC acceptance", async ({ page }) => {
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const { openBusinessDatabase } = await import("/src/business-data-store.js");
    const {
      startProductionBatch,
      getProductionBatch,
      recordProductionBatchActualUsage,
      prepareProductionBatchForPosting,
      postProductionBatch,
    } = await import("/src/production-batch-store.js");
    const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const businessId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const remoteBusinessId = "99999999-9999-4999-8999-999999999999";
    const recipeId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const ingredientId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const scope = { ownerId, businessId };
    const db = await openBusinessDatabase();
    const tx = db.transaction(["recipes", "recipeLines"], "readwrite");
    tx.objectStore("recipes").put({
      ownerId, businessId, id: recipeId, menuItemId,
      name: "Posting retry test", instructions: "Cook", yieldPortions: 2, status: "active",
    });
    tx.objectStore("recipeLines").put({
      ownerId, businessId, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", recipeId,
      ingredientId, quantity: 1, quantityMode: "exact", unit: "kg", position: 0, note: "",
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Seed transaction aborted"));
    });
    const batch = await startProductionBatch(scope, recipeId);
    await recordProductionBatchActualUsage(scope, batch.batchId, [{
      lineId: batch.snapshot.lines[0].lineId, disposition: "measured", quantity: "1", unit: "kg",
    }]);
    await prepareProductionBatchForPosting(scope, batch.batchId, {
      productId: menuItemId, quantity: "2", unit: "each",
    });

    globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://kitchai-test.supabase.co", supabaseAnonKey: "test-anon" };
    const originalFetch = globalThis.fetch;
    const submittedBodies = [];
    let shouldFail = true;
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      submittedBodies.push(body);
      if (shouldFail) {
        shouldFail = false;
        throw new Error("Simulated offline interruption");
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: "accepted",
          commandId: body.p_command_id,
          movementCount: body.p_payload.movements.length,
          lotCount: body.p_payload.lots.length,
          allocationCount: body.p_payload.allocations.length,
          eventIds: body.p_payload.movements.map((movement) => movement.eventId),
        }),
      };
    };
    const session = { access_token: "owner-test-token", user: { id: ownerId } };
    let firstFailed = false;
    try {
      await postProductionBatch(scope, batch.batchId, session, remoteBusinessId);
    } catch {
      firstFailed = true;
    }
    const afterFailure = await getProductionBatch(scope, batch.batchId);
    const completed = await postProductionBatch(scope, batch.batchId, session, remoteBusinessId);
    const afterCompletedCallCount = submittedBodies.length;
    const duplicate = await postProductionBatch(scope, batch.batchId, session, remoteBusinessId);
    globalThis.fetch = originalFetch;
    delete globalThis.KITCHAI_CONFIG;
    db.close();
    return {
      firstFailed,
      failedState: afterFailure.state,
      savedCommandOnFailure: Boolean(afterFailure.posting?.command?.commandId),
      retryState: completed.state,
      retryStatus: completed.posting?.status,
      remoteBusinessIdUsed: submittedBodies[0]?.p_business_id === remoteBusinessId && submittedBodies[1]?.p_business_id === remoteBusinessId,
      sameCommandId: submittedBodies[0]?.p_command_id === submittedBodies[1]?.p_command_id,
      samePayload: JSON.stringify(submittedBodies[0]?.p_payload) === JSON.stringify(submittedBodies[1]?.p_payload),
      callCountAfterRetry: afterCompletedCallCount,
      duplicateReturnsCompleted: duplicate.state === "completed",
      duplicateDidNotCallServer: submittedBodies.length === 2,
      postedEventCount: duplicate.events.filter((event) => event.type === "production_posted").length,
    };
  });

  expect(evidence).toEqual({
    firstFailed: true,
    failedState: "failed_to_post",
    savedCommandOnFailure: true,
    retryState: "completed",
    retryStatus: "accepted",
    remoteBusinessIdUsed: true,
    sameCommandId: true,
    samePayload: true,
    callCountAfterRetry: 2,
    duplicateReturnsCompleted: true,
    duplicateDidNotCallServer: true,
    postedEventCount: 1,
  });
});

test("carry-forward decisions persist offline, sync idempotently, and keep local/server business IDs separate", async ({ page }) => {
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const { openBusinessDatabase } = await import("/src/business-data-store.js");
    const { saveCarryForwardDecision, listCarryForwardDecisions, syncCarryForwardDecision } =
      await import("/src/finished-stock-store.js");
    const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const localBusinessId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const remoteBusinessId = "99999999-9999-4999-8999-999999999999";
    const eventId = "55555555-5555-4555-8555-555555555555";
    const lotId = "66666666-6666-4666-8666-666666666666";
    const scope = { ownerId, businessId: localBusinessId };
    const decision = {
      eventId, businessId: remoteBusinessId, lotId, dispositionType: "carry_forward",
      quantity: "4", unit: "each", carryForwardDate: "2026-10-15",
      confirmedAt: "2026-10-14T17:00:00.000Z", reason: "Stored safely", inventoryEffect: "none",
    };
    const db = await openBusinessDatabase();
    const saved = await saveCarryForwardDecision(scope, decision);
    const beforeSync = await listCarryForwardDecisions(scope);
    globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://kitchai-test.supabase.co", supabaseAnonKey: "test-anon" };
    const originalFetch = globalThis.fetch;
    const requests = [];
    let failFirst = true;
    globalThis.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (failFirst) {
        failFirst = false;
        throw new Error("Simulated offline interruption");
      }
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          status: "accepted", eventId, businessId: remoteBusinessId, lotId,
          handlingType: "carry_forward", quantity: "4", unit: "each",
          carryForwardDate: "2026-10-15", inventoryEffect: "none",
        }),
      };
    };
    const session = { access_token: "owner-test-token", user: { id: ownerId } };
    let firstFailed = false;
    try { await syncCarryForwardDecision(scope, eventId, session); } catch { firstFailed = true; }
    const afterFailure = (await listCarryForwardDecisions(scope))[0];
    const synced = await syncCarryForwardDecision(scope, eventId, session);
    const callCountAfterSync = requests.length;
    const duplicate = await syncCarryForwardDecision(scope, eventId, session);
    globalThis.fetch = originalFetch;
    delete globalThis.KITCHAI_CONFIG;
    db.close();
    return {
      savedState: saved.state,
      savedLocalPartition: saved.businessId,
      savedRemoteBusinessId: saved.remoteBusinessId,
      visibleOfflineBeforeSync: beforeSync.length,
      firstFailed,
      failedState: afterFailure.state,
      retryCount: synced.syncAttempts,
      syncedState: synced.state,
      duplicateState: duplicate.state,
      sameEventId: requests.every((request) => request.body.p_event_id === eventId),
      serverBusinessIdUsed: requests.every((request) => request.body.p_business_id === remoteBusinessId),
      samePayload: JSON.stringify(requests[0]?.body) === JSON.stringify(requests[1]?.body),
      callCountAfterSync,
      duplicateDidNotCallServer: requests.length === 2,
      inventoryEffect: duplicate.serverResult?.inventoryEffect,
    };
  });
  expect(evidence).toEqual({
    savedState: "pending_sync",
    savedLocalPartition: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    savedRemoteBusinessId: "99999999-9999-4999-8999-999999999999",
    visibleOfflineBeforeSync: 1,
    firstFailed: true,
    failedState: "retryable_error",
    retryCount: 2,
    syncedState: "synced",
    duplicateState: "synced",
    sameEventId: true,
    serverBusinessIdUsed: true,
    samePayload: true,
    callCountAfterSync: 2,
    duplicateDidNotCallServer: true,
    inventoryEffect: "none",
  });
});


test("finished stock UI is accessible and disposition records persist in the local outbox", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Know what is still safe to sell." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh stock" })).toBeVisible();
  await expect(page.getByLabel("Disposition", { exact: true })).toBeVisible();
  const evidence = await page.evaluate(async () => {
    const { saveFinishedDisposition, listFinishedDispositions } = await import("/src/finished-stock-workflow-store.js");
    const scope = { ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", businessId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const command = {
      commandId: "77777777-7777-4777-8777-777777777777",
      businessId: "99999999-9999-4999-8999-999999999999",
      commandType: "stock_movement",
      payload: { movements: [{ eventId: "88888888-8888-4888-8888-888888888888" }], lots: [], allocations: [] },
    };
    const saved = await saveFinishedDisposition(scope, command, { dispositionType: "giveaway", quantity: "2", unit: "each" });
    const rows = await listFinishedDispositions(scope);
    return { state: saved.state, localBusinessId: saved.businessId, remoteBusinessId: saved.remoteBusinessId, count: rows.length, sameCommand: rows[0].command.commandId === command.commandId };
  });
  expect(evidence).toEqual({
    state: "pending_sync",
    localBusinessId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    remoteBusinessId: "99999999-9999-4999-8999-999999999999",
    count: 1,
    sameCommand: true,
  });
});


test("production batch UI captures actual usage and keeps offline posting state honest", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
  await page.goto("/");
  await page.locator("#business-name").fill("Production UI Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();

  await page.locator("#ingredient-name").fill("Rice");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Rice");

  await page.locator("#menu-item-name").fill("Rice Bowl");
  await page.getByRole("button", { name: "Add menu item" }).click();
  await expect(page.locator("#menu-item-list")).toContainText("Rice Bowl");

  await page.locator("#recipe-menu-item").selectOption({ label: "Rice Bowl" });
  await page.locator("#recipe-name").fill("Rice Bowl Recipe");
  await page.locator("#recipe-yield").fill("4");
  await page.locator("#recipe-status").selectOption("draft");
  await page.getByRole("button", { name: "Save recipe draft" }).click();
  await expect(page.locator("#recipe-list")).toContainText("Rice Bowl Recipe");

  await page.locator("#recipe-line-recipe").selectOption({ label: "Rice Bowl Recipe · Draft" });
  await page.locator("#recipe-line-ingredient").selectOption({ label: "Rice" });
  await page.locator("#recipe-line-quantity").fill("2");
  await page.locator("#recipe-line-unit").selectOption("kg");
  await page.getByRole("button", { name: "Add ingredient line" }).click();
  await expect(page.locator("#recipe-line-list")).toContainText("2 kg");

  await page.locator("#recipe-list").getByRole("button", { name: "Activate" }).click();
  await expect(page.locator("#recipe-list")).toContainText("Active");
  await page.locator("#production-recipe").selectOption({ label: "Rice Bowl Recipe" });
  await page.getByRole("button", { name: "Start production batch" }).click();
  const batch = page.locator(".production-batch-card").filter({ hasText: "Rice Bowl Recipe" });
  await expect(batch).toContainText("started");
  await batch.locator(".production-usage-line select").selectOption("measured");
  await batch.locator('.production-usage-line input[data-field="quantity"]').fill("2");
  await batch.locator('input[data-field="outputQuantity"]').fill("4");
  await batch.getByRole("button", { name: "Save usage and prepare batch" }).click();
  await expect(batch).toContainText("ready to post");
  await expect(batch.getByRole("button", { name: "Post batch" })).toBeDisabled();
  await expect(page.locator("#production-state")).toContainText("ready to post when you are online and signed in");
});


test("purchase drafts persist locally and do not change stock before server receipt acceptance", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
  await page.goto("/");
  await page.locator("#business-name").fill("Purchase Test Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Saved on this device");
  await page.locator("#ingredient-name").fill("Rice");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Rice");
  await page.getByRole("button", { name: "Refresh purchases" }).click();
  await page.locator('#purchase-line-entry-list select[data-field="ingredient"]').selectOption({ label: "Rice" });
  await page.locator('#purchase-line-entry-list input[data-field="quantity"]').fill("10");
  await page.locator('#purchase-line-entry-list select[data-field="unit"]').selectOption("kg");
  await page.locator('#purchase-line-entry-list input[data-field="unitPrice"]').fill("35.50");
  await page.locator("#purchase-supplier").fill("Morning Market");
  const formValidity = await page.locator("#purchase-create-form").evaluate(form => ({ valid: form.checkValidity(), invalid: [...form.querySelectorAll(":invalid")].map(element => ({ id: element.id || element.getAttribute("data-field"), value: element.value, message: element.validationMessage })) }));
  expect(formValidity).toEqual({ valid: true, invalid: [] });
  await page.getByRole("button", { name: "Save purchase draft" }).click();
  await expect(page.locator("#purchase-state")).toContainText("Purchase draft saved locally");
  await expect(page.locator("#purchase-list")).toContainText("Morning Market");
  await expect(page.locator("#purchase-list")).toContainText("ordered 10 kg");
  await expect(page.locator("#purchase-list")).toContainText("confirmed 0 kg");
  const queuedReceipt = await page.evaluate(async () => {
    const { readLocalProfile } = await import("/src/local-store.js");
    const { scopeForBusinessProfile } = await import("/src/business-data-store.js");
    const { listPurchases, recordPurchaseReceipt } = await import("/src/purchase-store.js");
    const profile = await readLocalProfile();
    const scope = scopeForBusinessProfile({ profileId: profile.id, local: true });
    const purchase = (await listPurchases(scope))[0];
    const receipt = await recordPurchaseReceipt(scope, purchase.purchaseId, [
      { lineId: purchase.lines[0].lineId, quantity: "3" },
    ], "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    return { receiptId: receipt.receipt.receiptId, commandId: receipt.receipt.command.commandId };
  });
  expect(queuedReceipt.commandId).toMatch(/^[0-9a-f-]{36}$/i);
  await page.getByRole("button", { name: "Refresh purchases" }).click();
  await expect(page.locator("#purchase-list")).toContainText("pending");
  await expect(page.locator("#purchase-list")).toContainText("pending/reserved 3 kg");
  await expect(page.locator("#purchase-list")).toContainText("confirmed 0 kg");
  await page.reload();
  await page.getByRole("button", { name: "Refresh purchases" }).click();
  await expect(page.locator("#purchase-list")).toContainText("Morning Market");
  await expect(page.locator("#purchase-list")).toContainText("confirmed 0 kg");
  await expect(page.locator("#purchase-list")).toContainText(queuedReceipt.receiptId);
  const afterReload = await page.evaluate(async () => {
    const { readLocalProfile } = await import("/src/local-store.js");
    const { scopeForBusinessProfile } = await import("/src/business-data-store.js");
    const { listPurchases } = await import("/src/purchase-store.js");
    const profile = await readLocalProfile();
    const scope = scopeForBusinessProfile({ profileId: profile.id, local: true });
    const purchase = (await listPurchases(scope))[0];
    return purchase.receipts[0].command.commandId;
  });
  expect(afterReload).toBe(queuedReceipt.commandId);
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width);
});


test("WP3.5c stock count drafts capture a server snapshot and persist exact offline review across reload", async ({ page }) => {
  test.skip(true, "Deferred while the frontend is rebuilt before backend/UI workflows are reintroduced.");
  await page.goto("/");
  const created = await page.evaluate(async () => {
    const scope = { ownerId: "11111111-1111-4111-8111-111111111111", businessId: "local-count-partition" };
    const remoteBusinessId = "22222222-2222-4222-8222-222222222222";
    const stockItemId = "33333333-3333-4333-8333-333333333333";
    const session = { access_token: "test-token", user: { id: scope.ownerId } };
    const originalFetch = window.fetch;
    const originalConfig = window.KITCHAI_CONFIG;
    window.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
    window.fetch = async (url, options) => {
      if (url !== "https://example.supabase.co/rest/v1/rpc/get_inventory_item_snapshot") throw new Error("Unexpected URL: " + url);
      const body = JSON.parse(options.body);
      if (body.p_business_id !== remoteBusinessId || body.p_stock_item_id !== stockItemId) throw new Error("Snapshot used a local or wrong item ID.");
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          status: "snapshot", stockClass: "ingredient", stockItemId,
          version: "7", systemQuantity: "4.25", unit: "kg",
        }),
      };
    };
    try {
      const store = await import("/src/stock-count-store.js");
      const countSession = await store.createStockCountSession(scope, remoteBusinessId, {
        sessionId: "44444444-4444-4444-8444-444444444444",
        createdAt: "2026-10-14T10:00:00.000Z",
      });
      const line = await store.addStockCountLine(scope, countSession.sessionId, {
        stockClass: "ingredient", stockItemId, stockItemName: "Rice", unit: "kg",
      }, session, { lineId: "55555555-5555-4555-8555-555555555555" });
      const counted = await store.enterStockCount(scope, countSession.sessionId, line.lineId, "3.5", "Measured with scale");
      const reviewed = await store.reviewStockCountLine(scope, countSession.sessionId, line.lineId, {
        reviewedBy: scope.ownerId, reviewedAt: "2026-10-14T10:05:00.000Z", reason: "Spillage found",
      });
      window.fetch = originalFetch;
      if (originalConfig === undefined) delete window.KITCHAI_CONFIG;
      else window.KITCHAI_CONFIG = originalConfig;
      return { sessionId: countSession.sessionId, lineId: line.lineId, version: line.version, counted: counted.countedQuantity, variance: counted.variance, state: reviewed.state };
    } finally {
      window.fetch = originalFetch;
      if (originalConfig === undefined) delete window.KITCHAI_CONFIG;
      else window.KITCHAI_CONFIG = originalConfig;
    }
  });
  expect(created.version).toBe("7");
  expect(created.counted).toBe("3.5");
  expect(created.variance).toBe("-0.75");
  expect(created.state).toBe("reviewed");
  await page.reload();
  const persisted = await page.evaluate(async ({ sessionId, lineId }) => {
    const store = await import("/src/stock-count-store.js");
    const scope = { ownerId: "11111111-1111-4111-8111-111111111111", businessId: "local-count-partition" };
    const sessions = await store.listStockCountSessions(scope);
    const lines = await store.listStockCountLines(scope, sessionId);
    return {
      session: sessions.find(item => item.sessionId === sessionId),
      line: lines.find(item => item.lineId === lineId),
    };
  }, created);
  expect(persisted.session).toBeTruthy();
  expect(persisted.session.remoteBusinessId).toBe("22222222-2222-4222-8222-222222222222");
  expect(persisted.line.version).toBe("7");
  expect(persisted.line.systemQuantity).toBe("4.25");
  expect(persisted.line.countedQuantity).toBe("3.5");
  expect(persisted.line.variance).toBe("-0.75");
  expect(persisted.line.reason).toBe("Spillage found");
  expect(persisted.line.state).toBe("reviewed");
});


test("WP3.5d freezes local count edits while a posting outcome is uncertain", async ({ page }) => {
  await page.goto("/");
  const outcome = await page.evaluate(async () => {
    const scope = { ownerId: "71111111-1111-4111-8111-111111111111", businessId: "local-pending-count-partition" };
    const remoteBusinessId = "72222222-2222-4222-8222-222222222222";
    const itemId = "73333333-3333-4333-8333-333333333333";
    const session = { access_token: "test-token", user: { id: scope.ownerId } };
    const originalFetch = window.fetch;
    const originalConfig = window.KITCHAI_CONFIG;
    window.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
    window.fetch = async (url) => {
      if (url.endsWith("/get_inventory_item_snapshot")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({
          status: "snapshot", stockClass: "ingredient", stockItemId: itemId,
          version: "0", systemQuantity: "1", unit: "kg",
        }) };
      }
      throw new TypeError("simulated network loss after command persistence");
    };
    try {
      const store = await import("/src/stock-count-store.js");
      const countSession = await store.createStockCountSession(scope, remoteBusinessId, {
        sessionId: "74444444-4444-4444-8444-444444444444",
      });
      const line = await store.addStockCountLine(scope, countSession.sessionId, {
        stockClass: "ingredient", stockItemId: itemId, stockItemName: "Rice", unit: "kg",
      }, session, { lineId: "75555555-5555-4555-8555-555555555555" });
      await store.enterStockCount(scope, countSession.sessionId, line.lineId, "2", "Initial count");
      await store.reviewStockCountLine(scope, countSession.sessionId, line.lineId, {
        reviewedBy: scope.ownerId, reviewedAt: "2026-10-14T10:05:00.000Z", reason: "Physical count",
      });
      let postError = "";
      try {
        await store.postReviewedStockCountSubset(scope, countSession.sessionId, [line.lineId], session);
      } catch (error) { postError = String(error?.message || error); }
      const attempts = await Promise.all([
        store.enterStockCount(scope, countSession.sessionId, line.lineId, "3", "Changed after uncertain post"),
        store.reviewStockCountLine(scope, countSession.sessionId, line.lineId, {
          reviewedBy: scope.ownerId, reviewedAt: "2026-10-14T10:06:00.000Z", reason: "Changed",
        }),
        store.addStockCountLine(scope, countSession.sessionId, {
          stockClass: "ingredient", stockItemId: "76666666-6666-4666-8666-666666666666",
          stockItemName: "Flour", unit: "kg",
        }, session),
        store.cancelStockCountSession(scope, countSession.sessionId),
        store.refreshStaleStockCountLine(scope, countSession.sessionId, line.lineId, session),
      ].map(promise => promise.then(() => false, () => true)));
      const saved = await store.listStockCountLines(scope, countSession.sessionId);
      return { postError, attempts, savedQuantity: saved[0].countedQuantity, savedState: saved[0].state };
    } finally {
      window.fetch = originalFetch;
      if (originalConfig === undefined) delete window.KITCHAI_CONFIG;
      else window.KITCHAI_CONFIG = originalConfig;
    }
  });
  expect(outcome.postError).toContain("simulated network loss");
  expect(outcome.attempts).toEqual([true, true, true, true, true]);
  expect(outcome.savedQuantity).toBe("2");
  expect(outcome.savedState).toBe("reviewed");
});



test("WP3.5d serializes cancellation against persisting a pending post command", async ({ page }) => {
  await page.goto("/");
  const outcome = await page.evaluate(async () => {
    const scope = { ownerId: "71111111-1111-4111-8111-111111111111", businessId: "local-cancel-post-race" };
    const remoteBusinessId = "72222222-2222-4222-8222-222222222222";
    const itemId = "73333333-3333-4333-8333-333333333333";
    const session = { access_token: "test-token", user: { id: scope.ownerId } };
    const originalFetch = window.fetch;
    const originalConfig = window.KITCHAI_CONFIG;
    let postCalls = 0;
    window.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
    window.fetch = async (url) => {
      if (url.endsWith("/get_inventory_item_snapshot")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({
          status: "snapshot", stockClass: "ingredient", stockItemId: itemId,
          version: "0", systemQuantity: "1", unit: "kg",
        }) };
      }
      postCalls += 1;
      throw new TypeError("simulated network loss after command persistence");
    };
    try {
      const store = await import("/src/stock-count-store.js");
      const countSession = await store.createStockCountSession(scope, remoteBusinessId, {
        sessionId: "74444444-4444-4444-8444-444444444444",
      });
      const line = await store.addStockCountLine(scope, countSession.sessionId, {
        stockClass: "ingredient", stockItemId: itemId, stockItemName: "Rice", unit: "kg",
      }, session, { lineId: "75555555-5555-4555-8555-555555555555" });
      await store.enterStockCount(scope, countSession.sessionId, line.lineId, "2", "Initial count");
      await store.reviewStockCountLine(scope, countSession.sessionId, line.lineId, {
        reviewedBy: scope.ownerId, reviewedAt: "2026-10-14T10:05:00.000Z", reason: "Physical count",
      });
      const [postResult, cancelResult] = await Promise.allSettled([
        store.postReviewedStockCountSubset(scope, countSession.sessionId, [line.lineId], session),
        store.cancelStockCountSession(scope, countSession.sessionId),
      ]);
      const saved = (await store.listStockCountSessions(scope)).find(item => item.sessionId === countSession.sessionId);
      return {
        postFulfilled: postResult.status === "fulfilled",
        postError: postResult.status === "rejected" ? String(postResult.reason?.message || postResult.reason) : "",
        cancelFulfilled: cancelResult.status === "fulfilled",
        cancelError: cancelResult.status === "rejected" ? String(cancelResult.reason?.message || cancelResult.reason) : "",
        status: saved.status,
        pendingPost: Boolean(saved.pendingPost),
        postCalls,
      };
    } finally {
      window.fetch = originalFetch;
      if (originalConfig === undefined) delete window.KITCHAI_CONFIG;
      else window.KITCHAI_CONFIG = originalConfig;
    }
  });
  expect(outcome.postFulfilled).toBe(false);
  expect(outcome.cancelFulfilled || outcome.pendingPost).toBe(true);
  expect(outcome.cancelFulfilled && outcome.pendingPost).toBe(false);
  if (outcome.cancelFulfilled) {
    expect(outcome.status).toBe("cancelled");
    expect(outcome.pendingPost).toBe(false);
    expect(outcome.postCalls).toBe(0);
  } else {
    expect(outcome.cancelError).toContain("outcome may be uncertain");
    expect(outcome.status).not.toBe("cancelled");
    expect(outcome.pendingPost).toBe(true);
    expect(outcome.postCalls).toBe(1);
  }
});
