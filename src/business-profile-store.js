(function () {
  "use strict";

  const STORAGE_KEY = "kitchai.business-profile.v1";
  const ALLOWED_TYPES = new Set(["food-stall", "restaurant", "home-kitchen", "other"]);
  const ALLOWED_CURRENCIES = new Set(["THB", "MMK", "USD"]);

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return {
        name: typeof value.name === "string" ? value.name : "",
        type: ALLOWED_TYPES.has(value.type) ? value.type : "food-stall",
        currency: ALLOWED_CURRENCIES.has(value.currency) ? value.currency : "THB",
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : ""
      };
    } catch {
      return null;
    }
  }

  function save(input) {
    if (!input || typeof input !== "object") throw new TypeError("A business profile is required.");
    const name = String(input.name || "").trim();
    const type = String(input.type || "food-stall");
    const currency = String(input.currency || "THB");
    if (!name) throw new Error("Enter a business name.");
    if (name.length > 100) throw new Error("Business name must be 100 characters or fewer.");
    if (!ALLOWED_TYPES.has(type)) throw new Error("Choose a valid business type.");
    if (!ALLOWED_CURRENCIES.has(currency)) throw new Error("Choose a supported currency.");
    const record = { name, type, currency, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.KitchAIBusinessProfileStore = Object.freeze({ read, save, clear });
})();