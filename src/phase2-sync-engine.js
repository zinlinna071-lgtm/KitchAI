import { openBusinessDatabase } from "./business-data-store.js";

const ACTIVE_STATES = new Set(["pending", "retryable_error", "needs_auth", "blocked_dependency"]);
const TABLE_BY_TYPE = {
  ingredient: "ingredients",
  menuItem: "menu_items",
  recipe: "recipes",
  recipeLine: "recipe_lines",
};
const REMOTE_TYPE_BY_LOCAL = {
  ingredient: "ingredient",
  menuItem: "menu_item",
  recipe: "recipe",
  recipeLine: "recipe_line",
};

/** @param {number} attemptCount @param {{baseDelayMs?:number,maxDelayMs?:number,random?:()=>number}=} options */
export function phase2RetryDelayMs(attemptCount, options = {}) {
  const base = options.baseDelayMs ?? 1000;
  const cap = options.maxDelayMs ?? 5 * 60 * 1000;
  const random = options.random ?? Math.random;
  const exponent = Math.max(0, Math.min(30, attemptCount - 1));
  const ceiling = Math.min(cap, base * (2 ** exponent));
  const jitter = 0.5 + Math.min(1, Math.max(0, random()));
  return Math.floor(Math.min(cap, ceiling * jitter));
}

/**
 * Process one authenticated owner's Phase 2 queue. All transitions must be durable.
 * The same operationId is retained after retry and lost acknowledgement.
 * @param {{
 * ownerId:string,businessId:string,session:{user?:{id?:string},access_token?:string},
 * store:{listOperations:(ownerId:string,businessId:string)=>Promise<any[]>,
 * prepareForDispatch?:(operation:any)=>Promise<any|null>,
 * markInFlight:(operation:any)=>Promise<void>,acknowledge:(operation:any,remoteRecord:any)=>Promise<void>,
 * preserveConflict:(operation:any,remoteRecord:any)=>Promise<void>,pauseForAuth:(operation:any)=>Promise<void>,
 * markPermanentFailure:(operation:any,message:string)=>Promise<void>,scheduleRetry:(operation:any,attemptCount:number,nextAttemptAt:number,message:string)=>Promise<void>,
 * dependenciesSynced:(operation:any)=>Promise<boolean>,releaseDependency:(operation:any)=>Promise<void>},
 * send:(operation:any,session:any)=>Promise<any>,now?:()=>number,random?:()=>number,baseDelayMs?:number,maxDelayMs?:number
 * }} input
 */
export async function syncPhase2Operations(input) {
  if (!input.ownerId || !input.businessId) throw new TypeError("An active owner and business are required.");
  if (!input.session?.access_token || input.session?.user?.id !== input.ownerId) {
    return { synced: 0, conflicts: 0, pausedForAuth: 0, failed: 0, retried: 0, skipped: 0 };
  }
  const now = input.now ?? Date.now;
  const summary = { synced: 0, conflicts: 0, pausedForAuth: 0, failed: 0, retried: 0, skipped: 0 };
  const operations = await input.store.listOperations(input.ownerId, input.businessId);
  operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (let operation of operations) {
    if (operation.ownerId !== input.ownerId || operation.businessId !== input.businessId ||
        !ACTIVE_STATES.has(operation.state)) {
      summary.skipped++;
      continue;
    }
    if (operation.state === "blocked_dependency") {
      if (await input.store.dependenciesSynced(operation)) await input.store.releaseDependency(operation);
      else { summary.skipped++; continue; }
    }
    if (operation.state === "needs_auth") {
      // A fresh authenticated session for the same owner is the only event that resumes this queue.
      operation.state = "pending";
    }
    if (operation.nextAttemptAt !== undefined && operation.nextAttemptAt > now()) {
      summary.skipped++;
      continue;
    }
    if (input.store.prepareForDispatch) {
      const prepared = await input.store.prepareForDispatch(operation);
      if (!prepared) {
        await input.store.markPermanentFailure(operation, "This update has no confirmed remote revision. Local data was preserved; manual recovery is required.");
        summary.failed++;
        continue;
      }
      operation = prepared;
    }

    await input.store.markInFlight(operation);
    try {
      const result = await input.send(operation, input.session);
      if (result?.status === "accepted" && result.remoteRecord) {
        await input.store.acknowledge(operation, result.remoteRecord);
        summary.synced++;
      } else if (result?.status === "conflict" && result.remoteRecord) {
        await input.store.preserveConflict(operation, result.remoteRecord);
        summary.conflicts++;
      } else if (result?.status === "auth_required") {
        await input.store.pauseForAuth(operation);
        summary.pausedForAuth++;
        break;
      } else if (result?.status === "permanent_error") {
        await input.store.markPermanentFailure(operation, result.message || "The server rejected this change.");
        summary.failed++;
      } else {
        throw new Error("Entity sync transport returned an unsupported result.");
      }
    } catch (error) {
      const attempts = (operation.attemptCount ?? 0) + 1;
      const delay = phase2RetryDelayMs(attempts, {
        baseDelayMs: input.baseDelayMs, maxDelayMs: input.maxDelayMs, random: input.random,
      });
      const message = error instanceof Error ? error.message : "Temporary entity sync failure.";
      await input.store.scheduleRetry(operation, attempts, now() + delay, message);
      summary.retried++;
    }
  }
  return summary;
}

/** Convert an IndexedDB row to the local camelCase snapshot used by Phase 2 stores. */
export function normalizeRemoteEntity(entityType, row) {
  if (!row) return null;
  const common = {
    id: row.id,
    ownerId: row.owner_id,
    businessId: row.business_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: Number(row.revision),
  };
  if (entityType === "ingredient" || entityType === "menuItem") {
    return { ...common, name: row.name, ...(row.description ? { description: row.description } : {}) };
  }
  if (entityType === "recipe") {
    return {
      ...common, menuItemId: row.menu_item_id, name: row.name,
      ...(row.description ? { description: row.description } : {}),
      ...(row.instructions ? { instructions: row.instructions } : {}),
      ...(row.yield_portions != null ? { yieldPortions: Number(row.yield_portions) } : {}),
    };
  }
  if (entityType === "recipeLine") {
    return {
      ...common, recipeId: row.recipe_id, ingredientId: row.ingredient_id,
      quantity: Number(row.quantity), unit: row.unit, position: row.position,
      ...(row.note ? { note: row.note } : {}),
    };
  }
  throw new TypeError("Unsupported Phase 2 entity type.");
}

function payloadFromEntitySnapshot(entityType, snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new TypeError("A local entity snapshot is required.");
  if (entityType === "ingredient" || entityType === "menuItem") {
    return { name: snapshot.name, ...(snapshot.description ? { description: snapshot.description } : {}), status: snapshot.status };
  }
  if (entityType === "recipe") {
    return {
      menuItemId: snapshot.menuItemId, name: snapshot.name,
      ...(snapshot.description ? { description: snapshot.description } : {}),
      ...(snapshot.instructions ? { instructions: snapshot.instructions } : {}),
      ...(snapshot.yieldPortions != null ? { yieldPortions: snapshot.yieldPortions } : {}),
      status: snapshot.status,
    };
  }
  if (entityType === "recipeLine") {
    return {
      recipeId: snapshot.recipeId, ingredientId: snapshot.ingredientId,
      quantity: snapshot.quantity, unit: snapshot.unit, position: snapshot.position,
      ...(snapshot.note ? { note: snapshot.note } : {}),
    };
  }
  throw new TypeError("Unsupported Phase 2 entity type.");
}

function localStoreName(entityType) {
  const name = TABLE_BY_TYPE[entityType];
  if (!name) throw new TypeError("Unsupported Phase 2 entity type.");
  return name === "menu_items" ? "menuItems" : name === "recipe_lines" ? "recipeLines" : name;
}

/** Durable IndexedDB operations for the Phase 2 outbox. */
export function createPhase2SyncStore() {
  async function transaction(storeNames, mode, action) {
    const db = await openBusinessDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      let value;
      try { value = action(tx); } catch (error) { try { tx.abort(); } catch {} reject(error); return; }
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error("Phase 2 sync storage failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Phase 2 sync transaction was aborted."));
    });
  }

  return {
    async listOperations(ownerId, businessId) {
      const db = await openBusinessDatabase();
      const tx = db.transaction("operations", "readonly");
      const request = tx.objectStore("operations").index("byOwner").getAll(ownerId);
      const rows = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not read Phase 2 outbox."));
      });
      return /** @type {any[]} */ (rows).filter(row => row.businessId === businessId);
    },
    async markInFlight(operation) {
      await transaction(["operations"], "readwrite", tx => {
        tx.objectStore("operations").put({ ...operation, state: "in_flight", updatedAt: new Date().toISOString() });
      });
    },
    async prepareForDispatch(operation) {
      if (operation.operation === "create") return operation;
      const db = await openBusinessDatabase();
      const tx = db.transaction("syncMetadata", "readonly");
      const request = tx.objectStore("syncMetadata").get([operation.ownerId, operation.businessId, operation.entityType, operation.recordId]);
      const metadata = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not read entity revision metadata."));
      });
      if (operation.dependsOnOperationIds?.length) {
        if (!Number.isInteger(metadata?.revision) || metadata.revision < 1) return null;
        return { ...operation, baseRevision: metadata.revision, baseSnapshot: structuredClone(metadata.lastSyncedSnapshot ?? null) };
      }
      if (!Number.isInteger(operation.baseRevision) || operation.baseRevision < 1) return null;
      return operation;
    },
    async acknowledge(operation, remoteRecord) {
      const entityType = operation.entityType;
      const table = TABLE_BY_TYPE[entityType];
      if (!table) throw new TypeError("Unsupported Phase 2 entity type.");
      const normalizedRemote = normalizeRemoteEntity(entityType, remoteRecord);
      const normalized = normalizedRemote ? { ...normalizedRemote, businessId: operation.businessId } : null;
      if (!normalized || normalized.id !== operation.recordId || normalized.ownerId !== operation.ownerId) {
        throw new Error("Remote acknowledgement does not match the queued entity scope.");
      }
      const stores = ["operations", "syncMetadata", table];
      if (operation.resolvesConflictId) stores.push("conflicts");
      await transaction(stores, "readwrite", tx => {
        tx.objectStore("syncMetadata").put({
          ownerId: operation.ownerId, businessId: operation.businessId, entityType,
          recordId: operation.recordId, revision: normalized.revision,
          lastSyncedSnapshot: structuredClone(normalized), syncedAt: new Date().toISOString(),
        });
        tx.objectStore("operations").put({
          ...operation, state: "synced", remoteRevision: normalized.revision,
          updatedAt: new Date().toISOString(), lastError: undefined,
        });
        if (operation.resolvesConflictId) {
          const conflicts = tx.objectStore("conflicts");
          const conflictRequest = conflicts.get(operation.resolvesConflictId);
          conflictRequest.onsuccess = () => {
            const conflict = conflictRequest.result;
            if (conflict && conflict.ownerId === operation.ownerId && conflict.businessId === operation.businessId) {
              conflicts.put({ ...conflict, state: "resolved", resolutionChoice: "keep_local", resolvedAt: new Date().toISOString() });
            }
          };
        }
        const recordStore = tx.objectStore(table === "menu_items" ? "menuItems" : table === "recipe_lines" ? "recipeLines" : table);
        const key = [operation.ownerId, operation.businessId, operation.recordId];
        const request = recordStore.get(key);
        request.onsuccess = () => {
          const local = request.result;
          if (local) recordStore.put({ ...local, revision: normalized.revision });
        };
      });
    },
    async preserveConflict(operation, remoteRecord) {
      const normalizedRemote = normalizeRemoteEntity(operation.entityType, remoteRecord);
      const normalized = normalizedRemote ? { ...normalizedRemote, businessId: operation.businessId } : null;
      if (!normalized || normalized.id !== operation.recordId || normalized.ownerId !== operation.ownerId) {
        throw new Error("Conflict response does not match the queued entity scope.");
      }
      const db = await openBusinessDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["operations", "conflicts"], "readwrite");
        const conflict = {
          conflictId: crypto.randomUUID(), operationId: operation.operationId,
          ...(operation.resolvesConflictId ? { supersedesConflictId: operation.resolvesConflictId } : {}),
          ownerId: operation.ownerId, businessId: operation.businessId,
          entityType: operation.entityType, recordId: operation.recordId,
          baseRevision: operation.baseRevision, baseSnapshot: structuredClone(operation.baseSnapshot ?? null),
          localSnapshot: structuredClone(operation.localSnapshot),
          remoteSnapshot: structuredClone(normalized), remoteRevision: normalized.revision,
          detectedAt: new Date().toISOString(), state: "unresolved",
        };
        tx.objectStore("conflicts").add(conflict);
        tx.objectStore("operations").put({ ...operation, state: "conflict", updatedAt: new Date().toISOString() });
        if (operation.resolvesConflictId) {
          const conflicts = tx.objectStore("conflicts");
          const priorRequest = conflicts.get(operation.resolvesConflictId);
          priorRequest.onsuccess = () => {
            const prior = priorRequest.result;
            if (prior && prior.ownerId === operation.ownerId && prior.businessId === operation.businessId) {
              conflicts.put({ ...prior, state: "superseded", supersededByConflictId: conflict.conflictId, updatedAt: new Date().toISOString() });
            }
          };
        }
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error ?? new Error("Could not preserve Phase 2 conflict."));
        tx.onabort = () => reject(tx.error ?? new Error("Phase 2 conflict was not preserved."));
      });
    },
    async pauseForAuth(operation) {
      await transaction(["operations"], "readwrite", tx => {
        tx.objectStore("operations").put({ ...operation, state: "needs_auth", updatedAt: new Date().toISOString() });
      });
    },
    async markPermanentFailure(operation, message) {
      const stores = ["operations"];
      if (operation.resolvesConflictId) stores.push("conflicts");
      await transaction(stores, "readwrite", tx => {
        tx.objectStore("operations").put({ ...operation, state: "permanent_error", lastError: message, updatedAt: new Date().toISOString() });
        if (operation.resolvesConflictId) {
          const conflicts = tx.objectStore("conflicts");
          const request = conflicts.get(operation.resolvesConflictId);
          request.onsuccess = () => {
            const conflict = request.result;
            if (conflict && conflict.ownerId === operation.ownerId && conflict.businessId === operation.businessId) {
              conflicts.put({ ...conflict, state: "unresolved", resolutionChoice: undefined, resolutionOperationId: undefined, lastResolutionError: message, updatedAt: new Date().toISOString() });
            }
          };
        }
      });
    },
    async scheduleRetry(operation, attemptCount, nextAttemptAt, message) {
      await transaction(["operations"], "readwrite", tx => {
        tx.objectStore("operations").put({
          ...operation, state: "retryable_error", attemptCount, nextAttemptAt,
          lastError: message, updatedAt: new Date().toISOString(),
        });
      });
    },
    async dependenciesSynced(operation) {
      if (!operation.dependsOnOperationIds?.length) return true;
      const db = await openBusinessDatabase();
      const tx = db.transaction("operations", "readonly");
      const store = tx.objectStore("operations");
      const rows = await Promise.all(operation.dependsOnOperationIds.map(id => new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not inspect an entity dependency."));
      })));
      return rows.every(row => row?.state === "synced");
    },
    async releaseDependency(operation) {
      await transaction(["operations"], "readwrite", tx => {
        tx.objectStore("operations").put({ ...operation, state: "pending", nextAttemptAt: 0, updatedAt: new Date().toISOString() });
      });
    },
    async recoverInterrupted(ownerId, businessId, now = Date.now()) {
      const operations = await this.listOperations(ownerId, businessId);
      const interrupted = operations.filter(row => row.state === "in_flight");
      if (!interrupted.length) return 0;
      await transaction(["operations"], "readwrite", tx => {
        for (const operation of interrupted) {
          tx.objectStore("operations").put({
            ...operation, state: "retryable_error", nextAttemptAt: now,
            lastError: "Recovered an interrupted sync attempt; retrying with the same operation ID.",
            updatedAt: new Date().toISOString(),
          });
        }
      });
      return interrupted.length;
    },
    async resolveKeepLocal(conflict) {
      if (!conflict || conflict.state !== "unresolved" || !conflict.ownerId || !conflict.businessId ||
          !conflict.remoteSnapshot || !conflict.localSnapshot || !Number.isInteger(conflict.remoteRevision) || conflict.remoteRevision < 1) {
        throw new Error("This conflict is not ready for resolution.");
      }
      const operation = {
        operationId: crypto.randomUUID(), ownerId: conflict.ownerId, businessId: conflict.businessId,
        entityType: conflict.entityType, recordId: conflict.recordId, operation: "update",
        baseRevision: conflict.remoteRevision, baseSnapshot: structuredClone(conflict.remoteSnapshot),
        localSnapshot: structuredClone(conflict.localSnapshot),
        payload: payloadFromEntitySnapshot(conflict.entityType, conflict.localSnapshot),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        attemptCount: 0, state: "pending", nextAttemptAt: 0, dependsOnOperationIds: [],
        resolvesConflictId: conflict.conflictId,
      };
      const db = await openBusinessDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["operations", "conflicts"], "readwrite");
        const conflicts = tx.objectStore("conflicts");
        const request = conflicts.get(conflict.conflictId);
        request.onsuccess = () => {
          const current = request.result;
          if (!current || current.ownerId !== conflict.ownerId || current.businessId !== conflict.businessId || current.state !== "unresolved") {
            try { tx.abort(); } catch {}
            reject(new Error("Conflict changed before resolution; refresh and review it again."));
            return;
          }
          tx.objectStore("operations").add(operation);
          conflicts.put({ ...current, state: "resolution_pending", resolutionChoice: "keep_local", resolutionOperationId: operation.operationId, updatedAt: new Date().toISOString() });
        };
        request.onerror = () => reject(request.error ?? new Error("Could not verify conflict state."));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error ?? new Error("Could not queue conflict resolution."));
        tx.onabort = () => reject(tx.error ?? new Error("Conflict resolution was not queued."));
      });
      return operation;
    },
    async resolveUseRemote(conflict) {
      if (!conflict || conflict.state !== "unresolved" || !conflict.ownerId || !conflict.businessId ||
          !conflict.remoteSnapshot || !Number.isInteger(conflict.remoteRevision) || conflict.remoteRevision < 1) {
        throw new Error("This conflict is not ready for resolution.");
      }
      const storeName = localStoreName(conflict.entityType);
      const remote = { ...structuredClone(conflict.remoteSnapshot), businessId: conflict.businessId };
      if (remote.ownerId !== conflict.ownerId || remote.id !== conflict.recordId || remote.revision !== conflict.remoteRevision) {
        throw new Error("The preserved remote snapshot does not match this conflict.");
      }
      const db = await openBusinessDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([storeName, "operations", "syncMetadata", "conflicts"], "readwrite");
        const conflicts = tx.objectStore("conflicts");
        const request = conflicts.get(conflict.conflictId);
        request.onsuccess = () => {
          const current = request.result;
          if (!current || current.ownerId !== conflict.ownerId || current.businessId !== conflict.businessId || current.state !== "unresolved") {
            try { tx.abort(); } catch {}
            reject(new Error("Conflict changed before resolution; refresh and review it again."));
            return;
          }
          const operationStore = tx.objectStore("operations");
          const matching = operationStore.index("byOwnerBusinessEntityRecord").getAll([
            conflict.ownerId, conflict.businessId, conflict.entityType, conflict.recordId,
          ]);
          matching.onsuccess = () => {
            for (const operation of matching.result) {
              if (!["synced", "permanent_error", "superseded"].includes(operation.state)) {
                operationStore.put({ ...operation, state: "superseded", supersededAt: new Date().toISOString(), lastError: "Superseded by the explicit remote-version conflict choice." });
              }
            }
          };
          tx.objectStore(storeName).put(remote);
          tx.objectStore("syncMetadata").put({
            ownerId: conflict.ownerId, businessId: conflict.businessId, entityType: conflict.entityType,
            recordId: conflict.recordId, revision: conflict.remoteRevision,
            lastSyncedSnapshot: structuredClone(remote), syncedAt: new Date().toISOString(),
          });
          conflicts.put({ ...current, state: "resolved", resolutionChoice: "use_remote", resolvedAt: new Date().toISOString() });
        };
        request.onerror = () => reject(request.error ?? new Error("Could not verify conflict state."));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error ?? new Error("Could not apply remote conflict resolution."));
        tx.onabort = () => reject(tx.error ?? new Error("Remote conflict resolution was not applied."));
      });
    },
    async listConflicts(ownerId, businessId) {
      const db = await openBusinessDatabase();
      const tx = db.transaction("conflicts", "readonly");
      const request = tx.objectStore("conflicts").index("byOwnerBusiness").getAll([ownerId, businessId]);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not read Phase 2 conflicts."));
      });
    },
  };
}

/** @param {any} operation @param {any} session @param {(path:string,init:any)=>Promise<any>=} requestFn */
export async function sendPhase2EntityOperation(operation, session, requestFn) {
  if (!session?.access_token || session?.user?.id !== operation.ownerId) return { status: "auth_required" };
  const entityType = REMOTE_TYPE_BY_LOCAL[operation.entityType];
  if (!entityType) return { status: "permanent_error", message: "Unsupported Phase 2 entity type." };
  const request = requestFn ?? (async (path, init) => {
    const config = /** @type {any} */ (globalThis).KITCHAI_CONFIG ?? {};
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Supabase is not configured.");
    let response;
    try {
      response = await fetch(config.supabaseUrl.replace(/\/$/, "") + path, {
        ...init,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Network unavailable.");
    }
    const text = await response.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    if (!response.ok) {
      const error = new Error(data?.message ?? data?.msg ?? "Supabase entity request failed.");
      Object.assign(error, { status: response.status, code: data?.code });
      throw error;
    }
    return data;
  });
  try {
    const result = await request("/rest/v1/rpc/apply_phase2_entity_operation", {
      method: "POST",
      body: JSON.stringify({
        p_operation_id: operation.operationId,
        p_entity_type: entityType,
        p_record_id: operation.recordId,
        p_operation: operation.operation,
        p_base_revision: operation.baseRevision,
        p_payload: operation.payload,
      }),
    });
    if (result?.status === "accepted" && result.record) {
      return { status: "accepted", remoteRecord: result.record };
    }
    if (result?.status === "conflict" && result.remoteRecord) {
      return { status: "conflict", remoteRecord: result.remoteRecord };
    }
    return { status: "permanent_error", message: "Supabase returned an unsupported entity result." };
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    if (status === 401) return { status: "auth_required" };
    if (status === 403 || status === 400 || status === 422 || code === "42501" || code === "22023") {
      return { status: "permanent_error", message: error instanceof Error ? error.message : "The server rejected this change." };
    }
    throw error;
  }
}
