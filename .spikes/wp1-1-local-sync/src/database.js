const databaseName = "kitchai-wp1-1-local-sync-owner-partitioned";
const databaseVersion = 1;
let databasePromise;
let failNextStorageWrite = false;

export function simulateNextStorageWriteFailure() {
  failNextStorageWrite = true;
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const database = request.result;
        const profiles = database.createObjectStore("profiles", { keyPath: ["ownerId", "id"] });
        profiles.createIndex("ownerId", "ownerId", { unique: false });
        const outbox = database.createObjectStore("outbox", { keyPath: ["ownerId", "operationId"] });
        outbox.createIndex("ownerId", "ownerId", { unique: false });
        const conflicts = database.createObjectStore("conflicts", { keyPath: ["ownerId", "id"] });
        conflicts.createIndex("ownerId", "ownerId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

async function transact(storeNames, mode, work) {
  const database = await openDatabase();
  if (mode === "readwrite" && failNextStorageWrite) {
    failNextStorageWrite = false;
    throw new Error("Simulated IndexedDB write failure");
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
    try {
      result = work(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getRecord(storeName, key, ownerId) {
  return transact([storeName], "readonly", (transaction) =>
    requestResult(transaction.objectStore(storeName).get([ownerId, key])),
  ).then((value) => value ?? null);
}

export function getRecords(storeName, ownerId) {
  return transact([storeName], "readonly", (transaction) =>
    requestResult(transaction.objectStore(storeName).index("ownerId").getAll(ownerId)),
  );
}

export function writeRecords(storeNames, write) {
  return transact(storeNames, "readwrite", write);
}

export async function exportOwnerRecords(ownerId) {
  const [profiles, outbox, conflicts] = await Promise.all([
    getRecords("profiles", ownerId),
    getRecords("outbox", ownerId),
    getRecords("conflicts", ownerId),
  ]);
  return { formatVersion: 1, ownerId, profiles, outbox, conflicts };
}

export async function restoreOwnerRecords(payload, ownerId) {
  if (!payload || payload.formatVersion !== 1 || payload.ownerId !== ownerId) {
    throw new Error("Backup owner or format does not match the active workspace");
  }
  for (const key of ["profiles", "outbox", "conflicts"]) {
    if (!Array.isArray(payload[key]) || payload[key].some((record) => record?.ownerId !== ownerId)) {
      throw new Error("Backup contains invalid or cross-owner records");
    }
  }
  return writeRecords(["profiles", "outbox", "conflicts"], (transaction) => {
    for (const [storeName, records] of [
      ["profiles", payload.profiles],
      ["outbox", payload.outbox],
      ["conflicts", payload.conflicts],
    ]) {
      const store = transaction.objectStore(storeName);
      for (const record of records) store.add(record);
    }
  });
}

export async function clearDatabase() {
  await transact(["profiles", "outbox", "conflicts"], "readwrite", (transaction) => {
    transaction.objectStore("profiles").clear();
    transaction.objectStore("outbox").clear();
    transaction.objectStore("conflicts").clear();
  });
}
