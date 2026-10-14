import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipeSnapshot } from "../src/production-batch-store.js";

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
