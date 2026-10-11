import { validateBusinessName } from "./local-store.js";

const DATABASE_NAME = "kitchai-sync";
const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const OPERATION_STORE = "operations";
const CONFLICT_STORE = "conflicts";
let databasePromise;

/** @param {string} ownerId */
function requireOwner(ownerId) {
  if (typeof ownerId !== "string" || !ownerId.trim()) throw new TypeError("An owner scope is required.");
  return ownerId;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        const profiles = db.createObjectStore(PROFILE_STORE, { keyPath: ["ownerId", "id"] });
        profiles.createIndex("byOwner", "ownerId", { unique: false });
      }
      if (!db.objectStoreNames.contains(OPERATION_STORE)) {
        const operations = db.createObjectStore(OPERATION_STORE, { keyPath: "operationId" });
        operations.createIndex("byOwner", "ownerId", { unique: false });
        operations.createIndex("byOwnerAndRecord", ["ownerId", "recordId"], { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
        const conflicts = db.createObjectStore(CONFLICT_STORE, { keyPath: "conflictId" });
        conflicts.createIndex("byOwner", "ownerId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error ?? new Error("Could not open sync storage.")); };
    request.onblocked = () => reject(new Error("Sync storage upgrade is blocked by another KitchAI tab."));
  });
  return databasePromise;
}

/** @template T @param {IDBRequest<T>} request */
function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Sync storage request failed."));
  });
}

/**
 * Persist an owner-partitioned local profile and its outbox operation atomically.
 * ownerId is only a local partition key; the server must derive ownership from auth.
 * @param {{ownerId:string,id?:string,name:unknown,baseRevision?:number|null}} input
 */
export async function saveOwnerProfileDraft(input) {
  const ownerId = requireOwner(input.ownerId);
  const name = validateBusinessName(input.name);
  const db = await openDatabase();
  const tx = db.transaction([PROFILE_STORE, OPERATION_STORE], "readwrite");
  const profiles = tx.objectStore(PROFILE_STORE);
  const operations = tx.objectStore(OPERATION_STORE);
  const id = input.id ?? crypto.randomUUID();
  let result;
  const fail = error => { try { tx.abort(); } catch {} throw error; };

  try {
    const existing = input.id ? await requestValue(profiles.get([ownerId, id])) : null;
    if (input.id && !existing) throw new Error("This profile is not in the active owner's local workspace.");
    const now = new Date().toISOString();
    const profile = {
      ownerId,
      id,
      businessId: existing?.businessId ?? crypto.randomUUID(),
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.revision ? { revision: existing.revision } : {}),
    };
    const queuedForRecord = await requestValue(operations.index("byOwnerAndRecord").getAll([ownerId, id]));
    const pendingCreate = queuedForRecord.find(op => op.operation === "create" && ["pending", "retryable_error"].includes(op.state));
    if (existing && !Number.isInteger(input.baseRevision ?? existing.revision)) {
      if (!pendingCreate) throw new Error("An authoritative base revision is required before updating a synced profile.");
      const coalesced = { ...pendingCreate, payload: { name }, localSnapshot: structuredClone(profile) };
      profiles.put(profile);
      operations.put(coalesced);
      result = { profile, operation: coalesced };
    } else {
      const operationId = crypto.randomUUID();
      const operation = {
        operationId,
        ownerId,
        recordId: id,
        operation: existing ? "update" : "create",
        baseRevision: existing ? (input.baseRevision ?? existing.revision) : null,
        baseSnapshot: existing ? structuredClone(existing) : null,
        localSnapshot: structuredClone(profile),
        payload: { name },
        createdAt: now,
        attemptCount: 0,
        state: "pending",
        nextAttemptAt: 0,
      };
      profiles.put(profile);
      operations.add(operation);
      result = { profile, operation };
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the profile and outbox operation."));
      tx.onabort = () => reject(tx.error ?? new Error("Profile and outbox operation were not saved."));
    });
    return result;
  } catch (error) {
    try { tx.abort(); } catch {}
    throw error;
  }
}

/** @param {string} ownerId */
export async function listOwnerProfiles(ownerId) {
  const db = await openDatabase();
  const tx = db.transaction(PROFILE_STORE, "readonly");
  const records = await requestValue(tx.objectStore(PROFILE_STORE).index("byOwner").getAll(requireOwner(ownerId)));
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** @param {string} ownerId */
export async function listOperations(ownerId) {
  const db = await openDatabase();
  const tx = db.transaction(OPERATION_STORE, "readonly");
  const operations = await requestValue(tx.objectStore(OPERATION_STORE).index("byOwner").getAll(requireOwner(ownerId)));
  return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function mutateOperation(operationId, ownerId, mutate) {
  const db = await openDatabase();
  const tx = db.transaction(OPERATION_STORE, "readwrite");
  const store = tx.objectStore(OPERATION_STORE);
  const operation = await requestValue(store.get(operationId));
  if (!operation || operation.ownerId !== requireOwner(ownerId)) throw new Error("Operation is not in the active owner's queue.");
  store.put(mutate(operation));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not update sync operation."));
    tx.onabort = () => reject(tx.error ?? new Error("Sync operation update was aborted."));
  });
}

/** @param {string} operationId @param {string} ownerId */
export function markInFlight(operationId, ownerId) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "in_flight", lastError: null }));
}

/** @param {string} operationId @param {string} ownerId @param {any} remoteProfile */
export async function acknowledge(operationId, ownerId, remoteProfile) {
  const db = await openDatabase();
  const tx = db.transaction([PROFILE_STORE, OPERATION_STORE], "readwrite");
  const operations = tx.objectStore(OPERATION_STORE);
  const profiles = tx.objectStore(PROFILE_STORE);
  const operation = await requestValue(operations.get(operationId));
  if (!operation || operation.ownerId !== requireOwner(ownerId)) throw new Error("Operation is not in the active owner's queue.");
  const current = await requestValue(profiles.get([ownerId, operation.recordId]));
  if (current && remoteProfile && remoteProfile.id === operation.recordId) {
    profiles.put({ ...current, ...remoteProfile, ownerId });
  }
  operations.delete(operationId);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not acknowledge synced operation."));
    tx.onabort = () => reject(tx.error ?? new Error("Sync acknowledgement was aborted."));
  });
}

/** @param {any} operation @param {any} remoteProfile */
export async function preserveConflict(operation, remoteProfile) {
  const ownerId = requireOwner(operation.ownerId);
  const db = await openDatabase();
  const tx = db.transaction([OPERATION_STORE, CONFLICT_STORE], "readwrite");
  const operations = tx.objectStore(OPERATION_STORE);
  const conflicts = tx.objectStore(CONFLICT_STORE);
  const current = await requestValue(operations.get(operation.operationId));
  if (!current || current.ownerId !== ownerId) throw new Error("Operation is not in the active owner's queue.");
  const conflict = {
    conflictId: crypto.randomUUID(),
    operationId: current.operationId,
    ownerId,
    recordId: current.recordId,
    baseRevision: current.baseRevision,
    baseSnapshot: current.baseSnapshot,
    localSnapshot: current.localSnapshot,
    remoteSnapshot: structuredClone(remoteProfile),
    remoteRevision: remoteProfile?.revision,
    detectedAt: new Date().toISOString(),
    state: "unresolved",
  };
  conflicts.add(conflict);
  operations.put({ ...current, state: "conflict", conflictId: conflict.conflictId });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not preserve conflict snapshots."));
    tx.onabort = () => reject(tx.error ?? new Error("Conflict preservation was aborted."));
  });
}

/** @param {string} operationId @param {string} ownerId */
export function pauseForAuth(operationId, ownerId) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "needs_auth" }));
}

/** @param {string} operationId @param {string} ownerId @param {string} message */
export function markPermanentFailure(operationId, ownerId, message) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "failed_permanent", lastError: message }));
}

/** @param {string} operationId @param {string} ownerId @param {number} attemptCount @param {number} nextAttemptAt @param {string} message */
export function scheduleRetry(operationId, ownerId, attemptCount, nextAttemptAt, message) {
  return mutateOperation(operationId, ownerId, op => ({
    ...op, state: "retryable_error", attemptCount, nextAttemptAt, lastError: message,
  }));
}

/** @param {string} ownerId */
export async function listConflicts(ownerId) {
  const db = await openDatabase();
  const tx = db.transaction(CONFLICT_STORE, "readonly");
  const conflicts = await requestValue(tx.objectStore(CONFLICT_STORE).index("byOwner").getAll(requireOwner(ownerId)));
  return conflicts.sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
}

/** @param {any} conflict @param {string} ownerId @param {any} operation */
export async function keepLocalAndResolve(conflict, ownerId, operation) {
  ownerId = requireOwner(ownerId);
  if (conflict.ownerId !== ownerId) throw new Error("Conflict belongs to a different owner.");
  const db = await openDatabase();
  const tx = db.transaction([PROFILE_STORE, OPERATION_STORE, CONFLICT_STORE], "readwrite");
  const profiles = tx.objectStore(PROFILE_STORE);
  const operations = tx.objectStore(OPERATION_STORE);
  const conflicts = tx.objectStore(CONFLICT_STORE);
  const savedConflict = await requestValue(conflicts.get(conflict.conflictId));
  if (!savedConflict || savedConflict.ownerId !== ownerId || savedConflict.state !== "unresolved") throw new Error("Conflict is not unresolved in the active owner's workspace.");
  const current = await requestValue(profiles.get([ownerId, conflict.recordId]));
  if (!current) throw new Error("Local profile is missing; conflict remains unresolved.");
  const newOperation = {
    ...operation,
    ownerId,
    recordId: conflict.recordId,
    operation: "update",
    baseRevision: conflict.remoteRevision,
    baseSnapshot: structuredClone(conflict.remoteSnapshot),
    localSnapshot: structuredClone(conflict.localSnapshot),
    payload: { name: validateBusinessName(conflict.localSnapshot?.name) },
    attemptCount: 0,
    state: "pending",
    nextAttemptAt: 0,
  };
  operations.add(newOperation);
  conflicts.put({ ...savedConflict, state: "resolved", resolution: { choice: "keep_local", resolvedAt: new Date().toISOString() } });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not enqueue conflict resolution."));
    tx.onabort = () => reject(tx.error ?? new Error("Conflict resolution was aborted."));
  });
}

/** @param {any} conflict @param {string} ownerId */
export async function applyRemoteAndResolve(conflict, ownerId) {
  ownerId = requireOwner(ownerId);
  if (conflict.ownerId !== ownerId) throw new Error("Conflict belongs to a different owner.");
  const db = await openDatabase();
  const tx = db.transaction([PROFILE_STORE, OPERATION_STORE, CONFLICT_STORE], "readwrite");
  const profiles = tx.objectStore(PROFILE_STORE);
  const operations = tx.objectStore(OPERATION_STORE);
  const conflicts = tx.objectStore(CONFLICT_STORE);
  const savedConflict = await requestValue(conflicts.get(conflict.conflictId));
  if (!savedConflict || savedConflict.ownerId !== ownerId || savedConflict.state !== "unresolved") throw new Error("Conflict is not unresolved in the active owner's workspace.");
  const remote = conflict.remoteSnapshot;
  profiles.put({ ...remote, ownerId });
  const operation = await requestValue(operations.get(conflict.operationId));
  if (operation && operation.ownerId === ownerId) operations.put({ ...operation, state: "conflict_resolved" });
  conflicts.put({ ...savedConflict, state: "resolved", resolution: { choice: "use_remote", resolvedAt: new Date().toISOString() } });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not apply remote conflict resolution."));
    tx.onabort = () => reject(tx.error ?? new Error("Conflict resolution was aborted."));
  });
}
