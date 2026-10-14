import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipeSnapshot, buildProductionInventoryCommand, validateActualUsage, validateProductionOutput } from "../src/production-batch-store.js";

const recipe = {
  id: "recipe-1",
  menuItemId: "menu-1",
  name: "Chicken rice",
  instructions: "Cook rice, then assemble.",
  yieldPortions: 4,
  status: "active",
};
const lines = [
  { id: "line-b", recipeId: "recipe-1", ingredientId: "rice", quantity: 1.25, unit: "kg", position: 1, note: "" },
  { id: "line-a", recipeId: "recipe-1", ingredientId: "chicken", quantity: 0.5, unit: "kg", position: 0, note: "Trim first" },
];

test("captures recipe identity, exact decimal quantities, stable line IDs and presentation order", () => {
  const snapshot = buildRecipeSnapshot(recipe, lines, {
    snapshotId: "snapshot-1",
    capturedAt: "2026-10-14T10:00:00.000Z",
  });
  assert.equal(snapshot.snapshotId, "snapshot-1");
  assert.equal(snapshot.recipeId, "recipe-1");
  assert.equal(snapshot.recipeName, "Chicken rice");
  assert.equal(snapshot.yieldPortions, 4);
  assert.deepEqual(snapshot.lines.map((line) => line.lineId), ["line-a", "line-b"]);
  assert.equal(snapshot.lines[0].quantity, "0.5");
  assert.equal(snapshot.lines[1].quantity, "1.25");
  assert.equal(snapshot.lines[0].note, "Trim first");
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.lines));
  assert.ok(Object.isFrozen(snapshot.lines[0]));
});

test("a snapshot remains independent of later recipe and recipe-line edits", () => {
  const snapshot = buildRecipeSnapshot(recipe, lines, {
    snapshotId: "snapshot-immutable",
    capturedAt: "2026-10-14T10:00:00.000Z",
  });
  recipe.name = "Renamed menu";
  lines[0].quantity = 9;
  lines[0].position = 0;
  assert.equal(snapshot.recipeName, "Chicken rice");
  assert.equal(snapshot.lines.find((line) => line.lineId === "line-b").quantity, "1.25");
  assert.equal(snapshot.lines.find((line) => line.lineId === "line-b").position, 1);
});

test("nested conversion provenance is immutable and active recipes require a valid yield", () => {
  const provenance = { source: "kitchen-scale", details: { factor: 1000 } };
  const snapshot = buildRecipeSnapshot(recipe, [{
    id: "converted", recipeId: "recipe-1", ingredientId: "rice", quantity: 1, unit: "kg", position: 0,
    conversionProvenance: provenance,
  }], { snapshotId: "snapshot-provenance" });
  assert.ok(Object.isFrozen(snapshot.lines[0].conversionProvenance));
  assert.ok(Object.isFrozen(snapshot.lines[0].conversionProvenance.details));
  assert.throws(() => { snapshot.lines[0].conversionProvenance.details.factor = 2; }, TypeError);
  assert.throws(() => buildRecipeSnapshot({ ...recipe, yieldPortions: undefined }, lines));
});

test("legacy recipe lines default to exact; estimated and to-taste modes preserve uncertainty", () => {
  const snapshot = buildRecipeSnapshot(recipe, [
    { id: "exact", recipeId: "recipe-1", ingredientId: "salt", quantity: 0.01, unit: "kg", position: 0 },
    { id: "estimate", recipeId: "recipe-1", ingredientId: "oil", quantity: 0.2, quantityMode: "estimated", unit: "l", position: 1, note: "Approximate" },
    { id: "taste", recipeId: "recipe-1", ingredientId: "spice", quantityMode: "to_taste", unit: "g", position: 2, note: "Add to taste" },
  ], { snapshotId: "snapshot-modes" });
  assert.equal(snapshot.lines[0].quantityMode, "exact");
  assert.equal(snapshot.lines[0].quantity, "0.01");
  assert.equal(snapshot.lines[1].quantityMode, "estimated");
  assert.equal(snapshot.lines[1].quantity, "0.2");
  assert.equal(snapshot.lines[2].quantityMode, "to_taste");
  assert.equal("quantity" in snapshot.lines[2], false);
  assert.equal(snapshot.lines[2].note, "Add to taste");
});

test("rejects inactive recipes, missing lines, cross-recipe lines, bad units, invalid precision and ambiguous to-taste lines", () => {
  assert.throws(() => buildRecipeSnapshot({ ...recipe, status: "draft" }, lines));
  assert.throws(() => buildRecipeSnapshot(recipe, []));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], recipeId: "other" }]));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], unit: "cup" }]));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], quantity: 0.1 + 0.2 }]));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], quantity: 1e18 }]));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], quantityMode: "to_taste", note: "" }]));
  assert.throws(() => buildRecipeSnapshot(recipe, [{ ...lines[0], id: "line-b" }, { ...lines[1], id: "line-b" }]));
});


test("actual usage requires one explicit, valid decision per stable snapshot line", () => {
  const snapshot = buildRecipeSnapshot(recipe, [
    { id: "exact", recipeId: "recipe-1", ingredientId: "rice", quantity: 1, unit: "kg", position: 0 },
    { id: "estimate", recipeId: "recipe-1", ingredientId: "oil", quantity: 0.2, quantityMode: "estimated", unit: "l", position: 1 },
    { id: "taste", recipeId: "recipe-1", ingredientId: "salt", quantityMode: "to_taste", unit: "g", position: 2, note: "Add to taste" },
  ], { snapshotId: "usage-snapshot" });
  const usage = validateActualUsage(snapshot, [
    { lineId: "exact", disposition: "measured", quantity: "1", unit: "kg" },
    { lineId: "estimate", disposition: "accepted_estimate", quantity: "0.2", unit: "l", note: "Operator accepted the kitchen estimate" },
    { lineId: "taste", disposition: "measured", quantity: "0.004", unit: "g" },
  ]);
  assert.equal(usage.length, 3);
  assert.equal(usage.find((line) => line.lineId === "taste").quantity, "0.004");
  assert.throws(() => validateActualUsage(snapshot, usage.slice(0, 2)), /every recipe line/);
  assert.throws(() => validateActualUsage(snapshot, [...usage, usage[0]]), /every recipe line/);
  const byId = Object.fromEntries(usage.map((line) => [line.lineId, line]));
  assert.throws(() => validateActualUsage(snapshot, [
    { lineId: "exact", disposition: "measured", quantity: "0.9", unit: "kg" },
    byId.estimate, byId.taste,
  ]), /variance reason/);
  assert.throws(() => validateActualUsage(snapshot, [
    { lineId: "exact", disposition: "accepted_estimate", quantity: "0.9", unit: "kg", note: "Estimated" },
    byId.estimate, byId.taste,
  ]), /variance reason/);
  assert.throws(() => validateActualUsage(snapshot, [
    byId.exact,
    { lineId: "estimate", disposition: "accepted_estimate", quantity: "0.2", unit: "l" },
    byId.taste,
  ]), /operator note/);
  assert.throws(() => validateActualUsage(snapshot, [
    byId.exact, byId.estimate,
    { lineId: "taste", disposition: "not_used", note: "" },
  ]), /reason/);
  assert.throws(() => validateActualUsage(snapshot, [
    byId.exact, byId.estimate,
    { lineId: "taste", disposition: "measured", quantity: "0.004", unit: "kg" },
  ]), /snapshot unit/);
});

test("production output must have a positive supported quantity and match finished-stock unit rules", () => {
  assert.deepEqual(validateProductionOutput({
    productId: "menu-1", quantity: "12", unit: "each", note: "Packed 12 portions",
  }), { productId: "menu-1", quantity: "12", unit: "each", note: "Packed 12 portions" });
  assert.throws(() => validateProductionOutput({ productId: "menu-1", quantity: "0", unit: "each" }));
  assert.throws(() => validateProductionOutput({ productId: "menu-1", quantity: "1.5", unit: "each" }));
  assert.throws(() => validateProductionOutput({ productId: "menu-1", quantity: "1", unit: "portion" }));
});


test("production inventory command uses measured decisions, stable IDs, and one atomic finished lot", () => {
  const menuItemId = "11111111-1111-4111-8111-111111111111";
  const ingredientA = "22222222-2222-4222-8222-222222222222";
  const ingredientB = "33333333-3333-4333-8333-333333333333";
  const ingredientC = "44444444-4444-4444-8444-444444444444";
  const snapshot = buildRecipeSnapshot({
    ...recipe, id: "55555555-5555-4555-8555-555555555555", menuItemId,
  }, [
    { id: "line-a", recipeId: "55555555-5555-4555-8555-555555555555", ingredientId: ingredientA, quantity: 1, unit: "kg", position: 0 },
    { id: "line-b", recipeId: "55555555-5555-4555-8555-555555555555", ingredientId: ingredientB, quantity: 0.2, quantityMode: "estimated", unit: "l", position: 1, note: "Kitchen estimate" },
    { id: "line-c", recipeId: "55555555-5555-4555-8555-555555555555", ingredientId: ingredientC, quantityMode: "to_taste", unit: "g", position: 2, note: "Add to taste" },
  ], { snapshotId: "snapshot-production-command" });
  const batch = {
    batchId: "66666666-6666-4666-8666-666666666666",
    businessId: "77777777-7777-4777-8777-777777777777",
    state: "ready_to_post",
    snapshot,
    actualUsage: [
      { lineId: "line-a", disposition: "measured", quantity: "0.9", unit: "kg", varianceReason: "Scale showed less than the target" },
      { lineId: "line-b", disposition: "accepted_estimate", quantity: "0.2", unit: "l", note: "Accepted kitchen estimate" },
      { lineId: "line-c", disposition: "not_used", note: "Skipped for this batch" },
    ],
    output: { productId: menuItemId, quantity: "4", unit: "each" },
  };
  const options = {
    remoteBusinessId: "abababab-abab-4bab-8bab-abababababab",
    commandId: "88888888-8888-4888-8888-888888888888",
    occurredAt: "2026-10-14T10:00:00.000Z",
    outputEventId: "99999999-9999-4999-8999-999999999999",
    lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    movementEventIds: {
      "line-a": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "line-b": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
  };
  const command = buildProductionInventoryCommand(batch, options);
  assert.equal(command.commandId, options.commandId);
  assert.equal(command.businessId, options.remoteBusinessId);
  assert.notEqual(command.businessId, batch.businessId);
  assert.equal(command.commandType, "stock_movement");
  assert.equal(command.payload.movements.length, 3);
  assert.deepEqual(command.payload.movements.map((movement) => movement.kind), [
    "production_consumption", "production_consumption", "production_output",
  ]);
  assert.equal(command.payload.movements[0].quantity, "0.9");
  assert.match(command.payload.movements[0].reason, /Scale showed less than the target/);
  assert.equal(command.payload.movements[1].stockItemId, ingredientB);
  assert.match(command.payload.movements[1].reason, /Accepted kitchen estimate/);
  assert.equal(command.payload.movements[2].eventId, options.outputEventId);
  assert.equal(command.payload.lots.length, 1);
  assert.equal(command.payload.lots[0].lotId, options.lotId);
  assert.equal(command.payload.lots[0].outputEventId, options.outputEventId);
  assert.equal(command.payload.lots[0].producedQuantity, "4");
  assert.deepEqual(command.payload.allocations, []);
  assert.deepEqual(buildProductionInventoryCommand(batch, options), command);
});

test("production inventory command rejects unprepared batches and non-UUID stock identifiers", () => {
  assert.throws(() => buildProductionInventoryCommand({ state: "started" }), /prepared production batch/);
  const batch = {
    batchId: "not-a-uuid",
    businessId: "77777777-7777-4777-8777-777777777777",
    state: "ready_to_post",
    snapshot: { snapshotId: "snap", menuItemId: "11111111-1111-4111-8111-111111111111", lines: [{ lineId: "line", ingredientId: "bad-id", quantityMode: "exact", quantity: "1", unit: "kg", position: 0 }] },
    actualUsage: [{ lineId: "line", disposition: "measured", quantity: "1", unit: "kg" }],
    output: { productId: "11111111-1111-4111-8111-111111111111", quantity: "1", unit: "each" },
  };
  assert.throws(() => buildProductionInventoryCommand(batch, { remoteBusinessId: "77777777-7777-4777-8777-777777777777" }), /Production batch ID must be a UUID/);
});
