import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getLocale,
  getMissingTranslationKeys,
  getSupportedLocales,
  setLocale,
  translate
} from "../src/i18n/index.js";

test("registers the initial English, Myanmar, and Thai locales", () => {
  assert.deepEqual(getSupportedLocales().map(locale => locale.code), ["en", "my", "th"]);
});

test("sets supported locales and safely falls back for unknown locales", () => {
  assert.equal(setLocale("my-MM"), "my");
  assert.equal(getLocale(), "my");
  assert.equal(setLocale("th_TH"), "th");
  assert.equal(setLocale("xx"), "en");
});

test("translation falls back to English and preserves unknown keys", () => {
  setLocale("my");
  assert.equal(translate("common.save"), "သိမ်းရန်");
  assert.equal(translate("common.loading"), "ဖွင့်နေသည်…");
  assert.equal(translate("missing.key"), "missing.key");
});

test("supports safe named interpolation", () => {
  assert.equal(translate("app.name", {}, "en"), "KitchAI");
  assert.equal(translate("common.save {count}", { count: 3 }, "en"), "common.save 3");
});

test("formats numbers, dates, and currency using the selected locale", () => {
  assert.ok(formatNumber(1234.5, {}, "en").includes("1"));
  assert.ok(formatDate("2026-01-15T12:00:00Z", { year: "numeric" }, "th").length > 0);
  assert.ok(formatCurrency(100, "THB", {}, "th").length > 0);
});

test("reports locale coverage gaps without crashing", () => {
  assert.deepEqual(getMissingTranslationKeys("en"), []);
  assert.ok(getMissingTranslationKeys("my").length > 0);
});
