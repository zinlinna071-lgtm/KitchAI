import { openBusinessDatabase } from "./business-data-store.js";
import { recordFinishedLotCarryForward as postCarryForward } from "./supabase-api.js";

const STORE = "finishedLotHandlingEvents";

/** @param {unknown} value @param {string} label */
function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}

function normalizeScope(scope) {
  return {
    ownerId: requireText(scope?.ownerId, "Owner scope"),
    businessId: requireText(scope?.businessId, "Local business partition"),
  };
}

function immutablePayload(decision) {
  return {
    eventId: requireText(decision?.eventId, "Carry-forward event ID"),
    remoteBusinessId: requireText(decision?.businessId, "Server business ID"),
    lotId: requireText(decision?.lotId, "Finished lot ID"),
    dispositionType: decision?.dispositionType,
    quantity: requireText(decision?.quantity, "Carry-forward quantity"),
    unit: requireText(decision?.unit, "Carry-forward unit"),
    carryForwardDate: requireText(decision?.carryForwardDate, "Carry-forward date"),
    confirmedAt: requireText(decision?.confirmedAt, "Carry-forward confirmation timestamp"),
    reason: typeof decision?.reason === "string" ? decision.reason : "",
    inventoryEffect: decision?.inventoryEffect,
  };
}

/**
 * Save a carry-forward decision to IndexedDB before attempting cloud delivery.
 * Local business partition and server-issued business ID are intentionally separate.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {any} decision
 */
export async function saveCarryForwardDecision(scope, decision) {
  const partition = normalizeScope(scope);
  const payload = immutablePayload(decision);
  if (payload.dispositionType !== "carry_forward" || payload.inventoryEffect !== "none") {
    throw new Error("Only a no-stock-effect carry-forward decision can be saved here.");
  }
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const key = [partition.ownerId, partition.businessId, payload.eventId];
    const get = store.get(key);
    let result;
    let failure;
    get.onsuccess = () => {
      const existing = get.result;
      if (existing) {
        const existingPayload = {
          eventId: existing.eventId,
          remoteBusinessId: existing.remoteBusinessId,
          lotId: existing.lotId,
          dispositionType: existing.dispositionType,
          quantity: existing.quantity,
          unit: existing.unit,
          carryForwardDate: existing.carryForwardDate,
          confirmedAt: existing.confirmedAt,
          reason: existing.reason ?? "",
          inventoryEffect: existing.inventoryEffect,
        };
        if (JSON.stringify(existingPayload) !== JSON.stringify(payload)) {
          failure = new Error("Carry-forward event ID is already used by a different local decision.");
          tx.abort();
          return;
        }
        result = existing;
        return;
      }
      const now = new Date().toISOString();
      result = {
        ...partition,
        ...payload,
        state: "pending_sync",
        syncAttempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.add(result);
    };
    get.onerror = () => { failure = get.error ?? new Error("Could not inspect carry-forward event store."); tx.abort(); };
    tx.oncomplete = () => resolve(structuredClone(result));
    tx.onerror = () => reject(failure ?? tx.error ?? new Error("Could not save carry-forward decision."));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Carry-forward save was aborted."));
  });
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listCarryForwardDecisions(scope) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt)));
    request.onerror = () => reject(request.error ?? new Error("Could not read carry-forward decisions."));
  });
}

async function mutateEvent(scope, eventId, mutate) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get([partition.ownerId, partition.businessId, eventId]);
    let result;
    let failure;
    request.onsuccess = () => {
      if (!request.result) {
        failure = new Error("Carry-forward decision was not found in the local business partition.");
        tx.abort();
        return;
      }
      try {
        result = mutate(structuredClone(request.result));
        store.put(result);
      } catch (error) {
        failure = error instanceof Error ? error : new Error("Could not update carry-forward sync state.");
        tx.abort();
      }
    };
    request.onerror = () => { failure = request.error ?? new Error("Could not load carry-forward decision."); tx.abort(); };
    tx.oncomplete = () => resolve(structuredClone(result));
    tx.onerror = () => reject(failure ?? tx.error ?? new Error("Could not update carry-forward sync state."));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Carry-forward state update was aborted."));
  });
}

/**
 * Deliver a locally persisted carry-forward event. Retries always reuse its event ID and payload.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {string} eventId
 * @param {any} session
 */
export async function syncCarryForwardDecision(scope, eventId, session) {
  const partition = normalizeScope(scope);
  requireText(eventId, "Carry-forward event ID");
  if (!session?.access_token || !session?.user?.id || session.user.id !== partition.ownerId) {
    throw new Error("Sign in as the owner of this business before syncing carry-forward.");
  }
  let event = await mutateEvent(partition, eventId, (current) => {
    if (current.state === "synced") return current;
    const now = new Date().toISOString();
    return {
      ...current,
      state: "syncing",
      syncAttempts: (current.syncAttempts ?? 0) + 1,
      lastAttemptAt: now,
      updatedAt: now,
      lastError: null,
    };
  });
  if (event.state === "synced") return event;
  try {
    const result = await postCarryForward({
      eventId: event.eventId,
      businessId: event.remoteBusinessId,
      lotId: event.lotId,
      quantity: event.quantity,
      unit: event.unit,
      carryForwardDate: event.carryForwardDate,
      confirmedAt: event.confirmedAt,
      ...(event.reason ? { reason: event.reason } : {}),
    }, session);
    return await mutateEvent(partition, eventId, (current) => {
      if (current.remoteBusinessId !== event.remoteBusinessId ||
          current.lotId !== event.lotId || current.quantity !== event.quantity) {
        throw new Error("Carry-forward payload changed during sync; manual review is required.");
      }
      return {
        ...current,
        state: "synced",
        syncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverResult: structuredClone(result),
        lastError: null,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Carry-forward sync failed.";
    await mutateEvent(partition, eventId, (current) => current.state === "synced" ? current : ({
      ...current,
      state: "retryable_error",
      updatedAt: new Date().toISOString(),
      lastError: message.slice(0, 500),
    }));
    throw error;
  }
}
