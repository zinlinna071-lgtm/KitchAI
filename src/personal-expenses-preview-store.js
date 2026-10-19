const DB_NAME = "kitchai-personal-expenses-preview";
const DB_VERSION = 1;
const STORE_NAME = "workspaces";
const WORKSPACE_ID = "default-local-workspace";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local Personal Expenses storage."));
  });
}

/** Load personal expense preview records from this device only. */
export async function loadPersonalExpenses() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(WORKSPACE_ID);
    const record = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read personal expenses."));
    });
    return Array.isArray(record?.items) ? record.items : [];
  } finally {
    db.close();
  }
}

/** Replace personal expense preview records atomically on this device only. */
export async function savePersonalExpenses(items) {
  if (!Array.isArray(items)) throw new TypeError("Personal expenses must be an array.");
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id: WORKSPACE_ID,
        items,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save personal expenses."));
      tx.onabort = () => reject(tx.error || new Error("Personal expense save was aborted."));
    });
  } finally {
    db.close();
  }
}
