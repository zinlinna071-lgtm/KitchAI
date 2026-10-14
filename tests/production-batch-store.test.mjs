import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipeSnapshot, validateActualUsage, validateProductionOutput } from "../src/production-batch-store.js";

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
