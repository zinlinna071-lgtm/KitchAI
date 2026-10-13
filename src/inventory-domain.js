const SCALE_DIGITS = 6;
const SCALE = 10n ** BigInt(SCALE_DIGITS);
const MAX_SCALED = 10n ** 24n - 1n;
export const INVENTORY_UNITS = Object.freeze(["g", "kg", "ml", "l", "each"]);
export const STOCK_MOVEMENT_KINDS = Object.freeze([
  "opening_balance", "purchase_receipt", "production_consumption", "production_output",
  "owner_consumption", "giveaway", "waste", "count_adjustment", "correction", "reversal",
]);
const UNIT_SET = new Set(INVENTORY_UNITS);
const KIND_SET = new Set(STOCK_MOVEMENT_KINDS);

/** Parse an exact base-10 quantity into scaled integer units (six decimal places). */
export function parseQuantity(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    throw new TypeError("Quantity must be a plain decimal string with at most six fractional digits.");
  }
  const [whole, fraction = ""] = value.split(".");
  const scaled = BigInt(whole) * SCALE + BigInt((fraction + "000000").slice(0, 6));
  if (scaled > MAX_SCALED) throw new RangeError("Quantity exceeds numeric(24,6) range.");
  return scaled;
}

/** Format a scaled integer without rounding or trailing zeroes. */
export function formatQuantity(scaled) {
  if (typeof scaled !== "bigint" || scaled < 0n || scaled > MAX_SCALED) {
    throw new RangeError("Scaled quantity is outside the supported non-negative range.");
  }
  const whole = scaled / SCALE;
  const fractional = (scaled % SCALE).toString().padStart(SCALE_DIGITS, "0").replace(/0+$/, "");
  return fractional ? whole.toString() + "." + fractional : whole.toString();
}

/** @param {unknown} value @param {{unit?:string, stockClass?:"ingredient"|"finished", positive?:boolean}} options */
export function normalizeQuantity(value, { unit, stockClass = "ingredient", positive = true } = {}) {
  if (!UNIT_SET.has(unit)) throw new TypeError("Choose a supported unit: g, kg, ml, l, or each.");
  const scaled = parseQuantity(value);
  if (positive && scaled === 0n) throw new RangeError("Posted quantity must be greater than zero.");
  if (unit === "each" && stockClass === "finished" && scaled % SCALE !== 0n) {
    throw new RangeError("Finished-product quantities in each must be whole numbers.");
  }
  if (!["ingredient", "finished"].includes(stockClass)) throw new TypeError("Unsupported stock class.");
  return { quantity: formatQuantity(scaled), unit, scaled };
}

export function addQuantities(left, right) {
  const result = parseQuantity(left) + parseQuantity(right);
  if (result > MAX_SCALED) throw new RangeError("Quantity addition exceeds numeric(24,6) range.");
  return formatQuantity(result);
}

export function subtractQuantities(left, right) {
  const a = parseQuantity(left);
  const b = parseQuantity(right);
  if (b > a) throw new RangeError("Quantity subtraction cannot produce negative stock.");
  return formatQuantity(a - b);
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}
function requireUtcInstant(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(label + " must be an ISO 8601 UTC timestamp ending in Z.");
  }
  const canonical = new Date(value).toISOString();
  if (canonical !== value && canonical.replace(".000Z", "Z") !== value) {
    throw new TypeError(label + " must be a valid calendar timestamp.");
  }
  return value;
}

/** Validate a canonical append-only stock movement. Quantities are positive; direction carries the sign. */
export function validateStockMovement(input) {
  if (!input || typeof input !== "object") throw new TypeError("Stock movement is required.");
  const ownerId = requireText(input.ownerId, "Owner scope");
  const businessId = requireText(input.businessId, "Business scope");
  const eventId = requireText(input.eventId, "Event ID");
  const stockItemId = requireText(input.stockItemId, "Stock item ID");
  if (!KIND_SET.has(input.kind)) throw new TypeError("Unsupported stock movement kind.");
  if (!["in", "out"].includes(input.direction)) throw new TypeError("Movement direction must be in or out.");
  const fixedDirection = {
    opening_balance: "in", purchase_receipt: "in", production_consumption: "out",
    production_output: "in", owner_consumption: "out", giveaway: "out", waste: "out",
  }[input.kind];
  if (fixedDirection && input.direction !== fixedDirection) throw new TypeError("Movement direction does not match movement kind.");
  if (["correction", "reversal"].includes(input.kind) && !input.relatedEventId) {
    throw new TypeError("Corrections and reversals must reference the original event.");
  }
  if (!["ingredient", "finished"].includes(input.stockClass)) throw new TypeError("Stock class must be ingredient or finished.");
  const quantity = normalizeQuantity(input.quantity, { unit: input.unit, stockClass: input.stockClass });
  if (input.kind === "production_consumption" && input.stockClass !== "ingredient") throw new TypeError("Production consumption must reference ingredient stock.");
  if (input.kind === "production_output" && input.stockClass !== "finished") throw new TypeError("Production output must reference finished stock.");
  return Object.freeze({
    ownerId, businessId, eventId, stockItemId, stockClass: input.stockClass,
    kind: input.kind, direction: input.direction, quantity: quantity.quantity, unit: quantity.unit,
    sourceType: requireText(input.sourceType, "Source type"),
    sourceId: requireText(input.sourceId, "Source ID"),
    recordedAt: requireUtcInstant(input.recordedAt, "recordedAt"),
    effectiveAt: requireUtcInstant(input.effectiveAt, "effectiveAt"),
    ...(input.relatedEventId ? { relatedEventId: requireText(input.relatedEventId, "Related event ID") } : {}),
    ...(input.reason ? { reason: requireText(input.reason, "Reason") } : {}),
  });
}

/** Each finished-stock reduction must allocate explicitly to one or more named lots. */
/** @param {unknown} allocations @param {{quantity?:string, unit?:string}} options */
export function validateLotAllocations(allocations, { quantity, unit } = {}) {
  if (!Array.isArray(allocations) || allocations.length === 0) throw new TypeError("At least one explicit lot allocation is required.");
  const seen = new Set();
  let total = 0n;
  const normalized = allocations.map((allocation) => {
    const lotId = requireText(allocation?.lotId, "Lot ID");
    if (seen.has(lotId)) throw new Error("A lot may appear only once in an allocation list.");
    seen.add(lotId);
    if (allocation.unit !== unit) throw new TypeError("Lot allocation units must match the disposition unit.");
    const parsed = normalizeQuantity(allocation.quantity, { unit, stockClass: "finished" });
    total += parsed.scaled;
    return Object.freeze({ lotId, quantity: parsed.quantity, unit });
  });
  if (total !== parseQuantity(quantity)) throw new RangeError("Lot allocations must sum exactly to the disposition quantity.");
  return Object.freeze(normalized);
}

/** A carry-over is a suitability decision on the same lot, never a stock movement. */
export function validateCarryOver(input) {
  const lotId = requireText(input?.lotId, "Lot ID");
  if (input.suitable !== true) throw new Error("Operator must explicitly confirm the lot is suitable for carry-over.");
  return Object.freeze({ lotId, suitable: true, confirmedAt: requireUtcInstant(input.confirmedAt, "confirmedAt") });
}
