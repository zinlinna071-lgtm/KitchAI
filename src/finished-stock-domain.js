import { formatQuantity, normalizeQuantity, parseQuantity, validateLotAllocations } from "./inventory-domain.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPOSITION_KIND = Object.freeze({
  sale: "sale",
  discounted_sale: "sale",
  owner_consumption: "owner_consumption",
  giveaway: "giveaway",
  waste: "waste",
});

/** @param {unknown} value @param {string} label */
function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}

/** @param {unknown} value @param {string} label */
function requireUuid(value, label) {
  const text = requireText(value, label);
  if (!UUID_PATTERN.test(text)) throw new TypeError(label + " must be a UUID.");
  return text;
}

/** @param {unknown} value @param {string} label */
function requireUtcInstant(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(label + " must be an ISO 8601 UTC timestamp ending in Z.");
  }
  const canonical = new Date(value).toISOString();
  if (canonical !== value && canonical.replace(".000Z", "Z") !== value) {
    throw new TypeError(label + " must be a valid calendar timestamp.");
  }
  return canonical;
}

/**
 * Project remaining finished stock from immutable production lots and append-only lot allocations.
 * The caller must supply the complete allocation history for the queried business.
 * @param {Array<{lotId:string,menuItemId:string,producedQuantity:string,unit:string,producedAt?:string}>} lots
 * @param {Array<{lotId:string,quantity:string,unit:string}>} allocations
 */
export function projectFinishedLotBalances(lots, allocations) {
  if (!Array.isArray(lots) || !Array.isArray(allocations)) {
    throw new TypeError("Finished lots and their allocation history must be arrays.");
  }
  const byLot = new Map();
  for (const lot of lots) {
    const lotId = requireUuid(lot?.lotId, "Finished lot ID");
    if (byLot.has(lotId)) throw new Error("Finished lot history contains a duplicate lot ID.");
    const menuItemId = requireUuid(lot.menuItemId, "Finished menu item ID");
    const produced = normalizeQuantity(lot.producedQuantity, { unit: lot.unit, stockClass: "finished" });
    byLot.set(lotId, {
      lotId, menuItemId, producedQuantity: produced.quantity, unit: produced.unit,
      allocatedScaled: 0n, producedScaled: produced.scaled,
      ...(lot.producedAt ? { producedAt: requireUtcInstant(lot.producedAt, "Lot production timestamp") } : {}),
    });
  }

  for (const allocation of allocations) {
    const lotId = requireUuid(allocation?.lotId, "Allocated finished lot ID");
    const lot = byLot.get(lotId);
    if (!lot) throw new Error("Lot allocation references a lot outside this business result.");
    if (allocation.unit !== lot.unit) throw new Error("Lot allocation unit does not match the production lot.");
    const parsed = normalizeQuantity(allocation.quantity, { unit: allocation.unit, stockClass: "finished" });
    lot.allocatedScaled += parsed.scaled;
    if (lot.allocatedScaled > lot.producedScaled) {
      throw new RangeError("Lot allocation history exceeds produced quantity.");
    }
  }

  return Object.freeze([...byLot.values()].map((lot) => Object.freeze({
    lotId: lot.lotId,
    menuItemId: lot.menuItemId,
    producedQuantity: lot.producedQuantity,
    allocatedQuantity: formatQuantity(lot.allocatedScaled),
    remainingQuantity: formatQuantity(lot.producedScaled - lot.allocatedScaled),
    unit: lot.unit,
    ...(lot.producedAt ? { producedAt: lot.producedAt } : {}),
  })));
}

/**
 * Build an atomic stock reduction for one finished-product disposition.
 * Sale pricing/revenue remain in the sales domain; this command only posts stock and lot allocation.
 * @param {{
 *  businessId:string, dispositionId:string, dispositionType:string, quantity:string, unit:string,
 *  allocations:Array<{lotId:string,quantity:string,unit:string}>,
 *  lots:Array<{lotId:string,menuItemId:string,producedQuantity:string,unit:string,producedAt?:string}>,
 *  priorAllocations?:Array<{lotId:string,quantity:string,unit:string}>,
 *  commandId?:string, eventId?:string, occurredAt?:string, saleId?:string, reason?:string
 * }} input
 */
export function buildFinishedDispositionCommand(input) {
  if (!input || typeof input !== "object") throw new TypeError("Finished-stock disposition is required.");
  const businessId = requireUuid(input.businessId, "Server business ID");
  const dispositionId = requireUuid(input.dispositionId, "Disposition ID");
  const dispositionType = requireText(input.dispositionType, "Disposition type");
  const kind = DISPOSITION_KIND[dispositionType];
  if (!kind) throw new Error("Unsupported finished-stock disposition type.");
  const quantity = normalizeQuantity(input.quantity, { unit: input.unit, stockClass: "finished" });
  const occurredAt = requireUtcInstant(input.occurredAt ?? new Date().toISOString(), "Disposition timestamp");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (dispositionType === "waste" && !reason) throw new Error("Discarded or wasted finished stock requires a reason.");
  if (dispositionType === "discounted_sale" && !reason) throw new Error("A discounted sale requires a discount reason.");
  const saleId = ["sale", "discounted_sale"].includes(dispositionType)
    ? requireUuid(input.saleId, "Sales record ID")
    : undefined;

  const lots = projectFinishedLotBalances(input.lots, input.priorAllocations ?? []);
  const lotById = new Map(lots.map((lot) => [lot.lotId, lot]));
  const allocations = validateLotAllocations(input.allocations, { quantity: quantity.quantity, unit: quantity.unit });
  if (allocations.length === 0) throw new Error("A finished-stock disposition requires explicit lot allocations.");
  const selectedLots = allocations.map((allocation) => {
    const lot = lotById.get(allocation.lotId);
    if (!lot) throw new Error("Disposition references a finished lot outside this business.");
    if (lot.unit !== quantity.unit) throw new Error("Disposition unit must match every selected lot.");
    if (lot.remainingQuantity === "0") throw new Error("Disposition references an exhausted finished lot.");
    const allocatedForLot = allocations.filter((item) => item.lotId === lot.lotId)
      .reduce((sum, item) => sum + parseQuantity(item.quantity), 0n);
    if (allocatedForLot > parseQuantity(lot.remainingQuantity)) {
      throw new RangeError("Disposition exceeds the selected lot's remaining quantity.");
    }
    return lot;
  });
  const menuItemId = selectedLots[0]?.menuItemId;
  if (!menuItemId || selectedLots.some((lot) => lot.menuItemId !== menuItemId)) {
    throw new Error("A disposition must target lots of one finished menu item.");
  }

  const commandId = requireUuid(input.commandId ?? crypto.randomUUID(), "Inventory command ID");
  const eventId = requireUuid(input.eventId ?? crypto.randomUUID(), "Stock movement event ID");
  const sourceType = dispositionType;
  const sourceId = saleId ?? dispositionId;
  return Object.freeze({
    commandId,
    businessId,
    commandType: "stock_movement",
    payload: {
      movements: [Object.freeze({
        eventId,
        stockItemId: menuItemId,
        stockClass: "finished",
        kind,
        direction: "out",
        quantity: quantity.quantity,
        unit: quantity.unit,
        sourceType,
        sourceId,
        recordedAt: occurredAt,
        effectiveAt: occurredAt,
        ...(reason ? { reason } : {}),
      })],
      lots: [],
      allocations: allocations.map((allocation) => Object.freeze({
        eventId, lotId: allocation.lotId, quantity: allocation.quantity, unit: allocation.unit,
      })),
    },
  });
}

/**
 * Record a suitability decision for carrying remaining stock into a later day's inventory view.
 * This is a handling event only: it intentionally creates no stock movement or new production lot.
 * The caller must persist/sync the returned append-only event before presenting it as recorded.
 * @param {{eventId?:string,businessId:string,lotId:string,remainingQuantity:string,unit:string,suitable:boolean,confirmedAt:string,carryForwardDate:string,reason?:string,lots:Array<{lotId:string,menuItemId:string,producedQuantity:string,unit:string,producedAt?:string}>,priorAllocations?:Array<{lotId:string,quantity:string,unit:string}>}} input
 */
export function buildCarryForwardDecision(input) {
  if (!input || typeof input !== "object") throw new TypeError("Carry-forward decision is required.");
  const businessId = requireUuid(input.businessId, "Server business ID");
  const lotId = requireUuid(input.lotId, "Finished lot ID");
  if (input.suitable !== true) throw new Error("Operator must explicitly confirm the lot is safe and suitable for carry-forward.");
  const quantity = normalizeQuantity(input.remainingQuantity, { unit: input.unit, stockClass: "finished" });
  const projectedLot = projectFinishedLotBalances(input.lots, input.priorAllocations ?? [])
    .find((lot) => lot.lotId === lotId);
  if (!projectedLot) throw new Error("Carry-forward references a lot outside this business.");
  if (projectedLot.unit !== quantity.unit || projectedLot.remainingQuantity !== quantity.quantity) {
    throw new Error("Carry-forward quantity must equal the ledger-derived remaining quantity.");
  }
  if (!/^\d{4}-\d\d-\d\d$/.test(input.carryForwardDate ?? "")) {
    throw new TypeError("Carry-forward date must use YYYY-MM-DD.");
  }
  const date = new Date(input.carryForwardDate + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.carryForwardDate) {
    throw new TypeError("Carry-forward date must be a valid calendar date.");
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  return Object.freeze({
    eventId: requireUuid(input.eventId ?? crypto.randomUUID(), "Carry-forward event ID"),
    businessId,
    lotId,
    dispositionType: "carry_forward",
    quantity: quantity.quantity,
    unit: quantity.unit,
    carryForwardDate: input.carryForwardDate,
    confirmedAt: requireUtcInstant(input.confirmedAt, "Carry-forward confirmation timestamp"),
    ...(reason ? { reason } : {}),
    inventoryEffect: "none",
  });
}
