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
