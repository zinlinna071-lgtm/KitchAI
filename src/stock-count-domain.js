import { formatQuantity, normalizeQuantity, parseQuantity } from "./inventory-domain.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOCK_CLASSES = new Set(["ingredient", "finished"]);
const UNITS = new Set(["g", "kg", "ml", "l", "each"]);
const SESSION_STATES = new Set(["open", "ready_for_review", "posted", "cancelled"]);
const LINE_STATES = new Set(["counted", "reviewed", "posted", "stale"]);

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}
function requireUtc(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) {
    throw new TypeError(label + " must be an ISO 8601 UTC timestamp.");
  }
  return new Date(value).toISOString();
}
function requireUuid(value, label) {
  const text = requireText(value, label);
  if (!UUID_RE.test(text)) throw new TypeError(label + " must be a UUID.");
  return text;
}
function normalizeUnit(unit) {
  if (!UNITS.has(unit)) throw new TypeError("Choose a supported stock unit: g, kg, ml, l, or each.");
  return unit;
}
function signedQuantity(scaled) {
  return (scaled < 0n ? "-" : "") + formatQuantity(scaled < 0n ? -scaled : scaled);
}

/** Build a durable local-first count session. Local and server business IDs remain separate. */
export function buildStockCountSession(input) {
  if (!input || typeof input !== "object") throw new TypeError("Stock-count session is required.");
  const sessionId = requireUuid(input.sessionId, "Count session ID");
  const ownerId = requireText(input.ownerId, "Owner scope");
  const businessId = requireText(input.businessId, "Local business partition");
  const remoteBusinessId = requireUuid(input.remoteBusinessId, "Server business ID");
  const createdAt = requireUtc(input.createdAt ?? new Date().toISOString(), "Session timestamp");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) throw new RangeError("Session note must not exceed 500 characters.");
  return Object.freeze({
    sessionId, ownerId, businessId, remoteBusinessId,
    status: "open", createdAt, updatedAt: createdAt, note,
    cancelledAt: null, postedAt: null,
  });
}

/** Build a count line from a server snapshot. A missing ledger unit must be supplied explicitly. */
export function buildStockCountLine(input) {
  if (!input || typeof input !== "object") throw new TypeError("Stock-count line is required.");
  const lineId = requireUuid(input.lineId, "Count line ID");
  const sessionId = requireUuid(input.sessionId, "Count session ID");
  const stockClass = input.stockClass;
  if (!STOCK_CLASSES.has(stockClass)) throw new TypeError("Stock class must be ingredient or finished.");
  const stockItemId = requireUuid(input.stockItemId, "Stock item ID");
  const stockItemName = requireText(input.stockItemName, "Stock item name");
  if (stockItemName.length > 120) throw new RangeError("Stock item name must not exceed 120 characters.");
  const version = requireText(input.version, "Snapshot version");
  if (!/^\d+$/.test(version)) throw new TypeError("Snapshot version must be a non-negative integer string.");
  const systemQuantity = normalizeQuantity(input.systemQuantity, { unit: input.unit, stockClass, positive: false }).quantity;
  const unit = normalizeUnit(input.unit);
  const snapshotAt = requireUtc(input.snapshotAt, "Snapshot timestamp");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) throw new RangeError("Count-line note must not exceed 500 characters.");
  return Object.freeze({
    lineId, sessionId, stockClass, stockItemId, stockItemName, version,
    systemQuantity, unit, snapshotAt,
    countedQuantity: null, variance: null, reason: "",
    note, state: "open", reviewedBy: null, reviewedAt: null, postedAt: null,
  });
}

/** Record an exact observed count. Zero is valid; null means not yet counted. */
export function recordStockCount(line, countedQuantity, note = line?.note ?? "") {
  if (!line || typeof line !== "object" || !["open", "counted"].includes(line.state)) {
    throw new Error("Only an unposted, non-reviewed count line can be edited.");
  }
  const normalized = normalizeQuantity(countedQuantity, { unit: line.unit, stockClass: line.stockClass, positive: false });
  if (line.unit === "each" && normalized.scaled % 1000000n !== 0n) {
    throw new RangeError("Counts in each must be whole numbers.");
  }
  const variance = normalized.scaled - parseQuantity(line.systemQuantity);
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (cleanNote.length > 500) throw new RangeError("Count-line note must not exceed 500 characters.");
  return Object.freeze({
    ...line, countedQuantity: normalized.quantity, variance: signedQuantity(variance),
    note: cleanNote, state: "counted", reason: "", reviewedBy: null, reviewedAt: null,
  });
}

/** Review a completed line. Every non-zero variance requires an explicit reason. */
export function reviewStockCountLine(line, input) {
  if (!line || line.state !== "counted" || line.countedQuantity === null || line.variance === null) {
    throw new Error("Enter an exact counted quantity before reviewing this line.");
  }
  const reviewedBy = requireText(input?.reviewedBy, "Reviewer ID");
  const reviewedAt = requireUtc(input?.reviewedAt ?? new Date().toISOString(), "Review timestamp");
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (line.variance !== "0" && !reason) throw new TypeError("A non-zero stock-count variance requires a reason.");
  if (reason.length > 500) throw new RangeError("Count adjustment reason must not exceed 500 characters.");
  return Object.freeze({ ...line, reason, state: "reviewed", reviewedBy, reviewedAt });
}

/** Recompute a session projection without changing persisted audit records. */
export function projectStockCountSession(session, lines) {
  if (!session || !SESSION_STATES.has(session.status) || !Array.isArray(lines)) {
    throw new TypeError("A valid stock-count session and line list are required.");
  }
  const scoped = lines.filter(line => line.sessionId === session.sessionId);
  return {
    ...session,
    lineCount: scoped.length,
    countedLineCount: scoped.filter(line => line.countedQuantity !== null && line.countedQuantity !== undefined).length,
    reviewedLineCount: scoped.filter(line => line.state === "reviewed" || line.state === "posted").length,
    postedLineCount: scoped.filter(line => line.state === "posted").length,
    staleLineCount: scoped.filter(line => line.state === "stale").length,
  };
}

/** Cancellation is allowed only before any count line has been posted. */
export function cancelStockCountSession(session, lines, cancelledAt = new Date().toISOString()) {
  if (!session || !["open", "ready_for_review"].includes(session.status)) {
    throw new Error("Only an unposted stock-count session can be cancelled.");
  }
  if (!Array.isArray(lines) || lines.some(line => line.sessionId === session.sessionId && line.state === "posted")) {
    throw new Error("A stock-count session with an accepted adjustment cannot be cancelled; use a linked correction instead.");
  }
  return Object.freeze({ ...session, status: "cancelled", cancelledAt: requireUtc(cancelledAt, "Cancellation timestamp"), updatedAt: requireUtc(cancelledAt, "Cancellation timestamp") });
}
