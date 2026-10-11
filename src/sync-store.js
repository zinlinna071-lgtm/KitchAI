import { validateBusinessName } from "./local-store.js";

const DATABASE_NAME = "kitchai-sync";
const DATABASE_VERSION = 2;
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
      const operations = db.objectStoreNames.contains(OPERATION_STORE)
        ? request.transaction.objectStore(OPERATION_STORE)
        : db.createObjectStore(OPERATION_STORE, { keyPath: "operationId" });
      if (!operations.indexNames.contains("byOwner")) operations.createIndex("byOwner", "ownerId", { unique: false });
      if (!operations.indexNames.contains("byOwnerAndRecord")) operations.createIndex("byOwnerAndRecord", ["ownerId", "recordId"], { unique: false });
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
      syncState: "pending",
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

async function mutateOperation(operationId, ownerId, mutate, profileState) {
  const db = await openDatabase();
  const tx = db.transaction(profileState ? [OPERATION_STORE, PROFILE_STORE] : [OPERATION_STORE], "readwrite");
  const store = tx.objectStore(OPERATION_STORE);
  const operation = await requestValue(store.get(operationId));
  if (!operation || operation.ownerId !== requireOwner(ownerId)) throw new Error("Operation is not in the active owner's queue.");
  store.put(mutate(operation));
  if (profileState) {
    const profiles = tx.objectStore(PROFILE_STORE);
    const profile = await requestValue(profiles.get([ownerId, operation.recordId]));
    if (profile) profiles.put({ ...profile, syncState: profileState });
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not update sync operation."));
    tx.onabort = () => reject(tx.error ?? new Error("Sync operation update was aborted."));
  });
}

/** @param {string} operationId @param {string} ownerId */
export function markInFlight(operationId, ownerId) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "in_flight", lastError: null }), "syncing");
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
    profiles.put({ ...current, ...remoteProfile, ownerId, syncState: "synced" });
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
  const tx = db.transaction([PROFILE_STORE, OPERATION_STORE, CONFLICT_STORE], "readwrite");
  const profiles = tx.objectStore(PROFILE_STORE);
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
  const localProfile = await requestValue(profiles.get([ownerId, current.recordId]));
  if (localProfile) profiles.put({ ...localProfile, syncState: "conflict" });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not preserve conflict snapshots."));
    tx.onabort = () => reject(tx.error ?? new Error("Conflict preservation was aborted."));
  });
}

/** @param {string} operationId @param {string} ownerId */
export function pauseForAuth(operationId, ownerId) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "needs_auth" }), "needs_auth");
}

/** @param {string} operationId @param {string} ownerId @param {string} message */
export function markPermanentFailure(operationId, ownerId, message) {
  return mutateOperation(operationId, ownerId, op => ({ ...op, state: "failed_permanent", lastError: message }), "failed_permanent");
}

/** @param {string} operationId @param {string} ownerId @param {number} attemptCount @param {number} nextAttemptAt @param {string} message */
export function scheduleRetry(operationId, ownerId, attemptCount, nextAttemptAt, message) {
  return mutateOperation(operationId, ownerId, op => ({
    ...op, state: "retryable_error", attemptCount, nextAttemptAt, lastError: message,
  }), "retryable_error");
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
  const remote = conflict.remoteSnapshot;
  const targetRecordId = remote?.id ?? conflict.recordId;
  const remapCreateCollision = conflict.baseRevision === null && targetRecordId !== conflict.recordId;
  const localCandidate = {
    ...current,
    ...conflict.localSnapshot,
    ownerId,
    id: targetRecordId,
    ...(remapCreateCollision ? { businessId: remote.businessId, createdAt: remote.createdAt } : {}),
    revision: conflict.remoteRevision,
    syncState: "pending",
  };
  const newOperation = {
    ...operation,
    ownerId,
    recordId: targetRecordId,
    operation: "update",
    baseRevision: conflict.remoteRevision,
    baseSnapshot: structuredClone(remote),
    localSnapshot: structuredClone(localCandidate),
    payload: { name: validateBusinessName(conflict.localSnapshot?.name) },
    attemptCount: 0,
    state: "pending",
    nextAttemptAt: 0,
  };
  if (remapCreateCollision) profiles.delete([ownerId, conflict.recordId]);
  profiles.put(localCandidate);
  const originalOperation = await requestValue(operations.get(conflict.operationId));
  if (originalOperation && originalOperation.ownerId === ownerId) {
    operations.put({ ...originalOperation, state: "conflict_resolved" });
  }
  // Conflict resolution is a new logical write with a new idempotency key;
  // the original operation remains in the local history as conflict_resolved.
  operations.put(newOperation);
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
  if (remote?.id && remote.id !== conflict.recordId) profiles.delete([ownerId, conflict.recordId]);
  profiles.put({ ...remote, ownerId, syncState: "synced" });
  const operation = await requestValue(operations.get(conflict.operationId));
  if (operation && operation.ownerId === ownerId) operations.put({ ...operation, state: "conflict_resolved" });
  conflicts.put({ ...savedConflict, state: "resolved", resolution: { choice: "use_remote", resolvedAt: new Date().toISOString() } });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not apply remote conflict resolution."));
    tx.onabort = () => reject(tx.error ?? new Error("Conflict resolution was aborted."));
  });
}

/**
 * Import an authoritative remote profile only when this owner has no local copy.
 * Pending local work is never overwritten by a remote refresh.
 * @param {string} ownerId
 * @param {any} remoteProfile
 */
export async function adoptRemoteProfile(ownerId, remoteProfile) {
  ownerId = requireOwner(ownerId);
  if (!remoteProfile || remoteProfile.ownerId !== ownerId || !remoteProfile.id) {
    throw new Error("Remote profile does not match the active owner.");
  }
  const db = await openDatabase();
  const tx = db.transaction(PROFILE_STORE, "readwrite");
  const profiles = tx.objectStore(PROFILE_STORE);
  const existing = await requestValue(profiles.get([ownerId, remoteProfile.id]));
  const profile = existing ?? { ...remoteProfile, ownerId, syncState: "synced" };
  if (!existing) profiles.put(profile);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error("Could not import the remote profile."));
    tx.onabort = () => reject(tx.error ?? new Error("Remote profile import was aborted."));
  });
  return profile;
}

/** Reset interrupted in-flight operations after a reload so they can retry with the same ID. @param {string} ownerId */
export async function recoverInterruptedOperations(ownerId) {
  ownerId = requireOwner(ownerId);
  const operations = await listOperations(ownerId);
  let recovered = 0;
  for (const operation of operations) {
    if (operation.state !== "in_flight") continue;
    await mutateOperation(operation.operationId, ownerId, op => ({
      ...op, state: "retryable_error", nextAttemptAt: 0, lastError: "Sync was interrupted; safe retry is pending.",
    }), "retryable_error");
    recovered++;
  }
  return recovered;
}
