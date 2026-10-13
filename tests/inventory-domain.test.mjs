import test from "node:test";
import assert from "node:assert/strict";
import {
  addQuantities, formatQuantity, normalizeQuantity, parseQuantity, subtractQuantities,
  validateCarryOver, validateLotAllocations, validateStockMovement,
} from "../src/inventory-domain.js";

test("exact decimal quantities parse, format, add, and subtract without float equality", () => {
  assert.equal(formatQuantity(parseQuantity("0.000001")), "0.000001");
  assert.equal(addQuantities("0.1", "0.2"), "0.3");
  assert.equal(subtractQuantities("10.000001", "0.000002"), "9.999999");
  assert.equal(addQuantities("999999999999999999.999999", "0"), "999999999999999999.999999");
});
test("malformed, non-string, excessive precision, and numeric(24,6) overflow are rejected", () => {
  for (const value of ["", "-1", "+1", "1e3", ".5", "01", "1.0000001", "1000000000000000000", "NaN"]) {
    assert.throws(() => parseQuantity(value));
  }
  assert.throws(() => parseQuantity(1));
  assert.throws(() => subtractQuantities("1", "1.000001"));
  assert.throws(() => addQuantities("999999999999999999.999999", "0.000001"));
});
test("unit allowlist and fractional-each rules are explicit", () => {
  for (const unit of ["g", "kg", "ml", "l", "each"]) {
    assert.equal(normalizeQuantity("1.25", { unit, stockClass: "ingredient" }).quantity, "1.25");
  }
  assert.throws(() => normalizeQuantity("1", { unit: "cup" }));
  assert.throws(() => normalizeQuantity("0", { unit: "g" }));
  assert.equal(normalizeQuantity("2", { unit: "each", stockClass: "finished" }).quantity, "2");
  assert.throws(() => normalizeQuantity("1.5", { unit: "each", stockClass: "finished" }));
});
test("movement contract requires scope, stable IDs, direction, source, and UTC timestamps", () => {
  const movement = validateStockMovement({
    ownerId: "owner-1", businessId: "business-1", eventId: "evt-1", stockItemId: "rice",
    stockClass: "ingredient", kind: "purchase_receipt", direction: "in", quantity: "2.25", unit: "kg",
    sourceType: "receipt", sourceId: "receipt-1",
    recordedAt: "2026-10-13T10:00:00.000Z", effectiveAt: "2026-10-13T10:00:00Z",
  });
  assert.equal(movement.quantity, "2.25");
  assert.equal(validateStockMovement({ ...movement, kind: "sale", direction: "out", stockClass: "finished" }).kind, "sale");
  assert.ok(Object.isFrozen(movement));
  assert.throws(() => validateStockMovement({ ...movement, direction: "out" }));
  assert.throws(() => validateStockMovement({ ...movement, kind: "correction", direction: "in" }));
  assert.throws(() => validateStockMovement({ ...movement, kind: "waste", direction: "out", reason: undefined }));
  assert.throws(() => validateStockMovement({ ...movement, kind: "count_adjustment", reason: "  " }));
  assert.equal(validateStockMovement({ ...movement, kind: "waste", direction: "out", reason: "spoiled" }).reason, "spoiled");
  assert.throws(() => validateStockMovement({ ...movement, recordedAt: "2026-10-13T10:00:00+07:00" }));
});
test("lot allocations require unique explicit lots and exact total", () => {
  assert.deepEqual(validateLotAllocations([
    { lotId: "lot-a", quantity: "2", unit: "each" },
    { lotId: "lot-b", quantity: "3", unit: "each" },
  ], { quantity: "5", unit: "each" }), [
    { lotId: "lot-a", quantity: "2", unit: "each" },
    { lotId: "lot-b", quantity: "3", unit: "each" },
  ]);
  assert.throws(() => validateLotAllocations([{ lotId: "lot-a", quantity: "2", unit: "each" }], { quantity: "3", unit: "each" }));
  assert.throws(() => validateLotAllocations([
    { lotId: "lot-a", quantity: "2", unit: "each" }, { lotId: "lot-a", quantity: "3", unit: "each" },
  ], { quantity: "5", unit: "each" }));
});
test("carry-over requires explicit suitability confirmation and does not alter stock", () => {
  assert.deepEqual(validateCarryOver({ lotId: "lot-a", suitable: true, confirmedAt: "2026-10-13T10:00:00Z" }), {
    lotId: "lot-a", suitable: true, confirmedAt: "2026-10-13T10:00:00Z",
  });
  assert.throws(() => validateCarryOver({ lotId: "lot-a", suitable: false, confirmedAt: "2026-10-13T10:00:00Z" }));
});
