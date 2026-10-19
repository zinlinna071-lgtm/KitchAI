import {
  formatCurrency,
  formatDate,
  formatNumber,
  getSupportedLocales,
  setLocale,
  translate
} from "./index.js";

const STORAGE_KEY = "kitchai.locale";

function canonicalLocale(locale) {
  const base = String(locale ?? "en").trim().toLowerCase().replace("_", "-").split("-")[0];
  return getSupportedLocales().some((item) => item.code === base) ? base : "en";
}

/** Read a saved interface locale without allowing storage failures to break startup. */
export function readPreferredLocale(storage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return canonicalLocale(saved || "en");
  } catch {
    return "en";
  }
}

/** Save a normalized locale; private browsing/storage restrictions are non-fatal. */
export function savePreferredLocale(locale, storage) {
  const normalized = canonicalLocale(locale);
  try {
    storage?.setItem(STORAGE_KEY, normalized);
  } catch {
    // Locale switching still works for this session when storage is unavailable.
  }
  return normalized;
}

/** Connect the existing language selector to the shared locale registry. */
export function initializeLocaleUI(documentRef = globalThis.document, storage) {
  const locale = readPreferredLocale(storage);
  const select = documentRef?.querySelector("#language-select");
  setLocale(locale);
  if (select) {
    select.value = locale;
    select.addEventListener("change", () => {
      const nextLocale = setLocale(select.value);
      savePreferredLocale(nextLocale, storage);
    });
  }
  if (typeof globalThis.window !== "undefined") {
    globalThis.window.KitchAI18n = Object.freeze({
      getSupportedLocales,
      setLocale,
      translate,
      formatNumber,
      formatDate,
      formatCurrency
    });
  }
  return locale;
}

if (typeof document !== "undefined") {
  let storage;
  try {
    storage = globalThis.localStorage;
  } catch {
    storage = undefined;
  }
  initializeLocaleUI(document, storage);
}
