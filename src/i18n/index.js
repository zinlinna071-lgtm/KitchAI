import en from "./locales/en.js";
import my from "./locales/my.js";
import th from "./locales/th.js";

const catalogs = Object.freeze({ en, my, th });
const supportedLocales = Object.freeze(Object.keys(catalogs));
const defaultLocale = "en";
let activeLocale = defaultLocale;

function normalizeLocale(locale) {
  if (typeof locale !== "string") return defaultLocale;
  const normalized = locale.trim().toLowerCase().replace("_", "-");
  if (catalogs[normalized]) return normalized;
  const base = normalized.split("-")[0];
  return catalogs[base] ? base : defaultLocale;
}

export function getSupportedLocales() {
  return supportedLocales.map(code => ({
    code,
    name: catalogs[code].languageName
  }));
}

export function getLocale() {
  return activeLocale;
}

/**
 * Set the active interface locale and notify mounted UI modules to re-render.
 * New UI should subscribe with onLocaleChange() rather than watching the selector.
 */
export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale);
  const changed = nextLocale !== activeLocale;
  activeLocale = nextLocale;
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = activeLocale;
    document.documentElement.dir = catalogs[activeLocale].direction || "ltr";
    // Repeated synchronization calls must not trigger recursive UI re-renders.
    if (changed && typeof document.dispatchEvent === "function" && typeof Event === "function") {
      document.dispatchEvent(new Event("kitchai:localechange"));
    }
  }
  return activeLocale;
}

/**
 * Subscribe a UI renderer to language changes. Call the returned function when
 * the UI is removed to avoid retaining stale listeners.
 * @param {(locale: string) => void} callback
 * @param {Document | EventTarget} [target]
 */
export function onLocaleChange(callback, target = globalThis.document) {
  if (!target || typeof target.addEventListener !== "function") return () => {};
  const listener = () => callback(activeLocale);
  target.addEventListener("kitchai:localechange", listener);
  return () => target.removeEventListener("kitchai:localechange", listener);
}

export function translate(key, params = {}, locale = activeLocale) {
  const selected = catalogs[normalizeLocale(locale)].messages;
  const fallback = catalogs[defaultLocale].messages;
  const template = selected[key] ?? fallback[key] ?? key;
  return String(template).replace(/\{([\w.-]+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

export function formatNumber(value, options = {}, locale = activeLocale) {
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(value);
}

/** @param {string | number | Date} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [locale]
 */
export function formatDate(value, options = /** @type {Intl.DateTimeFormatOptions} */ ({ year: "numeric", month: "short", day: "numeric" }), locale = activeLocale) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
}

export function formatCurrency(value, currency = "THB", options = {}, locale = activeLocale) {
  return new Intl.NumberFormat(normalizeLocale(locale), {
    style: "currency",
    currency,
    ...options
  }).format(value);
}

export function getMissingTranslationKeys(locale) {
  const selected = catalogs[normalizeLocale(locale)].messages;
  return Object.keys(catalogs[defaultLocale].messages).filter(key => !(key in selected));
}
