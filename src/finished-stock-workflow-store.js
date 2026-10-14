import { openBusinessDatabase } from "./business-data-store.js";
import { readFinishedStock as readRemoteFinishedStock, applyInventoryCommand } from "./supabase-api.js";

const SNAPSHOT_STORE = "finishedStockSnapshots";
const COMMAND_STORE = "finishedStockCommands";

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

function requestResult(request, fallback) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(fallback));
  });
}

function transactionResult(tx, getResult) {
  return new Promise((resolve, reject) => {
    let result;
    if (getResult) getResult(value => { result = value; });
    tx.oncomplete = () => resolve(structuredClone(result));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

/**
 * Refresh the canonical finished-lot and allocation snapshot from Supabase, then cache it locally.
 * @param {{ownerId:string,businessId:string}} scope Local partition scope.
 * @param {string} remoteBusinessId Server-issued business UUID.
 * @param {any} session Authenticated owner session.
 */
export async function refreshFinishedStock(scope, remoteBusinessId, session) {
  const partition = normalizeScope(scope);
  requireText(remoteBusinessId, "Server business ID");
  if (session?.user?.id !== partition.ownerId) throw new Error("Sign in as the owner of this business before refreshing stock.");
  const remote = await readRemoteFinishedStock(remoteBusinessId, session);
  const snapshot = {
    ...partition,
    remoteBusinessId,
    lots: structuredClone(remote.lots),
    allocations: structuredClone(remote.allocations),
    fetchedAt: remote.fetchedAt,
  };
  const db = await openBusinessDatabase();
  const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
  tx.objectStore(SNAPSHOT_STORE).put(snapshot);
  return transactionResult(tx, resolve => { tx.objectStore(SNAPSHOT_STORE).get([partition.ownerId, partition.businessId]).onsuccess = event => resolve(event.target.result); });
}

/** Read the latest locally cached snapshot; usable offline, but the server revalidates every posting. */
export async function getFinishedStockSnapshot(scope) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(SNAPSHOT_STORE, "readonly");
  const request = tx.objectStore(SNAPSHOT_STORE).get([partition.ownerId, partition.businessId]);
  return structuredClone(await requestResult(request, "Could not read the finished-stock snapshot.") ?? null);
}

/**
 * Persist a fully built immutable inventory command before attempting network delivery.
 * The local business partition is not used as the server business ID.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {any} command Built by buildFinishedDispositionCommand.
 * @param {{dispositionType:string,quantity:string,unit:string,reason?:string,saleId?:string}} details
 */
export async function saveFinishedDisposition(scope, command, details) {
  const partition = normalizeScope(scope);
  if (!command || typeof command !== "object" || !command.commandId || !command.businessId || !command.payload) {
    throw new TypeError("A complete finished-stock inventory command is required.");
  }
  const record = {
    ...partition,
    commandId: requireText(command.commandId, "Inventory command ID"),
    remoteBusinessId: requireText(command.businessId, "Server business ID"),
    command: structuredClone(command),
    dispositionType: requireText(details?.dispositionType, "Disposition type"),
    quantity: requireText(details?.quantity, "Disposition quantity"),
    unit: requireText(details?.unit, "Disposition unit"),
    reason: typeof details?.reason === "string" ? details.reason.trim() : "",
    ...(details?.saleId ? { saleId: details.saleId } : {}),
  };
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMAND_STORE, "readwrite");
    const store = tx.objectStore(COMMAND_STORE);
    const request = store.get([partition.ownerId, partition.businessId, record.commandId]);
    let result;
    let failure;
    request.onsuccess = () => {
      const existing = request.result;
      if (existing) {
        if (JSON.stringify(existing.command) !== JSON.stringify(record.command) ||
            existing.dispositionType !== record.dispositionType ||
            existing.quantity !== record.quantity || existing.unit !== record.unit || existing.reason !== record.reason) {
          failure = new Error("Inventory command ID is already used by a different disposition.");
          tx.abort();
          return;
        }
        result = existing;
        return;
      }
      const now = new Date().toISOString();
      record.state = "pending_sync";
      record.syncAttempts = 0;
      record.createdAt = now;
      record.updatedAt = now;
      result = record;
      store.add(record);
    };
    request.onerror = () => { failure = request.error ?? new Error("Could not inspect the finished-stock outbox."); tx.abort(); };
    tx.oncomplete = () => resolve(structuredClone(result));
    tx.onerror = () => reject(failure ?? tx.error ?? new Error("Could not save the finished-stock command."));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Finished-stock command save was aborted."));
  });
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listFinishedDispositions(scope) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(COMMAND_STORE, "readonly");
  const request = tx.objectStore(COMMAND_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  const rows = await requestResult(request, "Could not read finished-stock dispositions.");
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(row => structuredClone(row));
}

async function mutateCommand(scope, commandId, mutate) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(COMMAND_STORE, "readwrite");
  const store = tx.objectStore(COMMAND_STORE);
  const key = [partition.ownerId, partition.businessId, commandId];
  const request = store.get(key);
  let result;
  let failure;
  request.onsuccess = () => {
    if (!request.result) {
      failure = new Error("Finished-stock command was not found in this local business partition.");
      tx.abort();
      return;
    }
    try {
      result = mutate(structuredClone(request.result));
      store.put(result);
    } catch (error) {
      failure = error instanceof Error ? error : new Error("Could not update finished-stock sync state.");
      tx.abort();
    }
  };
  request.onerror = () => { failure = request.error ?? new Error("Could not read finished-stock command."); tx.abort(); };
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(failure ?? tx.error ?? new Error("Could not update finished-stock command."));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Finished-stock state update was aborted."));
  });
  return structuredClone(result);
}

/** Retry delivery with the same command ID and byte-for-byte equivalent payload. */
export async function syncFinishedDisposition(scope, commandId, session) {
  const partition = normalizeScope(scope);
  requireText(commandId, "Inventory command ID");
  if (!session?.access_token || !session?.user?.id || session.user.id !== partition.ownerId) {
    throw new Error("Sign in as the owner of this business before syncing finished-stock changes.");
  }
  const command = await mutateCommand(partition, commandId, current => {
    if (current.state === "synced") return current;
    return {
      ...current,
      state: "syncing",
      syncAttempts: (current.syncAttempts ?? 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: null,
    };
  });
  if (command.state === "synced") return command;
  try {
    const serverResult = await applyInventoryCommand(command.command, session);
    return await mutateCommand(partition, commandId, current => ({
      ...current,
      state: "synced",
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverResult: structuredClone(serverResult),
      lastError: null,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finished-stock sync failed.";
    await mutateCommand(partition, commandId, current => current.state === "synced" ? current : ({
      ...current,
      state: "retryable_error",
      updatedAt: new Date().toISOString(),
      lastError: message.slice(0, 500),
    }));
    throw error;
  }
}
