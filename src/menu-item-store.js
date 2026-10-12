import { enqueueEntityOperation, openBusinessDatabase } from "./business-data-store.js";

const MENU_ITEM_STORE = "menuItems";

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

/** @param {{ownerId:string,businessId:string}} scope */
function normalizeScope(scope) {
  if (typeof scope?.ownerId !== "string" || !scope.ownerId.trim()) throw new TypeError("Owner scope is required.");
  if (typeof scope?.businessId !== "string" || !scope.businessId.trim()) throw new TypeError("Business scope is required.");
  return { ownerId: scope.ownerId, businessId: scope.businessId };
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listMenuItems(scope) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(MENU_ITEM_STORE, "readonly");
  const request = tx.objectStore(MENU_ITEM_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read menu items."));
  });
  return /** @type {any[]} */ (records).sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/** Save a menu item and its durable outbox operation atomically. */
/** @param {{ownerId:string,businessId:string}} scope @param {{id?:string,name:unknown,description?:unknown}} input */
export async function saveMenuItem(scope, input) {
  const partition = normalizeScope(scope);
  const draft = validateMenuItem(input);
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MENU_ITEM_STORE, "operations", "syncMetadata"], "readwrite");
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
      enqueueEntityOperation(tx.objectStore("operations"), tx.objectStore("syncMetadata"), {
        ...partition,
        entityType: "menuItem",
        recordId: id,
        payload: { name: saved.name, ...(saved.description ? { description: saved.description } : {}), status: saved.status },
        localSnapshot: saved,
        onError: fail,
      });
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

/** Archive/reactivate without destructive deletion; the outbox write shares the same transaction. */
/** @param {{ownerId:string,businessId:string}} scope @param {string} id @param {"active"|"archived"} status */
export async function setMenuItemStatus(scope, id, status) {
  const partition = normalizeScope(scope);
  if (typeof id !== "string" || !id.trim()) throw new TypeError("Menu item ID is required.");
  if (status !== "active" && status !== "archived") throw new TypeError("Unsupported menu item status.");
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MENU_ITEM_STORE, "operations", "syncMetadata"], "readwrite");
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
      enqueueEntityOperation(tx.objectStore("operations"), tx.objectStore("syncMetadata"), {
        ...partition,
        entityType: "menuItem",
        recordId: id,
        payload: { name: updated.name, ...(updated.description ? { description: updated.description } : {}), status: updated.status },
        localSnapshot: updated,
        onError: fail,
      });
    };
    request.onerror = () => fail(request.error ?? new Error("Could not read the menu item."));
  });
}
