import test from "node:test";
import assert from "node:assert/strict";
import { recipeQuantityToInventoryQuantity } from "../src/recipe-quantity-adapter.js";

test("adapts supported Phase 2 recipe quantities without changing their decimal value", () => {
  assert.equal(recipeQuantityToInventoryQuantity(0.1, { unit: "kg" }).quantity, "0.1");
  assert.equal(recipeQuantityToInventoryQuantity(1.25, { unit: "g" }).quantity, "1.25");
  assert.equal(recipeQuantityToInventoryQuantity(2, { unit: "each", stockClass: "finished" }).quantity, "2");
});

test("rejects invalid values, scientific notation, and floating-point artifacts instead of rounding", () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity, "0.5", 1e-7, 0.1 + 0.2, 1.0000001]) {
    assert.throws(() => recipeQuantityToInventoryQuantity(value, { unit: "g" }));
  }
});

test("enforces inventory range, unit, and finished each rules", () => {
  assert.throws(() => recipeQuantityToInventoryQuantity(1, { unit: "cup" }));
  assert.throws(() => recipeQuantityToInventoryQuantity(1.5, { unit: "each", stockClass: "finished" }));
  assert.throws(() => recipeQuantityToInventoryQuantity(1e18, { unit: "g" }));
});
