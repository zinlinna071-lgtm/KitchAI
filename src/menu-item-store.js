const DATABASE_NAME = "kitchai-menu";
const DATABASE_VERSION = 1;
const MENU_ITEM_STORE = "menuItems";
let databasePromise;

/** @param {unknown} value */
function requireScopePart(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value;
}

/**
 * Normalize a menu-item draft. Text limits count Unicode code points.
 * @param {{name:unknown,description?:unknown}} input
 * @returns {{name:string,description?:string}}
 */
export function validateMenuItem(input) {
  if (typeof input.name !== "string") throw new TypeError("Enter a menu item name.");
  const name = input.name.trim();
  if (!name) throw new Error("Enter a menu item name.");
  if ([...name].length > 120) throw new Error("Menu item name must be 120 characters or fewer.");
  /** @type {{name:string,description?:string}} */
  const result = { name };
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") throw new TypeError("Menu item description must be text.");
    const description = input.description.trim();
    if ([...description].length > 2000) throw new Error("Menu item description must be 2,000 characters or fewer.");
    if (description) result.description = description;
  }
  return result;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MENU_ITEM_STORE)) {
        const store = db.createObjectStore(MENU_ITEM_STORE, { keyPath: ["ownerId", "businessId", "id"] });
        store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error ?? new Error("Could not open menu storage.")); };
    request.onblocked = () => reject(new Error("Menu storage upgrade is blocked by another open KitchAI tab."));
  });
  return databasePromise;
}

/** @param {{ownerId:string,businessId:string}} scope */
function normalizeScope(scope) {
  return {
    ownerId: requireScopePart(scope?.ownerId, "Owner scope"),
    businessId: requireScopePart(scope?.businessId, "Business scope"),
  };
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listMenuItems(scope) {
  const partition = normalizeScope(scope);
  const db = await openDatabase();
  const tx = db.transaction(MENU_ITEM_STORE, "readonly");
  const request = tx.objectStore(MENU_ITEM_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read menu items."));
  });
  return /** @type {any[]} */ (records).sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Save a menu item locally only. Recipe links and remote sync are future WPs.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {{id?:string,name:unknown,description?:unknown}} input
 */
export async function saveMenuItem(scope, input) {
  const partition = normalizeScope(scope);
  const draft = validateMenuItem(input);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MENU_ITEM_STORE, "readwrite");
    const store = tx.objectStore(MENU_ITEM_STORE);
    const id = input.id ?? crypto.randomUUID();
    let saved;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    const write = (existing) => {
      if (input.id && (!existing || existing.ownerId !== partition.ownerId || existing.businessId !== partition.businessId)) {
        fail(new Error("This menu item is not in the active business workspace."));
        return;
      }
      const now = new Date().toISOString();
      saved = {
        ...partition,
        id,
        name: draft.name,
        ...(draft.description ? { description: draft.description } : {}),
        status: existing?.status ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      store.put(saved);
    };
    tx.oncomplete = () => saved ? resolve(saved) : reject(new Error("Menu item save ended without a result."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the menu item."));
    tx.onabort = () => reject(tx.error ?? new Error("Menu item was not saved."));
    if (input.id) {
      const request = store.get([partition.ownerId, partition.businessId, id]);
      request.onsuccess = () => write(request.result);
      request.onerror = () => fail(request.error ?? new Error("Could not read the menu item before editing."));
    } else {
      write(null);
    }
  });
}

/**
 * Archive/reactivate without destructive deletion.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {string} id
 * @param {"active"|"archived"} status
 */
export async function setMenuItemStatus(scope, id, status) {
  const partition = normalizeScope(scope);
  if (typeof id !== "string" || !id.trim()) throw new TypeError("Menu item ID is required.");
  if (status !== "active" && status !== "archived") throw new TypeError("Unsupported menu item status.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MENU_ITEM_STORE, "readwrite");
    const store = tx.objectStore(MENU_ITEM_STORE);
    let updated;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    tx.oncomplete = () => updated ? resolve(updated) : reject(new Error("Menu item status was not updated."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not update menu item status."));
    tx.onabort = () => reject(tx.error ?? new Error("Menu item status was not updated."));
    const request = store.get([partition.ownerId, partition.businessId, id]);
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing) {
        fail(new Error("This menu item is not in the active business workspace."));
        return;
      }
      updated = { ...existing, status, updatedAt: new Date().toISOString() };
      store.put(updated);
    };
    request.onerror = () => fail(request.error ?? new Error("Could not read the menu item."));
  });
}
