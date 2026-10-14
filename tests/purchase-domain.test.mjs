import test from "node:test";
import assert from "node:assert/strict";
import { buildPurchaseDraft, buildPurchaseReceiptCommand, projectPurchase } from "../src/purchase-domain.js";

const purchaseId = "11111111-1111-4111-8111-111111111111";
const lineId = "22222222-2222-4222-8222-222222222222";
const ingredientId = "33333333-3333-4333-8333-333333333333";
const businessId = "44444444-4444-4444-8444-444444444444";
const receiptId = "55555555-5555-4555-8555-555555555555";
const commandId = "66666666-6666-4666-8666-666666666666";
const eventId = "77777777-7777-4777-8777-777777777777";

function purchase() {
  return buildPurchaseDraft({
    purchaseId, supplierName: "Market", currency: "THB",
    lines: [{ lineId, ingredientId, ingredientName: "Rice", orderedQuantity: "10", unit: "kg", unitPrice: "34.50" }],
  }, { createdAt: "2026-10-14T09:00:00Z" });
}

test("purchase draft is validated and never claims to change stock", () => {
  const result = purchase();
  assert.equal(result.status, "open");
  assert.equal(result.lines[0].orderedQuantity, "10");
  assert.deepEqual(result.receipts, []);
  assert.equal(result.currency, "THB");
});
test("purchase rejects unsupported units, non-decimal quantity, duplicate lines and invalid money", () => {
  assert.throws(() => buildPurchaseDraft({ lines: [{ ingredientId, ingredientName: "Rice", orderedQuantity: "1e3", unit: "kg", unitPrice: "1" }] }), /plain decimal/);
  assert.throws(() => buildPurchaseDraft({ lines: [{ ingredientId, ingredientName: "Rice", orderedQuantity: "1", unit: "cup", unitPrice: "1" }] }), /supported unit/);
  assert.throws(() => buildPurchaseDraft({ lines: [{ ingredientId, ingredientName: "Rice", orderedQuantity: "1", unit: "kg", unitPrice: "-1" }] }), /non-negative decimal/);
});
test("receipt command uses one stable source and exact positive movements", () => {
  const result = buildPurchaseReceiptCommand(purchase(), [{ lineId, quantity: "3.25", eventId }], {
    receiptId, commandId, remoteBusinessId: businessId, recordedAt: "2026-10-14T10:00:00Z",
  });
  assert.equal(result.command.commandType, "stock_receipt");
  assert.equal(result.command.payload.movements[0].quantity, "3.25");
  assert.equal(result.command.payload.movements[0].stockItemId, ingredientId);
  assert.equal(result.command.payload.movements[0].sourceId, purchaseId);
  assert.equal(result.state, "pending");
});
test("partial receipts reserve quantities, allow later partial receipt, and reject over-receipt", () => {
  const first = buildPurchaseReceiptCommand(purchase(), [{ lineId, quantity: "6" }], {
    receiptId, commandId, remoteBusinessId: businessId,
  });
  const withFirst = { ...purchase(), receipts: [first] };
  const second = buildPurchaseReceiptCommand(withFirst, [{ lineId, quantity: "4" }], {
    receiptId: "88888888-8888-4888-8888-888888888888",
    commandId: "99999999-9999-4999-8999-999999999999", remoteBusinessId: businessId,
  });
  assert.equal(second.lines[0].quantity, "4");
  assert.throws(() => buildPurchaseReceiptCommand(withFirst, [{ lineId, quantity: "4.000001" }], {
    remoteBusinessId: businessId,
  }), /cannot exceed/);
});
test("purchase projection separates confirmed from pending quantities", () => {
  const pending = buildPurchaseReceiptCommand(purchase(), [{ lineId, quantity: "3" }], {
    receiptId, commandId, remoteBusinessId: businessId,
  });
  const projected = projectPurchase({ ...purchase(), receipts: [pending] });
  assert.equal(projected.lines[0].receivedQuantity, "0");
  assert.equal(projected.lines[0].reservedQuantity, "3");
  assert.equal(projected.lines[0].outstandingQuantity, "7");
});
