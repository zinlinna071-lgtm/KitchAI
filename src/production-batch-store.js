import { openBusinessDatabase } from "./business-data-store.js";
import { recipeQuantityToInventoryQuantity } from "./recipe-quantity-adapter.js";
import { normalizeQuantity } from "./inventory-domain.js";

const BATCH_STORE = "productionBatches";
const RECIPE_STORE = "recipes";
const LINE_STORE = "recipeLines";
const QUANTITY_MODES = new Set(["exact", "estimated", "to_taste"]);
const ALLOWED_UNITS = new Set(["g", "kg", "ml", "l", "each"]);

/** @param {unknown} value @param {string} label */
function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}

/** Freeze nested snapshot metadata as well as the containing line and snapshot. */
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/**
 * Build an immutable, content-bearing snapshot from a recipe and its lines.
 * Legacy lines without quantityMode are treated as exact quantities.
 * "to_taste" lines preserve their note/instructions and never claim an exact quantity.
 *
 * @param {{id:string,menuItemId:string,name:string,instructions?:string,yieldPortions?:number,status:string}} recipe
 * @param {Array<{id:string,recipeId:string,ingredientId:string,quantity?:number,quantityMode?:string,unit:string,position:number,note?:string,conversionProvenance?:unknown}>} lines
 * @param {{snapshotId?:string,capturedAt?:string}} [options]
 */
export function buildRecipeSnapshot(recipe, lines, options = {}) {
  if (!recipe || typeof recipe !== "object") throw new TypeError("Recipe is required.");
  const recipeId = requireText(recipe.id, "Recipe ID");
  const menuItemId = requireText(recipe.menuItemId, "Menu item ID");
  const recipeName = requireText(recipe.name, "Recipe name");
  if (recipe.status !== "active") throw new Error("Only an active recipe can start a production batch.");
  if (typeof recipe.yieldPortions !== "number" || !Number.isFinite(recipe.yieldPortions) || recipe.yieldPortions <= 0) {
    throw new Error("An active recipe must have a finite positive yield.");
  }
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("A recipe needs at least one ingredient line.");
  if (lines.length > 200) throw new RangeError("A production batch supports at most 200 recipe lines.");

  const capturedAt = options.capturedAt ?? new Date().toISOString();
  if (typeof capturedAt !== "string" || !Number.isFinite(Date.parse(capturedAt))) {
    throw new TypeError("Snapshot timestamp must be a valid date.");
  }
  const snapshotId = options.snapshotId ?? crypto.randomUUID();
  requireText(snapshotId, "Snapshot ID");

  const capturedLines = lines.map((line) => {
    const id = requireText(line.id, "Recipe line ID");
    if (line.recipeId !== recipeId) throw new Error("A recipe line belongs to a different recipe.");
    const ingredientId = requireText(line.ingredientId, "Ingredient ID");
    const unit = requireText(line.unit, "Recipe quantity unit");
    if (!ALLOWED_UNITS.has(unit)) throw new Error("Unsupported recipe unit: " + unit);
    const quantityMode = line.quantityMode ?? "exact";
    if (!QUANTITY_MODES.has(quantityMode)) throw new Error("Unsupported recipe quantity mode.");
    const note = typeof line.note === "string" ? line.note.trim() : "";
    let quantity;
    if (quantityMode === "to_taste") {
      if (!note) throw new Error("A to-taste ingredient must preserve its instruction in the note.");
    } else {
      if (typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0) {
        throw new Error("Exact and estimated recipe quantities must be finite numbers greater than zero.");
      }
      // Reuse the inventory adapter so precision, unit, and numeric range rules stay aligned.
      quantity = recipeQuantityToInventoryQuantity(line.quantity, { unit }).quantity;
    }
    if (typeof line.position !== "number" || !Number.isInteger(line.position) || line.position < 0) {
      throw new TypeError("Recipe line position must be a non-negative integer.");
    }
    const conversionProvenance = line.conversionProvenance == null
      ? null
      : deepFreeze(structuredClone(line.conversionProvenance));
    return Object.freeze({
      lineId: id,
      ingredientId,
      quantityMode,
      ...(quantity !== undefined ? { quantity } : {}),
      unit,
      position: line.position,
      note,
      conversionProvenance,
    });
  }).sort((a, b) => a.position - b.position || a.lineId.localeCompare(b.lineId));

  if (new Set(capturedLines.map((line) => line.lineId)).size !== capturedLines.length) {
    throw new Error("Recipe line IDs must be unique within a snapshot.");
  }
  return Object.freeze({
    snapshotId,
    capturedAt: new Date(capturedAt).toISOString(),
    recipeId,
    menuItemId,
    recipeName,
    recipeInstructions: typeof recipe.instructions === "string" ? recipe.instructions : "",
    ...(typeof recipe.yieldPortions === "number" ? { yieldPortions: recipe.yieldPortions } : {}),
    lines: Object.freeze(capturedLines),
  });
}

/** @param {{ownerId:string,businessId:string}} scope */
function normalizeScope(scope) {
  return {
    ownerId: requireText(scope?.ownerId, "Owner scope"),
    businessId: requireText(scope?.businessId, "Business scope"),
  };
}

/**
 * Atomically read the active recipe and its current ingredient lines, capture the snapshot,
 * and persist a started local batch in one IndexedDB transaction.
 * The recipe snapshot is never updated by this module after creation.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {string} recipeId
 */
export async function startProductionBatch(scope, recipeId) {
  const partition = normalizeScope(scope);
  requireText(recipeId, "Recipe ID");
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([RECIPE_STORE, LINE_STORE, BATCH_STORE], "readwrite");
    const recipes = tx.objectStore(RECIPE_STORE);
    const lines = tx.objectStore(LINE_STORE);
    const batches = tx.objectStore(BATCH_STORE);
    const recipeRequest = recipes.get([partition.ownerId, partition.businessId, recipeId]);
    const linesRequest = lines.index("byRecipe").getAll([partition.ownerId, partition.businessId, recipeId]);
    let recipeReady = false;
    let linesReady = false;
    let savedBatch;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      try { tx.abort(); } catch {}
      reject(error instanceof Error ? error : new Error("Could not start production batch."));
    };
    const createBatch = () => {
      if (failed || !recipeReady || !linesReady) return;
      try {
        const recipe = recipeRequest.result;
        if (!recipe || recipe.ownerId !== partition.ownerId || recipe.businessId !== partition.businessId) {
          throw new Error("This recipe is not in the active business workspace.");
        }
        const snapshot = buildRecipeSnapshot(recipe, linesRequest.result);
        const startedAt = new Date().toISOString();
        savedBatch = {
          ...partition,
          batchId: crypto.randomUUID(),
          recipeId,
          snapshot,
          state: "started",
          startedAt,
          updatedAt: startedAt,
          actualUsage: [],
          output: null,
          posting: null,
          events: [{ eventId: crypto.randomUUID(), type: "started", occurredAt: startedAt, snapshotId: snapshot.snapshotId }],
        };
        batches.add(savedBatch);
      } catch (error) {
        fail(error);
      }
    };
    recipeRequest.onsuccess = () => { recipeReady = true; createBatch(); };
    recipeRequest.onerror = () => fail(recipeRequest.error ?? new Error("Could not read recipe."));
    linesRequest.onsuccess = () => { linesReady = true; createBatch(); };
    linesRequest.onerror = () => fail(linesRequest.error ?? new Error("Could not read recipe ingredients."));
    tx.oncomplete = () => { if (!failed && savedBatch) resolve(structuredClone(savedBatch)); };
    tx.onerror = () => { if (!failed) reject(tx.error ?? new Error("Could not start production batch.")); };
    tx.onabort = () => { if (!failed) reject(tx.error ?? new Error("Production batch start was aborted.")); };
  });
}

/** @param {{ownerId:string,businessId:string}} scope @param {string} batchId */
export async function getProductionBatch(scope, batchId) {
  const partition = normalizeScope(scope);
  requireText(batchId, "Batch ID");
  const db = await openBusinessDatabase();
  const tx = db.transaction(BATCH_STORE, "readonly");
  const request = tx.objectStore(BATCH_STORE).get([partition.ownerId, partition.businessId, batchId]);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ? structuredClone(request.result) : null);
    request.onerror = () => reject(request.error ?? new Error("Could not read production batch."));
  });
}

/** @param {{ownerId:string,businessId:string}} scope */
export async function listProductionBatches(scope) {
  const partition = normalizeScope(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(BATCH_STORE, "readonly");
  const request = tx.objectStore(BATCH_STORE).index("byScope").getAll([partition.ownerId, partition.businessId]);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(/** @type {any[]} */ (request.result)
      .map((batch) => structuredClone(batch))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.batchId.localeCompare(b.batchId)));
    request.onerror = () => reject(request.error ?? new Error("Could not list production batches."));
  });
}


const USAGE_DISPOSITIONS = new Set(["measured", "accepted_estimate", "not_used"]);

/**
 * Validate one complete operator decision for every snapshot line.
 * Actual quantities use the same unit as the snapshot line; conversion must be explicit elsewhere.
 * @param {{lines:Array<{lineId:string,quantityMode:string,quantity?:string,unit:string}>}} snapshot
 * @param {Array<{lineId:string,disposition:string,quantity?:string,unit?:string,note?:string,varianceReason?:string}>} entries
 */
export function validateActualUsage(snapshot, entries) {
  if (!snapshot || !Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
    throw new TypeError("A valid recipe snapshot is required.");
  }
  if (!Array.isArray(entries) || entries.length !== snapshot.lines.length) {
    throw new Error("Actual usage must include one explicit decision for every recipe line.");
  }
  const byLine = new Map(snapshot.lines.map((line) => [line.lineId, line]));
  const seen = new Set();
  const normalized = entries.map((entry) => {
    const lineId = requireText(entry?.lineId, "Actual-usage recipe line ID");
    const line = byLine.get(lineId);
    if (!line || seen.has(lineId)) throw new Error("Actual usage contains an unknown or duplicate recipe line.");
    seen.add(lineId);
    if (!USAGE_DISPOSITIONS.has(entry.disposition)) throw new Error("Choose measured, accepted_estimate, or not_used.");
    const note = typeof entry.note === "string" ? entry.note.trim() : "";
    const varianceReason = typeof entry.varianceReason === "string" ? entry.varianceReason.trim() : "";
    if (entry.disposition === "not_used") {
      if (!note) throw new Error("A not-used ingredient requires a reason.");
      return { lineId, disposition: "not_used", note };
    }
    if (entry.unit !== line.unit) {
      throw new Error("Actual usage must use the snapshot unit; convert explicitly before recording it.");
    }
    const quantity = normalizeQuantity(entry.quantity, { unit: entry.unit }).quantity;
    if (entry.disposition === "accepted_estimate" && !note) {
      throw new Error("Accepting an estimate requires an operator note.");
    }
    if (line.quantityMode === "exact" && quantity !== line.quantity && !varianceReason) {
      throw new Error("Usage that differs from the exact target requires a variance reason.");
    }
    return {
      lineId,
      disposition: entry.disposition,
      quantity,
      unit: entry.unit,
      ...(note ? { note } : {}),
      ...(varianceReason ? { varianceReason } : {}),
    };
  });
  return normalized.sort((a, b) => a.lineId.localeCompare(b.lineId));
}

/** Validate output quantity before the batch can be marked ready for atomic posting. */
export function validateProductionOutput(output) {
  if (!output || typeof output !== "object") throw new TypeError("Production output is required.");
  const productId = requireText(output.productId, "Finished menu item ID");
  const normalized = normalizeQuantity(output.quantity, { unit: output.unit, stockClass: "finished" });
  return {
    productId,
    quantity: normalized.quantity,
    unit: normalized.unit,
    ...(typeof output.note === "string" && output.note.trim() ? { note: output.note.trim() } : {}),
  };
}

/**
 * Apply a guarded local state mutation in one IndexedDB transaction.
 * @param {{ownerId:string,businessId:string}} scope
 * @param {string} batchId
 * @param {(batch:any)=>any} mutate
 */
async function mutateProductionBatch(scope, batchId, mutate) {
  const partition = normalizeScope(scope);
  requireText(batchId, "Batch ID");
  const db = await openBusinessDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BATCH_STORE, "readwrite");
    const store = tx.objectStore(BATCH_STORE);
    const request = store.get([partition.ownerId, partition.businessId, batchId]);
    let saved;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      try { tx.abort(); } catch {}
      reject(error instanceof Error ? error : new Error("Could not update production batch."));
    };
    request.onsuccess = () => {
      try {
        const current = request.result;
        if (!current) throw new Error("Production batch was not found in this business workspace.");
        saved = mutate(structuredClone(current));
        store.put(saved);
      } catch (error) { fail(error); }
    };
    request.onerror = () => fail(request.error ?? new Error("Could not read production batch."));
    tx.oncomplete = () => { if (!failed && saved) resolve(structuredClone(saved)); };
    tx.onerror = () => { if (!failed) reject(tx.error ?? new Error("Could not update production batch.")); };
    tx.onabort = () => { if (!failed) reject(tx.error ?? new Error("Production batch update was aborted.")); };
  });
}

/**
 * Record operator-measured usage and explicit decisions for all recipe lines.
 * Only a started batch is editable; its recipe snapshot is never changed.
 */
export function recordProductionBatchActualUsage(scope, batchId, entries) {
  return mutateProductionBatch(scope, batchId, (batch) => {
    if (batch.state !== "started") throw new Error("Actual usage can only be recorded on a started batch.");
    const actualUsage = validateActualUsage(batch.snapshot, entries);
    const occurredAt = new Date().toISOString();
    batch.actualUsage = actualUsage;
    batch.updatedAt = occurredAt;
    batch.events = [...(batch.events ?? []), {
      eventId: crypto.randomUUID(), type: "actual_usage_recorded", occurredAt,
      snapshotId: batch.snapshot.snapshotId, lineCount: actualUsage.length,
    }];
    return batch;
  });
}

/**
 * Validate all completion inputs and move a batch to ready_to_post.
 * This is not a completed/posted state; only WP3.3.3's trusted atomic posting result may complete it.
 */
export function prepareProductionBatchForPosting(scope, batchId, output) {
  return mutateProductionBatch(scope, batchId, (batch) => {
    if (batch.state !== "started") throw new Error("Only a started batch can be prepared for posting.");
    if (!batch.snapshot?.snapshotId || !Array.isArray(batch.snapshot.lines) || batch.snapshot.lines.length === 0) {
      throw new Error("A valid recipe snapshot is required before posting.");
    }
    const actualUsage = validateActualUsage(batch.snapshot, batch.actualUsage);
    const normalizedOutput = validateProductionOutput(output);
    if (normalizedOutput.productId !== batch.snapshot.menuItemId) {
      throw new Error("Production output must match the menu item captured in the recipe snapshot.");
    }
    const occurredAt = new Date().toISOString();
    batch.actualUsage = actualUsage;
    batch.output = normalizedOutput;
    batch.state = "ready_to_post";
    batch.readyAt = occurredAt;
    batch.updatedAt = occurredAt;
    batch.events = [...(batch.events ?? []), {
      eventId: crypto.randomUUID(), type: "ready_to_post", occurredAt,
      snapshotId: batch.snapshot.snapshotId, output: normalizedOutput,
    }];
    return batch;
  });
}

/** Cancel a batch before posting; cancelled batches are terminal and cannot be reopened. */
export function cancelProductionBatch(scope, batchId, reason) {
  const cancellationReason = requireText(reason, "Cancellation reason");
  return mutateProductionBatch(scope, batchId, (batch) => {
    if (batch.state !== "started") throw new Error("Only a started batch can be cancelled before posting.");
    const occurredAt = new Date().toISOString();
    batch.state = "cancelled";
    batch.cancelledAt = occurredAt;
    batch.cancellationReason = cancellationReason;
    batch.updatedAt = occurredAt;
    batch.events = [...(batch.events ?? []), {
      eventId: crypto.randomUUID(), type: "cancelled", occurredAt,
      snapshotId: batch.snapshot.snapshotId, reason: cancellationReason,
    }];
    return batch;
  });
}
