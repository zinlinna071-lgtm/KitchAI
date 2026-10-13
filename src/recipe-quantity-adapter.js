import { normalizeQuantity } from "./inventory-domain.js";

/**
 * Adapt a legacy Phase 2 JavaScript-number recipe quantity to the inventory
 * decimal-string contract without rounding or implicit unit conversion.
 *
 * JavaScript numbers cannot reveal the original user-entered decimal. This
 * adapter accepts only finite positive numbers whose canonical string is a
 * plain base-10 decimal with at most six fractional digits. Scientific
 * notation, floating-point artifacts, excess precision, and inventory range
 * violations are rejected rather than silently rounded.
 *
 * @param {number} value
 * @param {{unit:string,stockClass?:"ingredient"|"finished"}} options
 * @returns {{quantity:string,unit:string,scaled:bigint}}
 */
export function recipeQuantityToInventoryQuantity(value, { unit, stockClass = "ingredient" } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError("Recipe quantity must be a finite positive number.");
  }
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Recipe quantity exceeds JavaScript safe-integer precision; re-enter it as an exact decimal string.");
  }
  const decimal = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(decimal)) {
    throw new RangeError("Recipe quantity cannot be represented safely at six decimal places; edit it to a supported precision.");
  }
  return normalizeQuantity(decimal, { unit, stockClass, positive: true });
}
