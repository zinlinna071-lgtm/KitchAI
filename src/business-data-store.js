const DATABASE_NAME = "kitchai-business-data";
const DATABASE_VERSION = 4;
const ENTITY_STORES = ["ingredients", "menuItems", "recipes", "recipeLines"];
const OPERATIONS = "operations";
const SYNC_METADATA = "syncMetadata";
const METADATA = "metadata";
const MIGRATION_LEDGER = "migrationLedger";
const MIGRATION_MARKER = "legacy-phase2-entities-v1";
const LEGACY_SOURCES = [
  { database: "kitchai-ingredients", store: "ingredients", target: "ingredients" },
  { database: "kitchai-menu", store: "menuItems", target: "menuItems" },
  { database: "kitchai-recipes", store: "recipes", target: "recipes" },
  { database: "kitchai-recipes", store: "recipeLines", target: "recipeLines" },
];
let databasePromise;

/** @param {unknown} value @param {string} label */
function requireScopePart(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value;
}

/**
 * Use the stable Business Profile ID as the local business partition key.
 * The remote business ID is server-authoritative and may differ after the first profile sync.
 * @param {{ownerId?:string,profileId:unknown,local?:boolean}} input
 */
export function scopeForBusinessProfile(input) {
  const profileId = requireScopePart(input?.profileId, "Business Profile ID");
  if (input.local) return { ownerId: "local:" + profileId, businessId: profileId };
  return { ownerId: requireScopePart(input?.ownerId, "Owner scope"), businessId: profileId };
}

function createSchema(db) {
  const entityDefinitions = [
    ["ingredients", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
    ["menuItems", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]]]],
    ["recipes", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byScopeMenuItem", ["ownerId", "businessId", "menuItemId"]]]],
    ["recipeLines", ["ownerId", "businessId", "id"], [["byScope", ["ownerId", "businessId"]], ["byRecipe", ["ownerId", "businessId", "recipeId"]], ["byRecipePosition", ["ownerId", "businessId", "recipeId", "position"]]]],
  ];
  for (const [name, keyPath, indexes] of entityDefinitions) {
    if (!db.objectStoreNames.contains(name)) {
      const store = db.createObjectStore(name, { keyPath });
      for (const [indexName, path] of indexes) store.createIndex(indexName, path, { unique: false });
    }
  }
  if (!db.objectStoreNames.contains(OPERATIONS)) {
    const store = db.createObjectStore(OPERATIONS, { keyPath: "operationId" });
    store.createIndex("byOwner", "ownerId", { unique: false });
    store.createIndex("byOwnerAndRecord", ["ownerId", "recordId"], { unique: false });
    store.createIndex("byOwnerBusinessEntityRecord", ["ownerId", "businessId", "entityType", "recordId"], { unique: false });
    store.createIndex("byOwnerAndState", ["ownerId", "state"], { unique: false });
  }
  if (!db.objectStoreNames.contains(SYNC_METADATA)) {
    const store = db.createObjectStore(SYNC_METADATA, { keyPath: ["ownerId", "businessId", "entityType", "recordId"] });
    store.createIndex("byOwner", "ownerId", { unique: false });
    store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
  }
  if (!db.objectStoreNames.contains(METADATA)) db.createObjectStore(METADATA, { keyPath: "key" });
  if (!db.objectStoreNames.contains(MIGRATION_LEDGER)) {
    db.createObjectStore(MIGRATION_LEDGER, {
      keyPath: ["sourceDatabase", "sourceStore", "sourceOwnerId", "sourceBusinessId", "sourceRecordId"],
    });
  }
  if (!db.objectStoreNames.contains("conflicts")) {
    const store = db.createObjectStore("conflicts", { keyPath: "conflictId" });
    store.createIndex("byOwnerBusiness", ["ownerId", "businessId"], { unique: false });
    store.createIndex("byOwnerState", ["ownerId", "state"], { unique: false });
    store.createIndex("byOwnerBusinessRecord", ["ownerId", "businessId", "entityType", "recordId"], { unique: false });
  }
  // Phase 3 inventory stores are additive. Never recreate or rewrite Phase 2 stores.
  if (!db.objectStoreNames.contains("stockMovements")) {
    const store = db.createObjectStore("stockMovements", { keyPath: ["ownerId", "businessId", "eventId"] });
    store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
    store.createIndex("byStockItem", ["ownerId", "businessId", "stockClass", "stockItemId"], { unique: false });
    store.createIndex("bySource", ["ownerId", "businessId", "sourceType", "sourceId"], { unique: false });
    store.createIndex("byRecordedAt", ["ownerId", "businessId", "recordedAt"], { unique: false });
    store.createIndex("byRelatedEvent", ["ownerId", "businessId", "relatedEventId"], { unique: false });
  }
  if (!db.objectStoreNames.contains("finishedLots")) {
    const store = db.createObjectStore("finishedLots", { keyPath: ["ownerId", "businessId", "lotId"] });
    store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
    store.createIndex("byMenuItem", ["ownerId", "businessId", "menuItemId"], { unique: false });
    store.createIndex("byBatch", ["ownerId", "businessId", "batchId"], { unique: false });
  }
  if (!db.objectStoreNames.contains("inventoryCommands")) {
    const store = db.createObjectStore("inventoryCommands", { keyPath: "operationId" });
    store.createIndex("byOwnerBusiness", ["ownerId", "businessId"], { unique: false });
    store.createIndex("byOwnerBusinessState", ["ownerId", "businessId", "state"], { unique: false });
  }
  if (!db.objectStoreNames.contains("stockMovementLotAllocations")) {
    const store = db.createObjectStore("stockMovementLotAllocations", {
      keyPath: ["ownerId", "businessId", "eventId", "lotId"],
    });
    store.createIndex("byEvent", ["ownerId", "businessId", "eventId"], { unique: false });
    store.createIndex("byLot", ["ownerId", "businessId", "lotId"], { unique: false });
  }
  // Production batches are local-first workflow records; recipe snapshots are captured once at start.
  if (!db.objectStoreNames.contains("productionBatches")) {
    const store = db.createObjectStore("productionBatches", { keyPath: ["ownerId", "businessId", "batchId"] });
    store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
    store.createIndex("byRecipe", ["ownerId", "businessId", "recipeId"], { unique: false });
    store.createIndex("byState", ["ownerId", "businessId", "state"], { unique: false });
    store.createIndex("byStartedAt", ["ownerId", "businessId", "startedAt"], { unique: false });
  }
}

function openRawDatabase(name, version, initialize) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    if (initialize) request.onupgradeneeded = () => initialize(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open " + name + "."));
    request.onblocked = () => reject(new Error("Database open was blocked: " + name));
  });
}

/** @param {string} databaseName */
async function openLegacyDatabaseIfPresent(databaseName) {
  const factory = /** @type {any} */ (indexedDB);
  if (typeof factory.databases === "function") {
    const databases = await factory.databases();
    if (!databases.some((database) => database.name === databaseName)) return null;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    let absentDatabase = false;
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        absentDatabase = true;
        request.transaction.abort();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (absentDatabase && request.error?.name === "AbortError") resolve(null);
      else reject(request.error ?? new Error("Could not inspect legacy database " + databaseName + "."));
    };
    request.onblocked = () => reject(new Error("Legacy database inspection was blocked: " + databaseName));
  });
}

/** @param {string} databaseName @param {string} storeName */
async function readLegacyStore(databaseName, storeName) {
  const db = await openLegacyDatabaseIfPresent(databaseName);
  if (!db) return [];
  try {
    if (!db.objectStoreNames.contains(storeName)) return [];
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not read legacy store " + databaseName + "/" + storeName + "."));
    });
  } finally {
    db.close();
  }
}

/** @param {any} row @param {any[]} localProfiles @param {any[]} accountProfiles */
function mapLegacyRecord(row, localProfiles, accountProfiles) {
  if (typeof row.ownerId !== "string" || typeof row.businessId !== "string" || typeof row.id !== "string") {
    throw new Error("A legacy Phase 2 record has invalid scope or ID. Source records were preserved.");
  }
  if (row.ownerId.startsWith("local:")) {
    const profile = localProfiles.find((candidate) =>
      row.businessId === candidate.businessId || row.ownerId === "local:" + candidate.businessId,
    );
    if (!profile?.id) {
      throw new Error("Could not safely map a local Phase 2 record to its Business Profile. Source data remains in the legacy database.");
    }
    return { ...row, ownerId: "local:" + profile.id, businessId: profile.id };
  }
  const profile = accountProfiles.find((candidate) => candidate.ownerId === row.ownerId);
  if (!profile?.id) {
    throw new Error("Could not safely map an account-owned Phase 2 record to its Business Profile. Source data remains in the legacy database.");
  }
  return { ...row, businessId: profile.id };
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Reconcile old stores on every app load. Source records are never deleted.
 * If an old app tab changed a source record after migration, import it only when
 * the shared target has not independently changed; otherwise abort and preserve both.
 * @param {IDBDatabase} db
 */
async function migrateLegacyPhase2Data(db) {
  const [localProfiles, accountProfiles] = await Promise.all([
    readLegacyStore("kitchai-local", "profiles"),
    readLegacyStore("kitchai-sync", "profiles"),
  ]);
  /** @type {{sourceDatabase:string,sourceStore:string,sourceRow:any,targetRow:any}[]} */
  const entries = [];
  for (const source of LEGACY_SOURCES) {
    const rows = await readLegacyStore(source.database, source.store);
    for (const row of rows) {
      entries.push({
        sourceDatabase: source.database,
        sourceStore: source.store,
        sourceRow: row,
        targetRow: mapLegacyRecord(row, localProfiles, accountProfiles),
      });
    }
  }
  const storeNames = [...ENTITY_STORES, OPERATIONS, SYNC_METADATA, METADATA, MIGRATION_LEDGER];
  const counts = { imported: 0, restored: 0, reconciled: 0, unchanged: 0, sourceRecords: entries.length };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    const metadata = tx.objectStore(METADATA);
    const ledger = tx.objectStore(MIGRATION_LEDGER);
    let pending = entries.length;
    let failure = null;
    const fail = (error) => {
      if (failure) return;
      failure = error instanceof Error ? error : new Error("Legacy Phase 2 migration failed.");
      try { tx.abort(); } catch {}
    };
    const finish = () => {
      if (pending !== 0 || failure) return;
      const markerRequest = metadata.get(MIGRATION_MARKER);
      markerRequest.onsuccess = () => {
        if (!markerRequest.result) {
          metadata.put({ key: MIGRATION_MARKER, completedAt: new Date().toISOString(), sourceRecords: entries.length });
        }
      };
      markerRequest.onerror = () => fail(markerRequest.error ?? new Error("Could not record migration checkpoint."));
    };
    tx.oncomplete = resolve;
    tx.onerror = () => { if (!failure) failure = tx.error ?? new Error("Legacy Phase 2 migration transaction failed."); };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Legacy Phase 2 migration was aborted."));

    if (!entries.length) {
      finish();
      return;
    }
    for (const entry of entries) {
      const row = entry.sourceRow;
      const sourceKey = [entry.sourceDatabase, entry.sourceStore, row.ownerId, row.businessId, row.id];
      const ledgerRequest = ledger.get(sourceKey);
      ledgerRequest.onsuccess = () => {
        if (failure) return;
        const previous = ledgerRequest.result;
        const mapped = previous
          ? { ...row, ownerId: previous.targetKey[0], businessId: previous.targetKey[1] }
          : entry.targetRow;
        const targetKey = previous?.targetKey ?? [mapped.ownerId, mapped.businessId, mapped.id];
        const targetStore = tx.objectStore(entry.sourceStore);
        const targetRequest = targetStore.get(targetKey);
        targetRequest.onsuccess = () => {
          if (failure) return;
          const currentTarget = targetRequest.result;
          if (!previous) {
            if (currentTarget && !sameRecord(currentTarget, mapped)) {
              fail(new Error("Migration collision for " + entry.sourceStore + " record " + row.id + ". Source and target data were preserved for review."));
              return;
            }
            if (!currentTarget) {
              targetStore.add(mapped);
              counts.imported++;
            }
            ledger.add({
              sourceDatabase: entry.sourceDatabase,
              sourceStore: entry.sourceStore,
              sourceOwnerId: row.ownerId,
              sourceBusinessId: row.businessId,
              sourceRecordId: row.id,
              sourceSnapshot: row,
              targetKey,
              targetSnapshot: mapped,
              needsOutbox: true,
            });
            counts.unchanged++;
          } else {
            const sourceChanged = !sameRecord(row, previous.sourceSnapshot);
            if (!currentTarget) {
              const restored = sourceChanged ? mapped : previous.targetSnapshot;
              targetStore.put(restored);
              ledger.put({
                ...previous,
                sourceSnapshot: sourceChanged ? row : previous.sourceSnapshot,
                targetSnapshot: restored,
                needsOutbox: true,
              });
              counts.restored++;
            } else if (!sourceChanged) {
              counts.unchanged++;
            } else {
              const targetChanged = !sameRecord(currentTarget, previous.targetSnapshot);
              if (!targetChanged || sameRecord(currentTarget, mapped)) {
                if (!sameRecord(currentTarget, mapped)) targetStore.put(mapped);
                ledger.put({ ...previous, sourceSnapshot: row, targetSnapshot: mapped, needsOutbox: true });
                counts.reconciled++;
              } else {
                fail(new Error("Both the legacy and shared Phase 2 record changed independently for " + entry.sourceStore + " record " + row.id + ". Both copies were preserved; manual conflict review is required."));
                return;
              }
            }
          }
          pending--;
          finish();
        };
        targetRequest.onerror = () => fail(targetRequest.error ?? new Error("Could not inspect shared Phase 2 data."));
      };
      ledgerRequest.onerror = () => fail(ledgerRequest.error ?? new Error("Could not read the migration ledger."));
    }
  });
  return counts;
}

/**
 * Queue all legacy records for their first entity sync. The ledger flag and operation
 * are committed in the same transaction, so a restart between migration and queueing
 * safely resumes without duplicating operations.
 * @param {IDBDatabase} db
 */
async function queueLegacyMigrationOperations(db) {
  const entityTypeByStore = { ingredients: "ingredient", menuItems: "menuItem", recipes: "recipe", recipeLines: "recipeLine" };
  const sourceOrder = new Map(LEGACY_SOURCES.map((source, index) => [source.store, index]));
  const coalescibleStates = new Set(["pending", "retryable_error", "needs_auth", "blocked_dependency"]);
  const dependenciesFor = (record, entityType) => {
    if (entityType === "recipe") return [{ entityType: "menuItem", recordId: record.menuItemId }];
    if (entityType === "recipeLine") return [
      { entityType: "recipe", recordId: record.recipeId },
      { entityType: "ingredient", recordId: record.ingredientId },
    ];
    return [];
  };
  const payloadFor = (record, entityType) => {
    if (entityType === "ingredient" || entityType === "menuItem") {
      return { name: record.name, ...(record.description ? { description: record.description } : {}), status: record.status };
    }
    if (entityType === "recipe") {
      return {
        menuItemId: record.menuItemId,
        name: record.name,
        ...(record.description ? { description: record.description } : {}),
        ...(record.instructions ? { instructions: record.instructions } : {}),
        ...(record.yieldPortions !== undefined ? { yieldPortions: record.yieldPortions } : {}),
        status: record.status,
      };
    }
    return {
      recipeId: record.recipeId,
      ingredientId: record.ingredientId,
      quantity: record.quantity,
      unit: record.unit,
      position: record.position,
      ...(record.note ? { note: record.note } : {}),
    };
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction([...ENTITY_STORES, OPERATIONS, SYNC_METADATA, MIGRATION_LEDGER], "readwrite");
    const ledger = tx.objectStore(MIGRATION_LEDGER);
    const operations = tx.objectStore(OPERATIONS);
    const syncMetadata = tx.objectStore(SYNC_METADATA);
    let failure = null;
    const fail = (error) => {
      if (failure) return;
      failure = error instanceof Error ? error : new Error("Could not queue legacy entity migration.");
      try { tx.abort(); } catch {}
    };
    tx.oncomplete = resolve;
    tx.onerror = () => { if (!failure) failure = tx.error ?? new Error("Legacy entity outbox transaction failed."); };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Legacy entity outbox transaction was aborted."));

    const allRequest = ledger.getAll();
    allRequest.onerror = () => fail(allRequest.error ?? new Error("Could not inspect the migration ledger."));
    allRequest.onsuccess = () => {
      const entries = allRequest.result
        .filter((entry) => entry.needsOutbox !== false)
        .sort((a, b) => (sourceOrder.get(a.sourceStore) ?? 99) - (sourceOrder.get(b.sourceStore) ?? 99));
      const processEntry = (index) => {
        if (failure || index >= entries.length) return;
        const entry = entries[index];
        const recordRequest = tx.objectStore(entry.sourceStore).get(entry.targetKey);
        recordRequest.onerror = () => fail(recordRequest.error ?? new Error("Could not read a migrated entity for outbox queueing."));
        recordRequest.onsuccess = () => {
          if (failure) return;
          const record = recordRequest.result;
          if (!record) {
            fail(new Error("A migration-ledger target is missing; source data remains preserved for review."));
            return;
          }
          const entityType = entityTypeByStore[entry.sourceStore];
          const scope = { ownerId: record.ownerId, businessId: record.businessId, entityType, recordId: record.id };
          const queuedRequest = operations.index("byOwnerBusinessEntityRecord").getAll([
            scope.ownerId, scope.businessId, scope.entityType, scope.recordId,
          ]);
          queuedRequest.onerror = () => fail(queuedRequest.error ?? new Error("Could not inspect an entity's existing outbox operations."));
          queuedRequest.onsuccess = () => {
            if (failure) return;
            const queued = queuedRequest.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const latest = queued.at(-1);
            const metadataRequest = syncMetadata.get([scope.ownerId, scope.businessId, scope.entityType, scope.recordId]);
            metadataRequest.onerror = () => fail(metadataRequest.error ?? new Error("Could not read entity sync metadata during migration."));
            metadataRequest.onsuccess = () => {
              if (failure) return;
              const remote = metadataRequest.result;
              const dependencies = dependenciesFor(record, entityType);
              const dependencyIds = [];
              let remaining = dependencies.length;
              const finishDependencies = () => {
                if (remaining !== 0 || failure) return;
                const dependsOnOperationIds = [...new Set(dependencyIds)];
                const payload = payloadFor(record, entityType);
                if (latest && coalescibleStates.has(latest.state)) {
                  operations.put({
                    ...latest,
                    payload: structuredClone(payload),
                    localSnapshot: structuredClone(record),
                    dependsOnOperationIds,
                    ...(dependsOnOperationIds.length === 1 ? { dependsOnOperationId: dependsOnOperationIds[0] } : { dependsOnOperationId: undefined }),
                    state: dependsOnOperationIds.length ? "blocked_dependency" : latest.state === "blocked_dependency" || latest.state === "retryable_error" ? "pending" : latest.state,
                    updatedAt: new Date().toISOString(),
                  });
                } else {
                  if (latest && latest.state !== "synced" && !dependsOnOperationIds.includes(latest.operationId)) {
                    dependsOnOperationIds.push(latest.operationId);
                  }
                  const operation = {
                    operationId: crypto.randomUUID(),
                    ...scope,
                    operation: remote && Number.isInteger(remote.revision) ? "update" : "create",
                    baseRevision: remote && Number.isInteger(remote.revision) ? remote.revision : null,
                    baseSnapshot: remote?.lastSyncedSnapshot ? structuredClone(remote.lastSyncedSnapshot) : null,
                    localSnapshot: structuredClone(record),
                    payload: structuredClone(payload),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    attemptCount: 0,
                    state: dependsOnOperationIds.length ? "blocked_dependency" : "pending",
                    nextAttemptAt: 0,
                    dependsOnOperationIds,
                    ...(dependsOnOperationIds.length === 1 ? { dependsOnOperationId: dependsOnOperationIds[0] } : {}),
                  };
                  operations.add(operation);
                }
                ledger.put({ ...entry, needsOutbox: false, outboxQueuedAt: new Date().toISOString() });
                processEntry(index + 1);
              };
              for (const dependency of dependencies) {
                const request = operations.index("byOwnerBusinessEntityRecord").getAll([
                  scope.ownerId, scope.businessId, dependency.entityType, dependency.recordId,
                ]);
                request.onerror = () => fail(request.error ?? new Error("Could not inspect a parent entity operation during migration."));
                request.onsuccess = () => {
                  const parentOperations = request.result
                    .filter((operation) => operation.state !== "synced")
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                  const parent = parentOperations.at(-1);
                  if (parent) dependencyIds.push(parent.operationId);
                  remaining--;
                  finishDependencies();
                };
              }
              finishDependencies();
            };
          };
        };
      };
      processEntry(0);
    };
  });
}

/** Open the shared Phase 2 entity database only after legacy data is reconciled. */
export function openBusinessDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    const db = await openRawDatabase(DATABASE_NAME, DATABASE_VERSION, createSchema);
    db.onversionchange = () => { db.close(); databasePromise = undefined; };
    try {
      await migrateLegacyPhase2Data(db);
      await queueLegacyMigrationOperations(db);
      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  })().catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

/**
 * Queue an entity mutation in the same transaction as its record write.
 * Existing unsent creates/updates are coalesced without changing operationId.
 * Child records wait for unresolved parent operations before transport may dispatch them.
 * @param {IDBObjectStore} operations
 * @param {IDBObjectStore} syncMetadata
 * @param {{ownerId:string,businessId:string,entityType:string,recordId:string,payload:any,localSnapshot:any,dependencies?:{entityType:string,recordId:string}[],onError?:(error:Error)=>void}} input
 */
export function enqueueEntityOperation(operations, syncMetadata, input) {
  const scope = {
    ownerId: requireScopePart(input.ownerId, "Owner scope"),
    businessId: requireScopePart(input.businessId, "Business scope"),
    entityType: requireScopePart(input.entityType, "Entity type"),
    recordId: requireScopePart(input.recordId, "Record ID"),
  };
  const fail = (error) => {
    input.onError?.(error instanceof Error ? error : new Error("Could not queue entity operation."));
    try { operations.transaction.abort(); } catch {}
  };
  const request = operations.index("byOwnerBusinessEntityRecord").getAll([
    scope.ownerId, scope.businessId, scope.entityType, scope.recordId,
  ]);
  request.onsuccess = () => {
    const queued = request.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = queued.at(-1);
    const coalescible = latest && ["pending", "retryable_error", "needs_auth", "blocked_dependency"].includes(latest.state);
    const dependencies = Array.isArray(input.dependencies) ? input.dependencies : [];
    const uniqueDependencies = [...new Map(dependencies.map((item) => [
      item.entityType + "\\u0000" + item.recordId,
      { entityType: requireScopePart(item.entityType, "Dependency entity type"), recordId: requireScopePart(item.recordId, "Dependency record ID") },
    ])).values()].filter((item) => item.entityType !== scope.entityType || item.recordId !== scope.recordId);
    const dependencyRequests = uniqueDependencies.map((dependency) => ({
      dependency,
      request: operations.index("byOwnerBusinessEntityRecord").getAll([
        scope.ownerId, scope.businessId, dependency.entityType, dependency.recordId,
      ]),
    }));
    let remaining = dependencyRequests.length;
    const dependencyOperationIds = [];
    const process = () => {
      if (remaining !== 0) return;
      const uniqueOperationIds = [...new Set(dependencyOperationIds)];
      if (coalescible) {
        operations.put({
          ...latest,
          payload: structuredClone(input.payload),
          localSnapshot: structuredClone(input.localSnapshot),
          dependsOnOperationIds: uniqueOperationIds,
          ...(uniqueOperationIds.length === 1 ? { dependsOnOperationId: uniqueOperationIds[0] } : { dependsOnOperationId: undefined }),
          state: uniqueOperationIds.length ? "blocked_dependency" : latest.state === "blocked_dependency" || latest.state === "retryable_error" ? "pending" : latest.state,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      const metadataRequest = syncMetadata.get([scope.ownerId, scope.businessId, scope.entityType, scope.recordId]);
      metadataRequest.onsuccess = () => {
        const remote = metadataRequest.result;
        const dependent = latest && latest.state !== "synced" ? latest : null;
        const operation = remote && Number.isInteger(remote.revision) ? "update" : dependent?.operation === "create" ? "update" : "create";
        if (dependent && !uniqueOperationIds.includes(dependent.operationId)) uniqueOperationIds.push(dependent.operationId);
        operations.add({
          operationId: crypto.randomUUID(),
          ...scope,
          operation,
          baseRevision: operation === "create" ? null : (remote?.revision ?? null),
          baseSnapshot: operation === "create" ? null : (remote?.lastSyncedSnapshot ?? null),
          localSnapshot: structuredClone(input.localSnapshot),
          payload: structuredClone(input.payload),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attemptCount: 0,
          state: uniqueOperationIds.length ? "blocked_dependency" : "pending",
          nextAttemptAt: 0,
          dependsOnOperationIds: uniqueOperationIds,
          ...(uniqueOperationIds.length === 1 ? { dependsOnOperationId: uniqueOperationIds[0] } : {}),
        });
      };
      metadataRequest.onerror = () => fail(metadataRequest.error ?? new Error("Could not read entity sync metadata."));
    };
    for (const item of dependencyRequests) {
      item.request.onsuccess = () => {
        const pending = item.request.result
          .filter((operation) => operation.state !== "synced")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const latestDependency = pending.at(-1);
        if (latestDependency) dependencyOperationIds.push(latestDependency.operationId);
        remaining--;
        process();
      };
      item.request.onerror = () => fail(item.request.error ?? new Error("Could not inspect a parent entity operation."));
    }
    process();
  };
  request.onerror = () => fail(request.error ?? new Error("Could not inspect entity outbox."));
}
