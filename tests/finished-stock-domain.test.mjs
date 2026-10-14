import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCarryForwardDecision,
  buildFinishedDispositionCommand,
  projectFinishedLotBalances,
} from "../src/finished-stock-domain.js";

const businessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const menuA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const menuB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const lotA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const lotB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const lotC = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const dispositionId = "11111111-1111-4111-8111-111111111111";
const commandId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const saleId = "44444444-4444-4444-8444-444444444444";
const lots = [
  { lotId: lotA, menuItemId: menuA, producedQuantity: "10", unit: "each", producedAt: "2026-10-14T09:00:00Z" },
  { lotId: lotB, menuItemId: menuA, producedQuantity: "5", unit: "each", producedAt: "2026-10-14T10:00:00Z" },
  { lotId: lotC, menuItemId: menuB, producedQuantity: "3", unit: "each", producedAt: "2026-10-14T11:00:00Z" },
];
const priorAllocations = [{ lotId: lotA, quantity: "2", unit: "each" }];

test("finished lot balance is derived exactly from production quantity minus immutable allocations", () => {
  assert.deepEqual(projectFinishedLotBalances(lots, priorAllocations).map((lot) => ({
    lotId: lot.lotId, producedQuantity: lot.producedQuantity,
    allocatedQuantity: lot.allocatedQuantity, remainingQuantity: lot.remainingQuantity,
  })), [
    { lotId: lotA, producedQuantity: "10", allocatedQuantity: "2", remainingQuantity: "8" },
    { lotId: lotB, producedQuantity: "5", allocatedQuantity: "0", remainingQuantity: "5" },
    { lotId: lotC, producedQuantity: "3", allocatedQuantity: "0", remainingQuantity: "3" },
  ]);
});

test("lot projection rejects duplicate, unknown, unit-mismatched, and over-allocated history", () => {
  assert.throws(() => projectFinishedLotBalances([lots[0], lots[0]], []), /duplicate lot ID/);
  assert.throws(() => projectFinishedLotBalances(lots, [{ lotId: lotC, quantity: "1", unit: "kg" }]), /unit does not match/);
  assert.throws(() => projectFinishedLotBalances(lots, [{ lotId: lotC, quantity: "4", unit: "each" }]), /exceeds produced quantity/);
  assert.throws(() => projectFinishedLotBalances(lots, [{ lotId: businessId, quantity: "1", unit: "each" }]), /outside this business/);
});

test("sale command links the stock movement to its sale and allocates the exact reduction to named lots", () => {
  const command = buildFinishedDispositionCommand({
    businessId, dispositionId, dispositionType: "sale", saleId, quantity: "6", unit: "each",
    allocations: [
      { lotId: lotA, quantity: "4", unit: "each" },
      { lotId: lotB, quantity: "2", unit: "each" },
    ],
    lots, priorAllocations, commandId, eventId, occurredAt: "2026-10-14T12:00:00Z",
  });
  assert.equal(command.commandType, "stock_movement");
  assert.equal(command.businessId, businessId);
  assert.equal(command.payload.movements.length, 1);
  assert.equal(command.payload.movements[0].kind, "sale");
  assert.equal(command.payload.movements[0].sourceType, "sale");
  assert.equal(command.payload.movements[0].sourceId, saleId);
  assert.equal(command.payload.movements[0].quantity, "6");
  assert.equal(command.payload.allocations.reduce((sum, row) => sum + Number(row.quantity), 0), 6);
  assert.ok(command.payload.allocations.every((row) => row.eventId === eventId));
  assert.deepEqual(command.payload.lots, []);
  assert.equal("price" in command.payload.movements[0], false, "pricing remains in the sales domain");
});

test("discounted sale is traceable as a distinct outcome but uses the canonical sale stock kind", () => {
  const command = buildFinishedDispositionCommand({
    businessId, dispositionId, dispositionType: "discounted_sale", saleId, quantity: "1", unit: "each",
    allocations: [{ lotId: lotA, quantity: "1", unit: "each" }], lots, priorAllocations,
    commandId, eventId, occurredAt: "2026-10-14T12:00:00Z", reason: "Near end of safe sale window",
  });
  assert.equal(command.payload.movements[0].kind, "sale");
  assert.equal(command.payload.movements[0].sourceType, "discounted_sale");
  assert.equal(command.payload.movements[0].sourceId, saleId);
  assert.equal(command.payload.movements[0].reason, "Near end of safe sale window");
  assert.throws(() => buildFinishedDispositionCommand({
    businessId, dispositionId, dispositionType: "discounted_sale", saleId, quantity: "1", unit: "each",
    allocations: [{ lotId: lotA, quantity: "1", unit: "each" }], lots, priorAllocations, commandId, eventId,
  }), /discount reason/);
});

test("owner consumption, giveaway, and waste are distinct non-revenue stock outcomes", () => {
  for (const [dispositionType, kind, reason] of [
    ["owner_consumption", "owner_consumption", undefined],
    ["giveaway", "giveaway", undefined],
    ["waste", "waste", "Spoiled before service"],
  ]) {
    const command = buildFinishedDispositionCommand({
      businessId, dispositionId, dispositionType, quantity: "1", unit: "each",
      allocations: [{ lotId: lotA, quantity: "1", unit: "each" }], lots, priorAllocations,
      commandId, eventId, occurredAt: "2026-10-14T12:00:00Z", reason,
    });
    assert.equal(command.payload.movements[0].kind, kind);
    assert.equal(command.payload.movements[0].direction, "out");
    assert.equal(command.payload.movements[0].sourceType, dispositionType);
    assert.equal(command.payload.movements[0].sourceId, dispositionId);
  }
  assert.throws(() => buildFinishedDispositionCommand({
    businessId, dispositionId, dispositionType: "waste", quantity: "1", unit: "each",
    allocations: [{ lotId: lotA, quantity: "1", unit: "each" }], lots, priorAllocations, commandId, eventId,
  }), /requires a reason/);
});

test("disposition rejects mismatched allocation totals, insufficient lot balance, and mixed menu items", () => {
  const base = {
    businessId, dispositionId, dispositionType: "sale", saleId, quantity: "2", unit: "each",
    lots, priorAllocations, commandId, eventId, occurredAt: "2026-10-14T12:00:00Z",
  };
  assert.throws(() => buildFinishedDispositionCommand({
    ...base, allocations: [{ lotId: lotA, quantity: "1", unit: "each" }],
  }), /sum exactly/);
  assert.throws(() => buildFinishedDispositionCommand({
    ...base, quantity: "9", allocations: [{ lotId: lotA, quantity: "9", unit: "each" }],
  }), /remaining quantity/);
  assert.throws(() => buildFinishedDispositionCommand({
    ...base, quantity: "2", allocations: [
      { lotId: lotA, quantity: "1", unit: "each" },
      { lotId: lotC, quantity: "1", unit: "each" },
    ],
  }), /one finished menu item/);
});

test("carry-forward records suitability and quantity without creating a movement or a new lot", () => {
  const decision = buildCarryForwardDecision({
    eventId, businessId, lotId: lotA, remainingQuantity: "8", unit: "each", suitable: true,
    confirmedAt: "2026-10-14T17:00:00Z", carryForwardDate: "2026-10-15",
    reason: "Stored safely under required temperature", lots, priorAllocations,
  });
  assert.deepEqual(decision, {
    eventId, businessId, lotId: lotA, dispositionType: "carry_forward", quantity: "8", unit: "each",
    carryForwardDate: "2026-10-15", confirmedAt: "2026-10-14T17:00:00.000Z",
    reason: "Stored safely under required temperature", inventoryEffect: "none",
  });
  assert.throws(() => buildCarryForwardDecision({
    businessId, lotId: lotA, remainingQuantity: "8", unit: "each", suitable: false,
    confirmedAt: "2026-10-14T17:00:00Z", carryForwardDate: "2026-10-15", lots, priorAllocations,
  }), /explicitly confirm/);
  assert.throws(() => buildCarryForwardDecision({
    businessId, lotId: lotA, remainingQuantity: "0", unit: "each", suitable: true,
    confirmedAt: "2026-10-14T17:00:00Z", carryForwardDate: "2026-02-30", lots, priorAllocations,
  }));
  assert.throws(() => buildCarryForwardDecision({
    businessId, lotId: lotA, remainingQuantity: "7", unit: "each", suitable: true,
    confirmedAt: "2026-10-14T17:00:00Z", carryForwardDate: "2026-10-15", lots, priorAllocations,
  }), /ledger-derived remaining quantity/);
});
