import { listIngredients } from "./ingredient-store.js";
import { listMenuItems } from "./menu-item-store.js";

const DATABASE_NAME = "kitchai-recipes";
const DATABASE_VERSION = 1;
const RECIPE_STORE = "recipes";
const LINE_STORE = "recipeLines";
let databasePromise;

const ALLOWED_UNITS = new Set(["g", "kg", "ml", "l", "each"]);

/** @param {unknown} value */
function requireScopePart(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value;
}

/** @param {{ownerId:string,businessId:string}} scope */
function normalizeScope(scope) {
  return {
    ownerId: requireScopePart(scope?.ownerId, "Owner scope"),
    businessId: requireScopePart(scope?.businessId, "Business scope"),
  };
}

/** @param {unknown} value @param {string} label @param {number} max */
function normalizeText(value, label, max) {
  if (typeof value !== "string") throw new TypeError(label + " must be text.");
  const normalized = value.trim();
  if ([...normalized].length > max) throw new Error(label + " must be " + max + " characters or fewer.");
  return normalized;
}

/**
 * @param {{menuItemId:unknown,name:unknown,description?:unknown,instructions?:unknown,yieldPortions?:unknown,status?:unknown}} input
 */
export function validateRecipe(input) {
  const menuItemId = requireScopePart(input.menuItemId, "Menu item");
  const name = normalizeText(input.name, "Recipe name", 120);
  if (!name) throw new Error("Enter a recipe name.");
  const description = input.description == null ? "" : normalizeText(input.description, "Recipe description", 2000);
  const instructions = input.instructions == null ? "" : normalizeText(input.instructions, "Recipe instructions", 10000);
  const status = input.status ?? "draft";
  if (typeof status !== "string" || !["draft", "active", "archived"].includes(status)) throw new TypeError("Unsupported recipe status.");
  let yieldPortions;
  if (input.yieldPortions !== undefined && input.yieldPortions !== null && input.yieldPortions !== "") {
    if (typeof input.yieldPortions !== "number" || !Number.isFinite(input.yieldPortions) || input.yieldPortions <= 0) {
      throw new Error("Recipe yield must be a finite number greater than zero.");
    }
    yieldPortions = input.yieldPortions;
  }
  if (status === "active" && (yieldPortions === undefined || yieldPortions <= 0)) {
    throw new Error("Enter a positive yield before activating a recipe.");
  }
  return {
    menuItemId,
    name,
    ...(description ? { description } : {}),
    ...(instructions ? { instructions } : {}),
    ...(yieldPortions !== undefined ? { yieldPortions } : {}),
    status,
  };
}

/**
 * @param {{recipeId:unknown,ingredientId:unknown,quantity:unknown,unit:unknown,position:unknown,note?:unknown}} input
 */
export function validateRecipeLine(input) {
  const recipeId = requireScopePart(input.recipeId, "Recipe");
  const ingredientId = requireScopePart(input.ingredientId, "Ingredient");
  if (typeof input.quantity !== "number" || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Quantity must be a finite number greater than zero.");
  }
  if (typeof input.unit !== "string" || !ALLOWED_UNITS.has(input.unit)) {
    throw new Error("Choose a supported unit: g, kg, ml, l, or each.");
  }
  if (typeof input.position !== "number" || !Number.isInteger(input.position) || input.position < 0) {
    throw new Error("Ingredient position must be a whole number zero or greater.");
  }
  const note = input.note == null ? "" : normalizeText(input.note, "Ingredient note", 500);
  return {
    recipeId,
    ingredientId,
    quantity: input.quantity,
    unit: input.unit,
    position: input.position,
    ...(note ? { note } : {}),
  };
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECIPE_STORE)) {
        const store = db.createObjectStore(RECIPE_STORE, { keyPath: ["ownerId", "businessId", "id"] });
        store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
        store.createIndex("byScopeMenuItem", ["ownerId", "businessId", "menuItemId"], { unique: false });
      }
      if (!db.objectStoreNames.contains(LINE_STORE)) {
        const store = db.createObjectStore(LINE_STORE, { keyPath: ["ownerId", "businessId", "id"] });
        store.createIndex("byScope", ["ownerId", "businessId"], { unique: false });
        store.createIndex("byRecipe", ["ownerId", "businessId", "recipeId"], { unique: false });
        store.createIndex("byRecipePosition", ["ownerId", "businessId", "recipeId", "position"], { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error ?? new Error("Could not open recipe storage.")); };
    request.onblocked = () => reject(new Error("Recipe storage upgrade is blocked by another open KitchAI tab."));
  });
  return databasePromise;
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listRecipes(scope) {
  const partition = normalizeScope(scope);
  const db = await openDatabase();
  const tx = db.transaction(RECIPE_STORE, "readonly");
  const request = tx.objectStore(RECIPE_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read recipes."));
  });
  return /** @type {any[]} */ (records).sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/** @param {{ownerId:string,businessId:string}} scope @param {string} recipeId */
export async function listRecipeLines(scope, recipeId) {
  const partition = normalizeScope(scope);
  requireScopePart(recipeId, "Recipe");
  const db = await openDatabase();
  const tx = db.transaction(LINE_STORE, "readonly");
  const request = tx.objectStore(LINE_STORE).index("byRecipe").getAll([partition.ownerId, partition.businessId, recipeId]);
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read recipe ingredients."));
  });
  return /** @type {any[]} */ (records).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** @param {{ownerId:string,businessId:string}} scope @param {{id?:string,menuItemId:unknown,name:unknown,description?:unknown,instructions?:unknown,yieldPortions?:unknown,status?:unknown}} input */
export async function saveRecipe(scope, input) {
  const partition = normalizeScope(scope);
  const draft = validateRecipe(input);
  const menuItems = await listMenuItems(partition);
  const menuItem = menuItems.find((item) => item.id === draft.menuItemId);
  if (!menuItem) throw new Error("Choose a menu item in the active business workspace.");
  if (draft.status === "active" && menuItem.status !== "active") throw new Error("Reactivate the menu item before activating its recipe.");
  const lines = input.id ? await listRecipeLines(partition, input.id) : [];
  if (draft.status === "active") {
    if (!input.id || lines.length === 0) throw new Error("Add at least one ingredient line before activating a recipe.");
    const ingredients = await listIngredients(partition);
    for (const line of lines) {
      if (!ingredients.some((ingredient) => ingredient.id === line.ingredientId && ingredient.status === "active")) {
        throw new Error("Reactivate every ingredient used by this recipe before activating it.");
      }
    }
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPE_STORE, "readwrite");
    const store = tx.objectStore(RECIPE_STORE);
    const id = input.id ?? crypto.randomUUID();
    let saved;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    const write = (existing, scopedRecipes) => {
      if (input.id && (!existing || existing.ownerId !== partition.ownerId || existing.businessId !== partition.businessId)) {
        fail(new Error("This recipe is not in the active business workspace."));
        return;
      }
      const collision = scopedRecipes.some((item) => item.id !== id && item.menuItemId === draft.menuItemId && item.status !== "archived");
      if (collision && draft.status !== "archived") {
        fail(new Error("This menu item already has a current recipe. Edit or archive that recipe first."));
        return;
      }
      const now = new Date().toISOString();
      saved = {
        ...partition, id, ...draft,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      store.put(saved);
    };
    tx.oncomplete = () => saved ? resolve(saved) : reject(new Error("Recipe save ended without a result."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not save recipe."));
    tx.onabort = () => reject(tx.error ?? new Error("Recipe was not saved."));
    const scopeRequest = store.index("byScope").getAll([partition.ownerId, partition.businessId]);
    scopeRequest.onsuccess = () => {
      const all = scopeRequest.result;
      if (input.id) {
        const request = store.get([partition.ownerId, partition.businessId, id]);
        request.onsuccess = () => write(request.result, all);
        request.onerror = () => fail(request.error ?? new Error("Could not read recipe before editing."));
      } else {
        write(null, all);
      }
    };
    scopeRequest.onerror = () => fail(scopeRequest.error ?? new Error("Could not verify recipe relationships."));
  });
}

/** @param {{ownerId:string,businessId:string}} scope @param {{id?:string,recipeId:unknown,ingredientId:unknown,quantity:unknown,unit:unknown,position:unknown,note?:unknown}} input */
export async function saveRecipeLine(scope, input) {
  const partition = normalizeScope(scope);
  const draft = validateRecipeLine(input);
  const [recipes, ingredients] = await Promise.all([listRecipes(partition), listIngredients(partition)]);
  const recipe = recipes.find((item) => item.id === draft.recipeId);
  if (!recipe || recipe.status === "archived") throw new Error("Choose a draft or active recipe in this business.");
  const ingredient = ingredients.find((item) => item.id === draft.ingredientId);
  if (!ingredient || ingredient.status !== "active") throw new Error("Choose an active ingredient in this business.");
  const lines = await listRecipeLines(partition, draft.recipeId);
  if (lines.some((line) => line.position === draft.position && line.id !== input.id)) {
    throw new Error("Another ingredient line already uses this position.");
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINE_STORE, "readwrite");
    const store = tx.objectStore(LINE_STORE);
    const id = input.id ?? crypto.randomUUID();
    let saved;
    const fail = (error) => { try { tx.abort(); } catch {} reject(error); };
    const write = (existing) => {
      if (input.id && (!existing || existing.ownerId !== partition.ownerId || existing.businessId !== partition.businessId || existing.recipeId !== draft.recipeId)) {
        fail(new Error("This ingredient line is not in the selected recipe."));
        return;
      }
      const now = new Date().toISOString();
      saved = { ...partition, id, ...draft, createdAt: existing?.createdAt ?? now, updatedAt: now };
      store.put(saved);
    };
    tx.oncomplete = () => saved ? resolve(saved) : reject(new Error("Ingredient line save ended without a result."));
    tx.onerror = () => reject(tx.error ?? new Error("Could not save ingredient line."));
    tx.onabort = () => reject(tx.error ?? new Error("Ingredient line was not saved."));
    if (input.id) {
      const request = store.get([partition.ownerId, partition.businessId, id]);
      request.onsuccess = () => write(request.result);
      request.onerror = () => fail(request.error ?? new Error("Could not read ingredient line before editing."));
    } else {
      write(null);
    }
  });
}

/** @param {{ownerId:string,businessId:string}} scope @param {string} id @param {"draft"|"active"|"archived"} status */
export async function setRecipeStatus(scope, id, status) {
  if (!["draft", "active", "archived"].includes(status)) throw new TypeError("Unsupported recipe status.");
  const recipes = await listRecipes(scope);
  const existing = recipes.find((item) => item.id === id);
  if (!existing) throw new Error("This recipe is not in the active business workspace.");
  return saveRecipe(scope, { ...existing, status });
}
