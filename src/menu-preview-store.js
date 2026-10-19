const DB_NAME = "kitchai-menu-preview";
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
    request.onerror = () => reject(request.error || new Error("Could not open local Menu storage."));
  });
}

/** Load Menu prototype data from this device. This store is local-only and is not synced. */
export async function loadMenuWorkspace() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(WORKSPACE_ID);
    const record = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read local Menu data."));
    });
    return {
      menus: Array.isArray(record?.menus) ? record.menus : [],
      sales: Array.isArray(record?.sales) ? record.sales : [],
      categories: Array.isArray(record?.categories) ? record.categories : ["Default"],
    };
  } finally {
    db.close();
  }
}

/** Save Menu prototype data atomically on this device; this does not imply cloud sync. */
export async function saveMenuWorkspace(input) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id: WORKSPACE_ID,
      updatedAt: new Date().toISOString(),
      menus: Array.isArray(input?.menus) ? input.menus : [],
      sales: Array.isArray(input?.sales) ? input.sales : [],
      categories: Array.isArray(input?.categories) ? input.categories : ["Default"],
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Could not save local Menu data."));
      tx.onabort = () => reject(tx.error || new Error("Local Menu save was cancelled."));
    });
  } finally {
    db.close();
  }
}
