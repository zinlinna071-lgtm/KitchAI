import { formatQuantity, normalizeQuantity, parseQuantity } from "./inventory-domain.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const UNITS = new Set(["g", "kg", "ml", "l", "each"]);

function text(value, label, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  const result = value.trim();
  if (result.length > max) throw new RangeError(label + " is too long.");
  return result;
}
function uuid(value, label) {
  const result = text(value, label);
  if (!UUID.test(result)) throw new TypeError(label + " must be a UUID.");
  return result;
}
function price(value, label = "Unit price") {
  if (typeof value !== "string" || !MONEY.test(value)) throw new TypeError(label + " must be a non-negative decimal with at most four fractional digits.");
  return value;
}
function sumQuantities(values) {
  return values.reduce((total, value) => total + parseQuantity(value), 0n);
}

/** Normalize a local purchase draft without changing stock. No price is treated as official valuation. */
export function buildPurchaseDraft(input, options = {}) {
  if (!input || typeof input !== "object") throw new TypeError("Purchase details are required.");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100) {
    throw new RangeError("A purchase must contain between 1 and 100 ingredient lines.");
  }
  const purchaseId = uuid(input.purchaseId ?? crypto.randomUUID(), "Purchase ID");
  const createdAt = options.createdAt ?? input.createdAt ?? new Date().toISOString();
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt))) throw new TypeError("Purchase date must be valid.");
  const currency = text(input.currency ?? "THB", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("Currency must be a three-letter code.");
  const lines = input.lines.map((line, index) => {
    const unit = text(line.unit, "Unit", 8);
    if (!UNITS.has(unit)) throw new TypeError("Choose a supported unit: g, kg, ml, l, or each.");
    const quantity = normalizeQuantity(line.orderedQuantity, { unit, stockClass: "ingredient" }).quantity;
    return {
      lineId: uuid(line.lineId ?? crypto.randomUUID(), "Purchase line ID"),
      ingredientId: uuid(line.ingredientId, "Ingredient ID"),
      ingredientName: text(line.ingredientName, "Ingredient name", 240),
      orderedQuantity: quantity,
      unit,
      unitPrice: price(line.unitPrice),
      position: index,
    };
  });
  if (new Set(lines.map(line => line.lineId)).size !== lines.length) throw new Error("Purchase line IDs must be unique.");
  if (new Set(lines.map(line => line.ingredientId)).size !== lines.length) throw new Error("Each ingredient may appear only once in a purchase; keep one consistent unit per ingredient.");
  return {
    purchaseId,
    supplierName: typeof input.supplierName === "string" ? input.supplierName.trim().slice(0, 200) : "",
    currency,
    note: typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "",
    createdAt,
    status: "open",
    lines,
    receipts: [],
    cancelledAt: null,
    cancellationReason: null,
  };
}

/** Build a stable stock_receipt command. The command is persisted before any network attempt. */
export function buildPurchaseReceiptCommand(purchase, entries, options = {}) {
  if (!purchase || typeof purchase !== "object" || !Array.isArray(purchase.lines)) throw new TypeError("Purchase record is required.");
  if (purchase.status === "cancelled" || purchase.status === "received") throw new Error("This purchase cannot accept another receipt.");
  if (!Array.isArray(entries) || entries.length < 1) throw new Error("Enter at least one received quantity.");
  const receiptId = uuid(options.receiptId ?? crypto.randomUUID(), "Receipt ID");
  const commandId = uuid(options.commandId ?? crypto.randomUUID(), "Inventory command ID");
  const recordedAt = options.recordedAt ?? new Date().toISOString();
  if (typeof recordedAt !== "string" || !Number.isFinite(Date.parse(recordedAt))) throw new TypeError("Receipt timestamp must be valid.");
  const seen = new Set();
  const movements = entries.map((entry) => {
    const line = purchase.lines.find(candidate => candidate.lineId === entry.lineId);
    if (!line) throw new Error("Receipt line is outside this purchase.");
    if (seen.has(line.lineId)) throw new Error("A receipt cannot contain duplicate purchase lines.");
    seen.add(line.lineId);
    const quantity = normalizeQuantity(entry.quantity, { unit: line.unit, stockClass: "ingredient" }).quantity;
    const previouslyReserved = (purchase.receipts ?? []).flatMap(receipt => receipt.lines ?? [])
      .filter(receiptLine => receiptLine.lineId === line.lineId)
      .map(receiptLine => receiptLine.quantity);
    const receivedScaled = sumQuantities(previouslyReserved) + parseQuantity(quantity);
    if (receivedScaled > parseQuantity(line.orderedQuantity)) throw new RangeError("Received quantity cannot exceed the unreceived purchase quantity.");
    return {
      eventId: uuid(entry.eventId ?? crypto.randomUUID(), "Stock event ID"),
      stockClass: "ingredient",
      stockItemId: line.ingredientId,
      kind: "purchase_receipt",
      direction: "in",
      quantity,
      unit: line.unit,
      sourceType: "purchase",
      sourceId: purchase.purchaseId,
      reason: "Receipt " + receiptId + (purchase.supplierName ? " · " + purchase.supplierName : ""),
    };
  });
  return {
    receiptId,
    command: {
      commandId,
      businessId: uuid(options.remoteBusinessId, "Server business ID"),
      commandType: "stock_receipt",
      payload: { movements, lots: [], allocations: [] },
    },
    lines: entries.map(entry => ({
      lineId: entry.lineId,
      quantity: normalizeQuantity(entry.quantity, {
        unit: purchase.lines.find(candidate => candidate.lineId === entry.lineId)?.unit,
        stockClass: "ingredient",
      }).quantity,
      unit: purchase.lines.find(candidate => candidate.lineId === entry.lineId)?.unit,
    })),
    recordedAt,
    state: "pending",
    serverResult: null,
    lastError: null,
  };
}

/** Received totals include only server-confirmed receipts; pending quantities remain visibly reserved. */
export function projectPurchase(purchase) {
  if (!purchase || !Array.isArray(purchase.lines)) throw new TypeError("Purchase record is required.");
  return {
    ...structuredClone(purchase),
    lines: purchase.lines.map(line => {
      const synced = (purchase.receipts ?? []).flatMap(receipt => receipt.state === "synced" ? receipt.lines : [])
        .filter(entry => entry.lineId === line.lineId).map(entry => entry.quantity);
      const reserved = (purchase.receipts ?? []).filter(receipt => receipt.state !== "abandoned")
        .flatMap(receipt => receipt.lines ?? []).filter(entry => entry.lineId === line.lineId).map(entry => entry.quantity);
      const received = sumQuantities(synced);
      const reservedTotal = sumQuantities(reserved);
      return {
        ...line,
        receivedQuantity: formatQuantity(received),
        reservedQuantity: formatQuantity(reservedTotal),
        outstandingQuantity: formatQuantity(parseQuantity(line.orderedQuantity) - reservedTotal),
      };
    }),
  };
}
