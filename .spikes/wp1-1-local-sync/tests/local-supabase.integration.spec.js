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
  // Inventory movement units must match the purchased stock unit; automatic conversion is not enabled.
  await page.locator("#recipe-line-quantity").fill("0.25");
  await page.locator("#recipe-line-unit").selectOption("kg");
  await page.locator("#recipe-line-position").fill("0");
  await page.locator("#recipe-line-note").fill("Integration test line");
  await page.getByRole("button", { name: "Add ingredient line" }).click();
  await expect(page.locator("#recipe-line-list")).toContainText("0.25 kg");

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
  await expect(page.locator("#recipe-line-list")).toContainText("0.25 kg");
});

test("Phase 2 ingredient conflicts preserve both candidates and support explicit remote/local resolution", async ({ page, context, browser }) => {
  await createAccount(page);
  await page.locator("#business-name").fill("Phase Two Conflict Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 15000 });

  await page.locator("#ingredient-name").fill("Conflict Test Ingredient");
  await page.locator("#ingredient-description").fill("Initial synced value");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  const ingredientRow = page.locator("#ingredient-list li").filter({ hasText: "Conflict Test Ingredient" });
  await expect(ingredientRow).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.filter(item => item.entityType === "ingredient").map(item => item.state);
  }), { timeout: 15000 }).toEqual(["synced"]);

  async function queueLocalEdit(name, rowPattern) {
    await context.setOffline(true);
    const row = page.locator("#ingredient-list li").filter({ hasText: new RegExp(rowPattern) }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator("#ingredient-name").fill(name);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("#ingredient-list")).toContainText(name);
    return await page.evaluate(async () => {
      const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
      const sync = await import("/src/phase2-sync-engine.js");
      const profiles = await import("/src/sync-store.js");
      const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
      const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
      const operation = operations.filter(item => item.entityType === "ingredient" && item.operation === "update" && ["pending", "retryable_error"].includes(item.state)).at(-1);
      if (!operation) throw new Error("Expected a pending offline ingredient update.");
      return operation;
    });
  }

  // Keep the app context offline while a separate online browser context
  // simulates a concurrent remote writer. Browser-context offline mode also
  // blocks fetch(), so issuing the competing write from the offline page fails
  // before it can reach the local Supabase RPC.
  const remotePage = await browser.newPage();
  await remotePage.goto(new URL("/", page.url()).href);

  async function createRemoteWinner(operation, name) {
    const auth = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kitchai.auth.session")));
    const result = await remotePage.evaluate(async ({ operation, name, auth }) => {
      const sync = await import("/src/phase2-sync-engine.js");
      return sync.sendPhase2EntityOperation({
        ...operation,
        operationId: crypto.randomUUID(),
        payload: { ...operation.payload, name },
        localSnapshot: { ...operation.localSnapshot, name },
      }, auth);
    }, { operation, name, auth });
    expect(result.status).toBe("accepted");
    expect(result.remoteRecord.revision).toBe(operation.baseRevision + 1);
  }

  const firstLocal = await queueLocalEdit("Local Candidate Ingredient", "Conflict Test Ingredient|Remote Candidate Ingredient|Local Candidate Ingredient");
  await createRemoteWinner(firstLocal, "Remote Candidate Ingredient");
  await context.setOffline(false);

  const conflicts = page.locator("#phase2-conflict-list");
  await expect(conflicts).toBeVisible({ timeout: 15000 });
  await expect(conflicts).toContainText("Conflict Test Ingredient");
  await expect(conflicts).toContainText("Local Candidate Ingredient");
  await expect(conflicts).toContainText("Remote Candidate Ingredient");
  await conflicts.getByRole("button", { name: "Use remote version" }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Remote Candidate Ingredient");
  await expect(conflicts).toBeHidden({ timeout: 10000 });

  // Reload after the remote-choice transaction so the next offline edit starts
  // from the durable, resolved local record and acknowledged queue state.
  await page.reload();
  await expect(page.locator("#ingredient-list")).toContainText("Remote Candidate Ingredient");
  await expect.poll(async () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.filter(item => item.entityType === "ingredient").map(item => item.state);
  }), { timeout: 15000 }).toContain("synced");

  // Use a separate synced ingredient for the Keep-local path. This keeps the
  // second scenario independent of the first entity's resolved outbox history.
  await page.locator("#ingredient-name").fill("Keep Local Test Ingredient");
  await page.locator("#ingredient-description").fill("Separate entity for Keep-local resolution");
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Keep Local Test Ingredient");
  await expect.poll(async () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.filter(item => item.entityType === "ingredient" && item.localSnapshot?.name === "Keep Local Test Ingredient").map(item => item.state);
  }), { timeout: 15000 }).toEqual(["synced"]);

  const secondLocal = await queueLocalEdit("Local Kept Candidate", "Keep Local Test Ingredient|Remote Newer Candidate|Local Kept Candidate");
  await createRemoteWinner(secondLocal, "Remote Newer Candidate");
  await context.setOffline(false);

  await expect(conflicts).toBeVisible({ timeout: 15000 });
  await expect(conflicts).toContainText("Local Kept Candidate");
  await expect(conflicts).toContainText("Remote Newer Candidate");
  await conflicts.getByRole("button", { name: "Keep my version" }).click();
  await expect(page.locator("#ingredient-list")).toContainText("Local Kept Candidate", { timeout: 15000 });
  await expect(conflicts).toBeHidden({ timeout: 15000 });
  await expect(page.locator("#phase2-sync-state")).toContainText(/acknowledged|checked the queue/i);
});



test("legacy Phase 2 records migrate through the current runtime, queue once, and preserve source data", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Seed legacy IndexedDB before the application module graph runs.
  await page.route("**/*", async route => {
    if (route.request().isNavigationRequest()) {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>migration seed</body></html>" });
    } else {
      await route.continue();
    }
  });
  await page.goto("/");
  const seeded = await page.evaluate(async () => {
    const profile = {
      id: "legacy-profile-runtime-1",
      businessId: "legacy-business-runtime-1",
      name: "Legacy Runtime Migration Kitchen",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const ingredient = {
      ownerId: "local:legacy-business-runtime-1",
      businessId: "legacy-business-runtime-1",
      id: "legacy-ingredient-runtime-1",
      name: "Legacy Runtime Ingredient",
      description: "Seeded in the old database",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const open = (name, version, initialize) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => initialize(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const profileDb = await open("kitchai-local", 1, db => {
      db.createObjectStore("profiles", { keyPath: "id" });
      db.createObjectStore("metadata", { keyPath: "key" });
    });
    await new Promise((resolve, reject) => {
      const tx = profileDb.transaction("profiles", "readwrite");
      tx.objectStore("profiles").put(profile);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    profileDb.close();
    const legacyDb = await open("kitchai-ingredients", 1, db => {
      const store = db.createObjectStore("ingredients", { keyPath: ["ownerId", "businessId", "id"] });
      store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
    });
    await new Promise((resolve, reject) => {
      const tx = legacyDb.transaction("ingredients", "readwrite");
      tx.objectStore("ingredients").put(ingredient);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    legacyDb.close();

    // Seed the existing shared v1 schema and a record to exercise the real v1 -> v3
    // upgrade, including preservation of entity data and creation of the conflict store.
    const sharedDb = await open("kitchai-business-data", 1, db => {
      const definitions = [
        ["ingredients", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
        ["menuItems", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
        ["recipes", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]]],
        ["recipeLines", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]]],
      ];
      for (const [name, keyPath, indexes] of definitions) {
        const store = db.createObjectStore(name, { keyPath });
        for (const [indexName, path] of indexes) store.createIndex(indexName, path, { unique: false });
      }
      const operations = db.createObjectStore("operations", { keyPath: "operationId" });
      operations.createIndex("byOwner", "ownerId", { unique: false });
      operations.createIndex("byOwnerAndRecord", ["ownerId", "recordId"], { unique: false });
      operations.createIndex("byOwnerBusinessEntityRecord", ["ownerId", "businessId", "entityType", "recordId"], { unique: false });
      operations.createIndex("byOwnerAndState", ["ownerId", "state"], { unique: false });
      const syncMetadata = db.createObjectStore("syncMetadata", { keyPath: ["ownerId", "businessId", "entityType", "recordId"] });
      syncMetadata.createIndex("byOwner", "ownerId", { unique: false });
      syncMetadata.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
      db.createObjectStore("metadata", { keyPath: "key" });
      db.createObjectStore("migrationLedger", { keyPath: ["sourceDatabase", "sourceStore", "sourceOwnerId", "sourceBusinessId", "sourceRecordId"] });
    });
    const sharedRecord = {
      ownerId: "local:existing-shared-profile",
      businessId: "existing-shared-profile",
      id: "existing-shared-ingredient",
      name: "Existing Shared Record",
      status: "active",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    await new Promise((resolve, reject) => {
      const tx = sharedDb.transaction("ingredients", "readwrite");
      tx.objectStore("ingredients").put(sharedRecord);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    sharedDb.close();
    return { profile, ingredient, sharedRecord };
  });
  await page.unrouteAll({ behavior: "wait" });
  await page.goto("/");

  const evidence = await page.evaluate(async ({ profileId, ingredientId }) => {
    const store = await import("/src/ingredient-store.js");
    const migrated = await store.listIngredients({ ownerId: "local:" + profileId, businessId: profileId });
    const dbRequest = indexedDB.open("kitchai-business-data");
    const db = await new Promise((resolve, reject) => {
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
    });
    try {
      const read = (storeName, requestFactory) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = requestFactory(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const operationRows = await read("operations", store => store.index("byOwnerBusinessEntityRecord").getAll([
        "local:" + profileId, profileId, "ingredient", ingredientId,
      ]));
      const existingSharedRecord = await read("ingredients", store => store.get([
        "local:existing-shared-profile", "existing-shared-profile", "existing-shared-ingredient",
      ]));
      const upgradedSchema = {
        version: db.version,
        hasConflictStore: db.objectStoreNames.contains("conflicts"),
        hasScopeIndex: db.transaction("ingredients", "readonly").objectStore("ingredients").indexNames.contains("byScope"),
        hasFinishedLotHandlingStore: db.objectStoreNames.contains("finishedLotHandlingEvents"),
        hasFinishedStockSnapshotStore: db.objectStoreNames.contains("finishedStockSnapshots"),
        hasFinishedStockCommandStore: db.objectStoreNames.contains("finishedStockCommands"),
        hasPurchaseStore: db.objectStoreNames.contains("purchases"),
      };
      const ledgerRows = await read("migrationLedger", store => store.getAll());
      const sourceDbRequest = indexedDB.open("kitchai-ingredients");
      const sourceDb = await new Promise((resolve, reject) => {
        sourceDbRequest.onsuccess = () => resolve(sourceDbRequest.result);
        sourceDbRequest.onerror = () => reject(sourceDbRequest.error);
      });
      const sourceRows = await new Promise((resolve, reject) => {
        const tx = sourceDb.transaction("ingredients", "readonly");
        const request = tx.objectStore("ingredients").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      sourceDb.close();
      return {
        migrated,
        operationRows,
        existingSharedRecord,
        upgradedSchema,
        ledgerRows: ledgerRows.filter(row => row.sourceRecordId === ingredientId),
        sourceRows,
      };
    } finally {
      db.close();
    }
  }, { profileId: seeded.profile.id, ingredientId: seeded.ingredient.id });

  expect(evidence.migrated).toHaveLength(1);
  expect(evidence.migrated[0]).toMatchObject({
    ownerId: "local:" + seeded.profile.id,
    businessId: seeded.profile.id,
    id: seeded.ingredient.id,
    name: seeded.ingredient.name,
  });
  expect(evidence.operationRows).toHaveLength(1);
  expect(evidence.operationRows[0]).toMatchObject({ operation: "create", state: "pending", recordId: seeded.ingredient.id });
  expect(evidence.existingSharedRecord).toMatchObject(seeded.sharedRecord);
  expect(evidence.upgradedSchema).toEqual({ version: 8, hasConflictStore: true, hasScopeIndex: true, hasFinishedLotHandlingStore: true, hasFinishedStockSnapshotStore: true, hasFinishedStockCommandStore: true, hasPurchaseStore: true });
  expect(evidence.ledgerRows).toHaveLength(1);
  expect(evidence.ledgerRows[0].needsOutbox).toBe(false);
  expect(evidence.sourceRows).toEqual([seeded.ingredient]);

  await page.reload();
  const repeated = await page.evaluate(async ({ profileId, ingredientId }) => {
    const store = await import("/src/ingredient-store.js");
    await store.listIngredients({ ownerId: "local:" + profileId, businessId: profileId });
    const request = indexedDB.open("kitchai-business-data");
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("operations", "readonly");
        const get = tx.objectStore("operations").index("byOwnerBusinessEntityRecord").getAll([
          "local:" + profileId, profileId, "ingredient", ingredientId,
        ]);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
    } finally {
      db.close();
    }
  }, { profileId: seeded.profile.id, ingredientId: seeded.ingredient.id });
  expect(repeated).toHaveLength(1);
  await context.close();
});


test("authenticated stock-count UI creates a session, captures a server snapshot, reviews a variance, and posts atomically", async ({ page }) => {
  const pageErrors = [];
  const finishedStockDebugLogs = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "debug" && (message.text().includes("[finished-stock-debug]") || message.text().includes("[finished-stock-debug-stage]"))) finishedStockDebugLogs.push(message.text());
  });
  await createAccount(page);

  await page.locator("#business-name").fill("Stock Count E2E Kitchen");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 15000 });
  // The inventory-control UI must refresh after the account profile becomes available.
  await expect(page.getByRole("button", { name: "Create session" })).toBeEnabled({ timeout: 10000 });

  const ingredientName = "E2E Count Ingredient " + Date.now();
  await page.locator("#ingredient-name").fill(ingredientName);
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText(ingredientName);
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.locator("#phase2-sync-state")).toContainText("acknowledged", { timeout: 15000 });
  await expect(page.locator("#ingredient-list")).toContainText(ingredientName);

  await page.locator("#stock-count-session-note").fill("Authenticated browser E2E");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.locator("#stock-count-session")).toBeEnabled({ timeout: 10000 });
  await expect(page.locator("#stock-count-state")).toContainText("created", { timeout: 10000 });

  await page.locator("#stock-count-item-class").selectOption("ingredient");
  await page.locator("#stock-count-item").selectOption({ label: ingredientName });
  await page.locator("#stock-count-item-unit").selectOption("each");
  await page.getByRole("button", { name: "Add count line" }).click();
  await expect(page.locator("#stock-count-lines")).toContainText(ingredientName, { timeout: 15000 });
  await expect(page.locator("#stock-count-lines")).toContainText("expected 0");
  await expect(page.locator("#stock-count-state")).toContainText("server snapshot", { timeout: 10000 });

  const line = page.locator("#stock-count-lines li.stock-count-line").filter({ has: page.getByRole("heading", { name: ingredientName }) });
  await line.getByLabel("Counted quantity").fill("1");
  await line.getByRole("button", { name: "Save count" }).click();
  await expect(line).toContainText("variance 1", { timeout: 10000 });
  await line.getByLabel("Review reason (required for non-zero variance)").fill("E2E physical count adjustment");
  await line.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(line).toContainText("reviewed", { timeout: 10000 });

  const postingCheckbox = line.getByRole("checkbox", { name: "Select " + ingredientName + " for posting" });
  await expect(postingCheckbox).not.toBeChecked();
  await postingCheckbox.check();
  await page.getByRole("button", { name: "Post selected reviewed lines" }).click();
  await expect(page.locator("#stock-count-state")).toContainText("Server confirmed", { timeout: 20000 });
  await expect(page.locator("#stock-count-lines")).toContainText("posted", { timeout: 10000 });
  await expect(page.locator("#stock-count-state")).not.toContainText("uncertain");
  expect(pageErrors).toEqual([]);
});


test("authenticated purchase UI persists partial receipts and only confirmed receipts change server stock", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await createAccount(page);

  await page.locator("#business-name").fill("Purchase E2E Kitchen " + Date.now());
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 15000 });

  const ingredientName = "Purchase E2E Rice " + Date.now();
  await page.locator("#ingredient-name").fill(ingredientName);
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText(ingredientName);
  await page.getByRole("button", { name: "Sync now" }).click();
  // Auto-sync may have acknowledged the ingredient before this manual check, leaving no due work.
  await expect.poll(async () => page.evaluate(async (name) => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.some(item => item.entityType === "ingredient" && item.state === "synced");
  }, ingredientName), { timeout: 15000 }).toBe(true);

  // The purchase workspace may have initialized before the profile/ingredient existed.
  // Explicitly refresh so its cached ingredient list and first line are populated.
  await page.getByRole("button", { name: "Refresh purchases" }).click();
  await expect(page.locator("#purchase-line-entry-list .purchase-line-entry")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('#purchase-line-entry-list select[data-field="ingredient"] option').filter({ hasText: ingredientName })).toHaveCount(1);

  const supplierName = "E2E Supplier " + Date.now();
  await page.locator("#purchase-supplier").fill(supplierName);
  const purchaseLine = page.locator("#purchase-line-entry-list .purchase-line-entry").first();
  await purchaseLine.locator('[data-field="ingredient"]').selectOption({ label: ingredientName });
  await purchaseLine.locator('[data-field="quantity"]').fill("10");
  await purchaseLine.locator('[data-field="unit"]').selectOption("kg");
  await page.getByRole("button", { name: "Save purchase draft" }).click();
  await expect(page.locator("#purchase-state")).toContainText("Purchase draft saved locally", { timeout: 10000 });

  const purchaseCard = page.locator("#purchase-list .purchase-card").filter({ hasText: supplierName });
  await expect(purchaseCard).toBeVisible();
  await expect(purchaseCard).toContainText("ordered 10 kg");
  await expect(purchaseCard).toContainText("confirmed 0 kg");
  await expect(purchaseCard).toContainText("outstanding 10 kg");

  await purchaseCard.locator(".purchase-receipt-form input[data-line-id]").fill("4");
  await purchaseCard.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.locator("#purchase-state")).toContainText("Receipt accepted by the server", { timeout: 20000 });
  await expect(purchaseCard).toContainText("partially received");
  await expect(purchaseCard).toContainText("confirmed 4 kg");
  await expect(purchaseCard).toContainText("pending/reserved 0 kg");
  await expect(purchaseCard).toContainText("outstanding 6 kg");

  const firstSnapshot = await page.evaluate(async (name) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const ingredientsStore = await import("/src/ingredient-store.js");
    const inventory = await import("/src/supabase-api.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const ingredient = (await ingredientsStore.listIngredients(scope)).find(item => item.name === name);
    if (!ingredient) throw new Error("Synced purchase ingredient could not be found.");
    return inventory.getInventoryItemSnapshot(profile.businessId, "ingredient", ingredient.id, session);
  }, ingredientName);
  expect(Number(firstSnapshot.systemQuantity)).toBe(4);

  // Simulate an uncertain acknowledgement: replay the immutable first receipt
  // command directly through the real inventory RPC, then prove it does not
  // duplicate stock or advance the server version.
  await page.evaluate(async ({ supplierName }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const purchases = await import("/src/purchase-store.js");
    const inventory = await import("/src/supabase-api.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const purchase = (await purchases.listPurchases(scope)).find(item => item.supplierName === supplierName);
    if (!purchase) throw new Error("Purchase for idempotency replay was not found.");
    const receipt = purchase.receipts?.[0];
    if (!receipt?.command) throw new Error("First immutable receipt command was not found.");
    await inventory.applyInventoryCommand(receipt.command, session);
  }, { supplierName });
  const replayedSnapshot = await page.evaluate(async (name) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const ingredientsStore = await import("/src/ingredient-store.js");
    const inventory = await import("/src/supabase-api.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const ingredient = (await ingredientsStore.listIngredients(scope)).find(item => item.name === name);
    return inventory.getInventoryItemSnapshot(profile.businessId, "ingredient", ingredient.id, session);
  }, ingredientName);
  expect(Number(replayedSnapshot.systemQuantity)).toBe(4);
  expect(replayedSnapshot.version).toBe(firstSnapshot.version);

  await purchaseCard.locator(".purchase-receipt-form input[data-line-id]").fill("6");
  await purchaseCard.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.locator("#purchase-state")).toContainText("Receipt accepted by the server", { timeout: 20000 });
  await expect(purchaseCard).toContainText("received", { timeout: 10000 });
  await expect(purchaseCard).toContainText("confirmed 10 kg");
  await expect(purchaseCard).toContainText("pending/reserved 0 kg");
  await expect(purchaseCard).toContainText("outstanding 0 kg");

  const finalSnapshot = await page.evaluate(async (name) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const ingredientsStore = await import("/src/ingredient-store.js");
    const inventory = await import("/src/supabase-api.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const ingredient = (await ingredientsStore.listIngredients(scope)).find(item => item.name === name);
    if (!ingredient) throw new Error("Synced purchase ingredient could not be found.");
    return inventory.getInventoryItemSnapshot(profile.businessId, "ingredient", ingredient.id, session);
  }, ingredientName);
  expect(Number(finalSnapshot.systemQuantity)).toBe(10);
  expect(finalSnapshot.version).not.toBe(firstSnapshot.version);
  expect(pageErrors).toEqual([]);
});


test("authenticated browser journey composes purchase, production, giveaway, and finished-stock count", async ({ page }) => {
  const pageErrors = [];
  const finishedStockDebugLogs = [];
  page.on("console", message => {
    if (message.type() === "debug" && message.text().includes("[finished-stock-debug]")) finishedStockDebugLogs.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  await createAccount(page);

  await page.locator("#business-name").fill("Cross Workflow Kitchen " + Date.now());
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-state")).toContainText("Synced with your account · revision 1", { timeout: 15000 });

  const suffix = Date.now();
  const ingredientName = "Cross Workflow Rice " + suffix;
  const menuItemName = "Cross Workflow Bowl " + suffix;
  const recipeName = "Cross Workflow Bowl Recipe " + suffix;

  await page.locator("#ingredient-name").fill(ingredientName);
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.locator("#ingredient-list")).toContainText(ingredientName);

  await page.locator("#menu-item-name").fill(menuItemName);
  await page.locator("#menu-item-description").fill("Synthetic cross-workflow integration test");
  await page.getByRole("button", { name: "Add menu item" }).click();
  await expect(page.locator("#menu-item-list")).toContainText(menuItemName);

  await page.locator("#recipe-menu-item").selectOption({ label: menuItemName });
  await page.locator("#recipe-name").fill(recipeName);
  await page.locator("#recipe-yield").fill("4");
  // Recipes must have a valid ingredient line before activation. Save the draft first.
  await page.locator("#recipe-status").selectOption("draft");
  await page.getByRole("button", { name: "Save recipe draft" }).click();
  await expect(page.locator("#recipe-list")).toContainText(recipeName);

  await page.locator("#recipe-line-recipe").selectOption({ label: recipeName + " · Draft" });
  await page.locator("#recipe-line-ingredient").selectOption({ label: ingredientName });
  // Match the purchased inventory unit; automatic kg-to-g conversion is not enabled.
  await page.locator("#recipe-line-quantity").fill("0.25");
  await page.locator("#recipe-line-unit").selectOption("kg");
  await page.locator("#recipe-line-position").fill("0");
  await page.getByRole("button", { name: "Add ingredient line" }).click();
  await expect(page.locator("#recipe-line-list")).toContainText("0.25 kg");

  const recipeCard = page.locator("#recipe-list li").filter({ hasText: recipeName });
  await recipeCard.getByRole("button", { name: "Activate" }).click();
  await expect(recipeCard).toContainText("Active");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.locator("#phase2-sync-state")).toContainText("acknowledged", { timeout: 20000 });
  await expect.poll(async () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const sync = await import("/src/phase2-sync-engine.js");
    const profiles = await import("/src/sync-store.js");
    const profile = (await profiles.listOwnerProfiles(auth.user.id))[0];
    const operations = await sync.createPhase2SyncStore().listOperations(auth.user.id, profile.id);
    return operations.filter(item => ["ingredient", "menuItem", "recipe", "recipeLine"].includes(item.entityType))
      .every(item => item.state === "synced") && operations.length >= 4;
  }), { timeout: 20000 }).toBe(true);

  const supplierName = "Cross Workflow Supplier " + suffix;
  await page.getByRole("button", { name: "Refresh purchases" }).click();
  await expect(page.locator("#purchase-line-entry-list .purchase-line-entry")).toHaveCount(1, { timeout: 10000 });
  const purchaseLine = page.locator("#purchase-line-entry-list .purchase-line-entry").first();
  await page.locator("#purchase-supplier").fill(supplierName);
  await purchaseLine.locator('[data-field="ingredient"]').selectOption({ label: ingredientName });
  await purchaseLine.locator('[data-field="quantity"]').fill("10");
  await purchaseLine.locator('[data-field="unit"]').selectOption("kg");
  await page.getByRole("button", { name: "Save purchase draft" }).click();
  const purchaseCard = page.locator("#purchase-list .purchase-card").filter({ hasText: supplierName });
  await expect(purchaseCard).toBeVisible();
  await purchaseCard.locator(".purchase-receipt-form input[data-line-id]").fill("10");
  await purchaseCard.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.locator("#purchase-state")).toContainText("Receipt accepted by the server", { timeout: 20000 });
  await expect(purchaseCard).toContainText("confirmed 10 kg");

  const itemIds = await page.evaluate(async ({ ingredientName, menuItemName }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const ingredientsStore = await import("/src/ingredient-store.js");
    const menus = await import("/src/menu-item-store.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const ingredient = (await ingredientsStore.listIngredients(scope)).find(item => item.name === ingredientName);
    const menuItem = (await menus.listMenuItems(scope)).find(item => item.name === menuItemName);
    if (!ingredient || !menuItem) throw new Error("Synced ingredient or menu item was not found.");
    const api = await import("/src/supabase-api.js");
    return {
      businessId: profile.businessId,
      ingredientId: ingredient.id,
      menuItemId: menuItem.id,
      ingredientBefore: await api.getInventoryItemSnapshot(profile.businessId, "ingredient", ingredient.id, session),
    };
  }, { ingredientName, menuItemName });

  await page.locator("#production-recipe").selectOption({ label: recipeName });
  await page.getByRole("button", { name: "Start production batch" }).click();
  const batch = page.locator("#production-batch-list .production-batch-card").filter({ hasText: recipeName });
  await expect(batch).toBeVisible();
  const usageLine = batch.locator("fieldset.production-usage-line").first();
  await usageLine.locator('select[data-field="disposition"]').selectOption("measured");
  await usageLine.locator('input[data-field="quantity"]').fill("0.25");
  await batch.locator('input[data-field="outputQuantity"]').fill("4");
  await batch.locator('select[data-field="outputUnit"]').selectOption("each");
  await batch.getByRole("button", { name: "Save usage and prepare batch" }).click();
  await expect(page.locator("#production-state")).toContainText("Production batch posted", { timeout: 20000 });
  await expect(batch).toContainText("completed");

  // Separate the server read path from UI refresh/rendering so a regression points to the right layer.
  const serverFinishedStock = await page.evaluate(async ({ businessId }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const api = await import("/src/supabase-api.js");
    return api.readFinishedStock(businessId, session);
  }, { businessId: itemIds.businessId });
  expect(serverFinishedStock.lots.map(lot => lot.menuItemId), JSON.stringify(serverFinishedStock.lots)).toContain(itemIds.menuItemId);

  await page.getByRole("button", { name: "Refresh stock" }).click();
  const finishedStockDiagnostics = await page.evaluate(async ({ businessId }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const profiles = await import("/src/sync-store.js");
    const businessStore = await import("/src/business-data-store.js");
    const workflow = await import("/src/finished-stock-workflow-store.js");
    const profile = (await profiles.listOwnerProfiles(session.user.id))[0];
    const scope = businessStore.scopeForBusinessProfile({ ownerId: session.user.id, profileId: profile.id });
    const snapshot = await workflow.getFinishedStockSnapshot(scope);
    return {
      profileSyncState: profile.syncState,
      profileBusinessId: profile.businessId,
      requestedBusinessId: businessId,
      snapshot: snapshot ? { remoteBusinessId: snapshot.remoteBusinessId, lots: snapshot.lots, allocations: snapshot.allocations } : null,
      status: document.querySelector("#finished-stock-state")?.textContent ?? "",
      authStatus: document.querySelector("#auth-state")?.textContent ?? "",
      profileStatus: document.querySelector("#profile-state")?.textContent ?? "",
      signOutHidden: document.querySelector("#sign-out-button")?.hidden ?? null,
      signUpHidden: document.querySelector("#sign-up-button")?.hidden ?? null,
      storedSessionPresent: Boolean(sessionStorage.getItem("kitchai.auth.session")),
      stockCountState: document.querySelector("#stock-count-state")?.textContent ?? "",
    };
  }, { businessId: itemIds.businessId });
  finishedStockDiagnostics.finishedStockDebugLogs = finishedStockDebugLogs;
  await expect(page.locator("#finished-stock-state"), JSON.stringify(finishedStockDiagnostics)).toContainText("Stock refreshed from the server", { timeout: 15000 });
  await expect(page.locator("#finished-stock-list")).toContainText(menuItemName, { timeout: 15000 });
  await expect(page.locator("#finished-stock-list")).toContainText("Remaining 4 each");
  const afterProduction = await page.evaluate(async ({ businessId, ingredientId, menuItemId }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const api = await import("/src/supabase-api.js");
    return {
      finished: await api.getInventoryItemSnapshot(businessId, "finished", menuItemId, session),
      ingredient: await api.getInventoryItemSnapshot(businessId, "ingredient", ingredientId, session),
    };
  }, { businessId: itemIds.businessId, ingredientId: itemIds.ingredientId, menuItemId: itemIds.menuItemId });
  expect(Number(afterProduction.finished.systemQuantity)).toBe(4);
  expect(Number(afterProduction.ingredient.systemQuantity)).toBeLessThan(Number(itemIds.ingredientBefore.systemQuantity));

  await page.locator("#finished-disposition-type").selectOption("giveaway");
  await page.locator("#finished-disposition-lot").selectOption({ index: 1 });
  await page.locator("#finished-disposition-quantity").fill("1");
  await page.getByRole("button", { name: "Save stock disposition" }).click();
  await expect(page.locator("#finished-disposition-state")).toContainText("Stock disposition synced", { timeout: 20000 });
  await expect(page.locator("#finished-stock-list")).toContainText("Remaining 3 each", { timeout: 15000 });
  const afterGiveaway = await page.evaluate(async ({ businessId, menuItemId }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const api = await import("/src/supabase-api.js");
    return api.getInventoryItemSnapshot(businessId, "finished", menuItemId, session);
  }, { businessId: itemIds.businessId, menuItemId: itemIds.menuItemId });
  expect(Number(afterGiveaway.systemQuantity)).toBe(3);

  await page.locator("#stock-count-create-form").getByRole("button", { name: "Create session" }).click();
  await expect(page.locator("#stock-count-state")).toContainText("session created", { timeout: 10000 });
  await page.locator("#stock-count-item-class").selectOption("finished");
  await page.locator("#stock-count-item").selectOption({ label: menuItemName });
  await page.getByRole("button", { name: "Add count line" }).click();
  await expect(page.locator("#stock-count-lines")).toContainText(menuItemName, { timeout: 15000 });
  await expect(page.locator("#stock-count-lines")).toContainText("expected 3");
  const countLine = page.locator("#stock-count-lines li.stock-count-line").filter({ has: page.getByRole("heading", { name: menuItemName }) });
  await countLine.getByLabel("Counted quantity").fill("2");
  await countLine.getByRole("button", { name: "Save count" }).click();
  await expect(countLine).toContainText("variance -1");
  await countLine.getByLabel("Review reason (required for non-zero variance)").fill("Cross-workflow physical count regression");
  await countLine.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(countLine).toContainText("reviewed");
  await countLine.getByRole("checkbox", { name: "Select " + menuItemName + " for posting" }).check();
  await page.getByRole("button", { name: "Post selected reviewed lines" }).click();
  await expect(page.locator("#stock-count-state")).toContainText("Server confirmed", { timeout: 20000 });
  await expect(countLine).toContainText("posted");
  const finalSnapshot = await page.evaluate(async ({ businessId, menuItemId }) => {
    const session = JSON.parse(sessionStorage.getItem("kitchai.auth.session"));
    const api = await import("/src/supabase-api.js");
    return api.getInventoryItemSnapshot(businessId, "finished", menuItemId, session);
  }, { businessId: itemIds.businessId, menuItemId: itemIds.menuItemId });
  expect(Number(finalSnapshot.systemQuantity)).toBe(2);
  expect(finalSnapshot.version).not.toBe(afterGiveaway.version);
  expect(pageErrors).toEqual([]);
});
