import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sourceUrl = new URL("./business-profile-store.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");

function createStore(initial = null) {
  const values = new Map();
  if (initial !== null) values.set("kitchai.business-profile.v1", initial);
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const window = {};
  vm.runInNewContext(source, { window, localStorage, Date, Set, JSON, String, TypeError, Error });
  return { store: window.KitchAIBusinessProfileStore, values };
}

test("business profile saves normalized values and can be read back", () => {
  const { store } = createStore();
  const saved = store.save({ name: "  Night Market  ", type: "food-stall", currency: "THB" });
  assert.equal(saved.name, "Night Market");
  assert.equal(saved.type, "food-stall");
  assert.equal(saved.currency, "THB");
  assert.ok(saved.updatedAt);
  assert.deepEqual({ ...store.read(), name: "Night Market", type: "food-stall", currency: "THB" },
    { ...saved, name: "Night Market", type: "food-stall", currency: "THB" });
});

test("business profile rejects missing names, overly long names, and unsupported options", () => {
  const { store } = createStore();
  assert.throws(() => store.save({ name: "   ", type: "food-stall", currency: "THB" }), /business name/i);
  assert.throws(() => store.save({ name: "x".repeat(101), type: "food-stall", currency: "THB" }), /100 characters/i);
  assert.throws(() => store.save({ name: "Shop", type: "unknown", currency: "THB" }), /business type/i);
  assert.throws(() => store.save({ name: "Shop", type: "food-stall", currency: "EUR" }), /currency/i);
});

test("business profile returns safe defaults for malformed stored data", () => {
  const { store } = createStore("{not-json");
  assert.equal(store.read(), null);
});

test("business profile clear removes the saved record", () => {
  const { store } = createStore();
  store.save({ name: "Night Market", type: "food-stall", currency: "THB" });
  store.clear();
  assert.equal(store.read(), null);
});
