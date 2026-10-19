import test from "node:test";
import assert from "node:assert/strict";
import { readPreferredLocale, savePreferredLocale } from "../src/i18n/ui.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test("reads a supported saved locale and normalizes region suffixes", () => {
  assert.equal(readPreferredLocale(createStorage({ "kitchai.locale": "th_TH" })), "th");
  assert.equal(readPreferredLocale(createStorage({ "kitchai.locale": "my-MM" })), "my");
});

test("falls back safely for missing, unknown, or unavailable preferences", () => {
  assert.equal(readPreferredLocale(createStorage()), "en");
  assert.equal(readPreferredLocale(createStorage({ "kitchai.locale": "xx" })), "en");
  assert.equal(readPreferredLocale({ getItem() { throw new Error("blocked"); } }), "en");
});

test("saves normalized locale preferences and tolerates blocked storage", () => {
  const storage = createStorage();
  assert.equal(savePreferredLocale("my-MM", storage), "my");
  assert.equal(storage.getItem("kitchai.locale"), "my");
  assert.equal(savePreferredLocale("unknown", storage), "en");
  assert.equal(savePreferredLocale("th", { setItem() { throw new Error("blocked"); } }), "th");
});
