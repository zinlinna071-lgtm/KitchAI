/* WP2.5a disposable migration prototype. Never imported by the production app. */
(() => {
  const SOURCES = [
    { database: "kitchai-ingredients", store: "ingredients", target: "ingredients" },
    { database: "kitchai-menu", store: "menuItems", target: "menuItems" },
    { database: "kitchai-recipes", store: "recipes", target: "recipes" },
    { database: "kitchai-recipes", store: "recipeLines", target: "recipeLines" },
  ];
  const MARKER = "phase2-entities-v1";

  function openDatabase(name, version, initialize) {
    return new Promise((resolve, reject) => {
      const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
      if (initialize) request.onupgradeneeded = () => initialize(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open " + name + "."));
      request.onblocked = () => reject(new Error("Database open was blocked: " + name));
    });
  }

  function createTargetSchema(db) {
    const definitions = [
      ["ingredients", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
      ["menuItems", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
      ["recipes", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]]],
      ["recipeLines", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]]],
    ];
    for (const [name, keyPath, indexes] of definitions) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath });
        for (const [indexName, path] of indexes) store.createIndex(indexName, path, { unique: false });
      }
    }
    if (!db.objectStoreNames.contains("operations")) {
      const store = db.createObjectStore("operations", { keyPath: "operationId" });
      store.createIndex("byOwner", "ownerId", { unique: false });
      store.createIndex("byOwnerAndRecord", ["ownerId", "entityType", "recordId"], { unique: false });
    }
    if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata", { keyPath: "key" });
  }

  async function readAll(databaseName, storeName) {
    const db = await openDatabase(databaseName);
    try {
      if (!db.objectStoreNames.contains(storeName)) return [];
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not read " + databaseName + "/" + storeName + "."));
      });
    } finally {
      db.close();
    }
  }

  async function migratePhase2Entities(options = {}) {
    const targetName = options.targetName ?? "kitchai-business-data-spike";
    const target = await openDatabase(targetName, 1, createTargetSchema);
    try {
      const existingMarker = await new Promise((resolve, reject) => {
        const tx = target.transaction("metadata", "readonly");
        const request = tx.objectStore("metadata").get(MARKER);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not read migration checkpoint."));
      });
      if (existingMarker) return { alreadyCompleted: true, imported: 0, existing: 0, sourceCounts: existingMarker.sourceCounts };

      const rows = {};
      const sourceCounts = {};
      for (const source of SOURCES) {
        const key = source.target;
        rows[key] = await readAll(source.database, source.store);
        sourceCounts[key] = rows[key].length;
      }
      const stores = [...new Set(SOURCES.map((source) => source.target)), "metadata"];
      const imported = { ingredients: 0, menuItems: 0, recipes: 0, recipeLines: 0 };
      const existing = { ingredients: 0, menuItems: 0, recipes: 0, recipeLines: 0 };
      await new Promise((resolve, reject) => {
        const tx = target.transaction(stores, "readwrite");
        let pending = SOURCES.reduce((count, source) => count + rows[source.target].length, 0);
        let writes = 0;
        let failureInjected = false;
        const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
        const finishReads = () => {
          if (pending !== 0) return;
          const metadata = tx.objectStore("metadata");
          const checkpoint = metadata.get(MARKER);
          checkpoint.onsuccess = () => {
            if (!checkpoint.result) metadata.put({ key: MARKER, completedAt: new Date().toISOString(), sourceCounts });
          };
          checkpoint.onerror = () => { if (!failureInjected) fail(checkpoint.error ?? new Error("Could not record migration checkpoint.")); };
        };
        tx.oncomplete = resolve;
        tx.onerror = () => { if (!failureInjected) reject(tx.error ?? new Error("Entity migration transaction failed.")); };
        tx.onabort = () => reject(failureInjected ? new Error("Injected interruption; transaction rolled back.") : (tx.error ?? new Error("Entity migration transaction aborted.")));

        for (const source of SOURCES) {
          const store = tx.objectStore(source.target);
          for (const row of rows[source.target]) {
            const key = [row.ownerId, row.businessId, row.id];
            const request = store.get(key);
            request.onsuccess = () => {
              if (request.result) {
                if (JSON.stringify(request.result) !== JSON.stringify(row)) {
                  fail(new Error("Migration collision for " + source.target + " record " + row.id + "; source and target were preserved for review."));
                  return;
                }
                existing[source.target]++;
              } else {
                store.add(row);
                imported[source.target]++;
                writes++;
                if (Number.isInteger(options.failAfterWrites) && writes >= options.failAfterWrites) {
                  failureInjected = true;
                  try { tx.abort(); } catch {}
                  return;
                }
              }
              pending--;
              finishReads();
            };
            request.onerror = () => { if (!failureInjected) fail(request.error ?? new Error("Could not inspect target record.")); };
          }
        }
        finishReads();
      });
      return {
        alreadyCompleted: false,
        imported: Object.values(imported).reduce((sum, count) => sum + count, 0),
        importedByStore: imported,
        existingByStore: existing,
        sourceCounts,
      };
    } finally {
      target.close();
    }
  }

  window.KitchAIEntityMigrationSpike = Object.freeze({ migratePhase2Entities });
})();
