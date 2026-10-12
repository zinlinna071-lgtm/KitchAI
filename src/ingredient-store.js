const DATABASE_NAME = "kitchai-ingredients";
const DATABASE_VERSION = 1;
const INGREDIENT_STORE = "ingredients";
let databasePromise;

/** @param {unknown} value */
function requireScopePart(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value;
}

/**
 * Normalize an ingredient draft without mutating stored data.
 * Limits count Unicode code points, not UTF-16 code units.
 * @param {{name:unknown,description?:unknown}} input
 * @returns {{name:string,description?:string}}
 */
export function validateIngredient(input) {
  if (typeof input.name !== "string") throw new TypeError("Enter an ingredient name.");
  const name = input.name.trim();
  if (!name) throw new Error("Enter an ingredient name.");
  if ([...name].length > 120) throw new Error("Ingredient name must be 120 characters or fewer.");
  const result = { name };
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") throw new TypeError("Ingredient description must be text.");
    const description = input.description.trim();
    if ([...description].length > 2000) throw new Error("Ingredient description must be 2,000 characters or fewer.");
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
      if (!db.objectStoreNames.contains(INGREDIENT_STORE)) {
        const store = db.createObjectStore(INGREDIENT_STORE, { keyPath: ["ownerId", "businessId", "id"] });
        store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error ?? new Error("Could not open ingredient storage.")); };
    request.onblocked = () => reject(new Error("Ingredient storage upgrade is blocked by another open KitchAI tab."));
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

/**
 * List only records belonging to the supplied owner and business partition.
 * @param {{ownerId:string,businessId:string}} scope
 */
export async function listIngredients(scope) {
  const partition = normalizeScope(scope);
  const db = await openDatabase();
  const tx = db.transaction(INGREDIENT_STORE, "readonly");
  const request = tx.objectStore(INGREDIENT_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read ingredients."));
  });
  return /** @type {any[]} */ (records).sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Save a local ingredient only; no remote sync is claimed or queued in WP2.2.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {{id?:string,name:unknown,description?:unknown}} input
 */
export async function saveIngredient(scope, input) {
  const partition = normalizeScope(scope);
  const draft = validateIngredient(input);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INGREDIENT_STORE, "readwrite");
    const store = tx.objectStore(INGREDIENT_STORE);
    const id = input.id ?? crypto.randomUUID();
    let saved;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    const write = (existing) => {
      if (input.id && (!existing || existing.ownerId !== partition.ownerId || existing.businessId !== partition.businessId)) {
        fail(new Error("This ingredient is not in the active business workspace."));
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
    tx.oncomplete = () => saved ? resolve(saved) : reject(new Error("Ingredient save ended without a result."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the ingredient."));
    tx.onabort = () => reject(tx.error ?? new Error("Ingredient was not saved."));
    if (input.id) {
      const request = store.get([partition.ownerId, partition.businessId, id]);
      request.onsuccess = () => write(request.result);
      request.onerror = () => fail(request.error ?? new Error("Could not read the ingredient before editing."));
    } else {
      write(null);
    }
  });
}

/**
 * Archive/reactivate an ingredient without destructive deletion.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {string} id
 * @param {"active"|"archived"} status
 */
export async function setIngredientStatus(scope, id, status) {
  const partition = normalizeScope(scope);
  if (typeof id !== "string" || !id.trim()) throw new TypeError("Ingredient ID is required.");
  if (status !== "active" && status !== "archived") throw new TypeError("Unsupported ingredient status.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INGREDIENT_STORE, "readwrite");
    const store = tx.objectStore(INGREDIENT_STORE);
    let updated;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    tx.oncomplete = () => updated ? resolve(updated) : reject(new Error("Ingredient status was not updated."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not update ingredient status."));
    tx.onabort = () => reject(tx.error ?? new Error("Ingredient status was not updated."));
    const request = store.get([partition.ownerId, partition.businessId, id]);
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing) {
        fail(new Error("This ingredient is not in the active business workspace."));
        return;
      }
      updated = { ...existing, status, updatedAt: new Date().toISOString() };
      store.put(updated);
    };
    request.onerror = () => fail(request.error ?? new Error("Could not read the ingredient."));
  });
}
