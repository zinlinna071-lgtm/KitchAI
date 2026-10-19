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
  assert.equal(translate("common.retry"), "Try again");
  assert.equal(translate("missing.key"), "missing.key");
});

test("supports named interpolation", () => {
  assert.equal(translate("common.items", { count: 3 }, "en"), "3 items");
});

test("formats numbers, dates, and currency using the selected locale", () => {
  assert.ok(formatNumber(1234.5, {}, "en").includes("1"));
  assert.ok(formatDate("2026-01-15T12:00:00Z", { year: "numeric" }, "th").length > 0);
  assert.ok(formatCurrency(100, "THB", {}, "th").length > 0);
});

test("reports locale coverage gaps without crashing", () => {
  assert.deepEqual(getMissingTranslationKeys("en"), []);
  assert.ok(getMissingTranslationKeys("my").includes("common.retry"));
});

test("keeps shared Date Filter translations available in every supported locale", () => {
  const keys = [
    "dateFilter.title", "dateFilter.description", "dateFilter.today",
    "dateFilter.yesterday", "dateFilter.thisWeek", "dateFilter.last7Days",
    "dateFilter.thisMonth", "dateFilter.lastMonth", "dateFilter.singleDate",
    "dateFilter.custom", "dateFilter.start", "dateFilter.end",
    "dateFilter.cancel", "dateFilter.invalid", "dateFilter.choose",
    "dateFilter.chooseDate", "dateFilter.previousMonth", "dateFilter.nextMonth",
    "dashboard.description", "navigation.dashboard",
    "navigation.menu", "navigation.ingredients", "navigation.equipment",
    "navigation.expenses", "navigation.personalExpenses", "navigation.reports",
    "ai.newChat", "ai.recentChats", "ai.searchChats", "ai.settings", "ai.noChats"
  ];
  for (const locale of ["en", "my", "th"]) {
    const missing = new Set(getMissingTranslationKeys(locale));
    for (const key of keys) {
      assert.equal(missing.has(key), false, `${locale} is missing ${key}`);
      assert.notEqual(translate(key, {}, locale), key, `${locale} has no text for ${key}`);
    }
  }
});
