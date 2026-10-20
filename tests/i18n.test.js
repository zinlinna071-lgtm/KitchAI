import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getLocale,
  getMissingTranslationKeys,
  getSupportedLocales,
  onLocaleChange,
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

test("notifies mounted UI modules when the selected locale changes", () => {
  const previousDocument = globalThis.document;
  const listeners = new Set();
  globalThis.document = {
    documentElement: {},
    addEventListener(type, listener) {
      if (type === "kitchai:localechange") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "kitchai:localechange") listeners.delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of listeners) listener(event);
      return true;
    }
  };
  const seen = [];
  const unsubscribe = onLocaleChange(locale => seen.push(locale));
  try {
    assert.equal(setLocale("my"), "my");
    assert.equal(setLocale("th"), "th");
    assert.deepEqual(seen, ["my", "th"]);
    unsubscribe();
    setLocale("en");
    assert.deepEqual(seen, ["my", "th"]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    setLocale("en");
  }
});

test("does not emit duplicate locale-change events when locale is unchanged", () => {
  const previousDocument = globalThis.document;
  const listeners = new Set();
  globalThis.document = {
    documentElement: {},
    addEventListener(type, listener) {
      if (type === "kitchai:localechange") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "kitchai:localechange") listeners.delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of listeners) listener(event);
      return true;
    }
  };
  let changes = 0;
  const unsubscribe = onLocaleChange(() => changes++);
  try {
    setLocale("en");
    setLocale("my");
    setLocale("my");
    setLocale("my");
    assert.equal(changes, 1);
    assert.equal(globalThis.document.documentElement.lang, "my");
  } finally {
    unsubscribe();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    setLocale("en");
  }
});

test("translation falls back to English and preserves unknown keys", () => {
  setLocale("my");
  assert.equal(translate("common.save"), "သိမ်းရန်");
  assert.equal(translate("common.retry", {}, "my"), "ထပ်မံကြိုးစားရန်");
  assert.equal(translate("common.retry", {}, "th"), "ลองอีกครั้ง");
  assert.equal(translate("missing.key"), "missing.key");
});

test("localizes Myanmar navigation labels", () => {
  assert.equal(translate("navigation.ai", {}, "my"), "AI အသုံးပြုမှု");
  assert.equal(translate("navigation.manage", {}, "my"), "စီမံခန့်ခွဲမှု");
  assert.equal(translate("navigation.dashboard", {}, "my"), "ပင်မစာမျက်နှာ");
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
  assert.deepEqual(getMissingTranslationKeys("my"), []);
  assert.deepEqual(getMissingTranslationKeys("th"), []);
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
    "page.description.dashboard", "page.description.menu",
    "page.description.ingredients",
    "page.description.expenses", "page.description.personal-expenses",
    "page.description.reports", "page.description.settings",
    "navigation.menu", "navigation.ingredients",
    "navigation.expenses", "navigation.personalExpenses", "navigation.reports",
    "ai.newChat", "ai.recentChats", "ai.searchChats", "ai.settings", "ai.noChats",
    "ai.settings.description", "ai.connection.title", "ai.connection.previewOnly",
    "ai.openPrevious", "ai.searchPlaceholder", "ai.messages", "ai.noSavedChats",
    "ai.suggestion.menu", "ai.suggestion.ingredientCosts", "ai.suggestion.production",
    "ai.suggestion.stock", "ai.messageSender.you",
    "connection.online", "connection.offline", "connection.statusOnline", "connection.statusOffline",
    "common.retry", "common.items",
    "app.install",
    "ai.prompt.menu", "ai.prompt.ingredientCosts", "ai.prompt.production", "ai.prompt.stock",
    "dateFilter.previousYears", "dateFilter.nextYears"
  ];
  for (const locale of ["en", "my", "th"]) {
    assert.deepEqual(getMissingTranslationKeys(locale), [], `${locale} must include every English catalog key`);
    const missing = new Set(getMissingTranslationKeys(locale));
    for (const key of keys) {
      assert.equal(missing.has(key), false, `${locale} is missing ${key}`);
      assert.notEqual(translate(key, {}, locale), key, `${locale} has no text for ${key}`);
    }
  }
});
