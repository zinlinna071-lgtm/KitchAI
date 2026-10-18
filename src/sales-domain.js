const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAX_LINES = 100;

function requiredText(value, label, max = 240) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  const normalized = value.trim();
  if ([...normalized].length > max) throw new RangeError(label + " must be " + max + " characters or fewer.");
  return normalized;
}

function uuid(value, label) {
  const normalized = requiredText(value, label, 36);
  if (!UUID.test(normalized)) throw new TypeError(label + " must be a UUID.");
  return normalized;
}

function moneyToMinorUnits(value, label = "Unit price") {
  if (typeof value !== "string" || !MONEY.test(value)) {
    throw new TypeError(label + " must be a plain non-negative decimal with at most two fractional digits.");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function formatMinorUnits(value) {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  return (amount / 100n).toString() + "." + (amount % 100n).toString().padStart(2, "0");
}

/**
 * Build a local sale draft with menu-name/price snapshots.
 *
 * Prices are the actual amounts entered for this transaction. A discounted line
 * must not have its price inferred from the menu catalog; unknown discount rules
 * remain unknown. This function does not post inventory movements or claim a sale
 * has been accepted by the server.
 *
 * @param {{saleId?:string,createdAt?:string,currency?:string,lines:Array<{lineId?:string,menuItemId:string,menuItemName:string,quantity:number,unitPrice:string,discounted?:boolean}>}} input
 * @param {{createdAt?:string}} [options]
 */
export function buildSaleDraft(input, options = {}) {
  if (!input || typeof input !== "object") throw new TypeError("Sale details are required.");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > MAX_LINES) {
    throw new RangeError("A sale must contain between 1 and " + MAX_LINES + " lines.");
  }

  const saleId = uuid(input.saleId ?? crypto.randomUUID(), "Sale ID");
  const createdAt = options.createdAt ?? input.createdAt ?? new Date().toISOString();
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt))) {
    throw new TypeError("Sale date must be valid.");
  }
  const currency = requiredText(input.currency ?? "THB", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("Currency must be a three-letter code.");

  const lines = input.lines.map((line, index) => {
    if (!line || typeof line !== "object") throw new TypeError("Sale line " + (index + 1) + " is required.");
    const lineId = uuid(line.lineId ?? crypto.randomUUID(), "Sale line ID");
    const menuItemId = uuid(line.menuItemId, "Menu item ID");
    const menuItemName = requiredText(line.menuItemName, "Menu item name");
    if (typeof line.quantity !== "number" || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new TypeError("Sale quantity must be a positive whole number.");
    }
    const unitPriceMinor = moneyToMinorUnits(line.unitPrice);
    if (unitPriceMinor <= 0n) throw new RangeError("Sale unit price must be greater than zero; free items should use a non-sale disposition.");
    if (line.discounted !== undefined && typeof line.discounted !== "boolean") {
      throw new TypeError("Discounted must be true or false.");
    }
    return {
      lineId,
      menuItemId,
      menuItemName,
      quantity: line.quantity,
      unit: "each",
      unitPrice: formatMinorUnits(unitPriceMinor),
      lineTotal: formatMinorUnits(unitPriceMinor * BigInt(line.quantity)),
      discounted: line.discounted ?? false,
      position: index,
    };
  });

  if (new Set(lines.map(line => line.lineId)).size !== lines.length) {
    throw new Error("Sale line IDs must be unique.");
  }

  const totalMinor = lines.reduce((sum, line) => sum + moneyToMinorUnits(line.lineTotal, "Line total"), 0n);
  return {
    saleId,
    createdAt: new Date(createdAt).toISOString(),
    currency,
    status: "draft",
    saleType: lines.some(line => line.discounted) ? "discounted" : "regular",
    lines,
    totalAmount: formatMinorUnits(totalMinor),
    // Drafting a sale never changes stock. Posting must be a separate trusted,
    // idempotent command that atomically records the sale and lot allocations.
    inventoryEffect: "none",
  };
}

/** Recompute totals from the immutable line price snapshots without floating point. */
export function projectSale(sale) {
  if (!sale || !Array.isArray(sale.lines)) throw new TypeError("Sale record is required.");
  const totalMinor = sale.lines.reduce((sum, line) => {
    if (typeof line.quantity !== "number" || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new TypeError("Stored sale quantity is invalid.");
    }
    return sum + moneyToMinorUnits(line.unitPrice, "Stored unit price") * BigInt(line.quantity);
  }, 0n);
  return {
    ...structuredClone(sale),
    totalAmount: formatMinorUnits(totalMinor),
    saleType: sale.lines.some(line => line.discounted === true) ? "discounted" : "regular",
  };
}
