import test from "node:test";
import assert from "node:assert/strict";
import { buildSaleDraft, projectSale } from "../src/sales-domain.js";

const saleId = "11111111-1111-4111-8111-111111111111";
const quailLineId = "22222222-2222-4222-8222-222222222222";
const teaLineId = "33333333-3333-4333-8333-333333333333";
const quailMenuId = "44444444-4444-4444-8444-444444444444";
const teaMenuId = "55555555-5555-4555-8555-555555555555";

function draft(overrides = {}) {
  return buildSaleDraft({
    saleId,
    currency: "THB",
    createdAt: "2026-10-18T10:00:00Z",
    lines: [
      { lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry (3 pieces)", quantity: 1, unitPrice: "100", discounted: true },
      { lineId: teaLineId, menuItemId: teaMenuId, menuItemName: "Iced Tea", quantity: 2, unitPrice: "25.00" },
    ],
    ...overrides,
  });
}

test("sale draft snapshots actual prices and calculates totals without floating-point math", () => {
  const sale = draft();
  assert.equal(sale.status, "draft");
  assert.equal(sale.totalAmount, "150.00");
  assert.equal(sale.saleType, "discounted");
  assert.equal(sale.lines[0].menuItemName, "Quail Fry (3 pieces)");
  assert.equal(sale.lines[0].unitPrice, "100.00");
  assert.equal(sale.lines[0].lineTotal, "100.00");
  assert.equal(sale.lines[1].lineTotal, "50.00");
  assert.equal(sale.inventoryEffect, "none");
});

test("sale draft is regular when no line is marked discounted", () => {
  const sale = buildSaleDraft({
    saleId,
    lines: [{ lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "100" }],
  });
  assert.equal(sale.saleType, "regular");
  assert.equal(sale.totalAmount, "100.00");
});

test("discounted price must be explicitly entered; no catalog discount is inferred", () => {
  const sale = buildSaleDraft({
    saleId,
    lines: [{ lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "85.50", discounted: true }],
  });
  assert.equal(sale.lines[0].unitPrice, "85.50");
  assert.equal(sale.totalAmount, "85.50");
});

test("sale rejects invalid identifiers, empty lines, and duplicate line IDs", () => {
  assert.throws(() => buildSaleDraft({ saleId: "bad", lines: [{ menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "100" }] }), /Sale ID must be a UUID/);
  assert.throws(() => buildSaleDraft({ saleId, lines: [] }), /between 1 and 100 lines/);
  assert.throws(() => buildSaleDraft({
    saleId,
    lines: [
      { lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "100" },
      { lineId: quailLineId, menuItemId: teaMenuId, menuItemName: "Iced Tea", quantity: 1, unitPrice: "25" },
    ],
  }), /Sale line IDs must be unique/);
});

test("sale rejects non-whole quantities, invalid prices, and free items as revenue", () => {
  const base = { lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "100" };
  assert.throws(() => buildSaleDraft({ saleId, lines: [{ ...base, quantity: 1.5 }] }), /positive whole number/);
  assert.throws(() => buildSaleDraft({ saleId, lines: [{ ...base, unitPrice: "1e2" }] }), /plain non-negative decimal/);
  assert.throws(() => buildSaleDraft({ saleId, lines: [{ ...base, unitPrice: "-1" }] }), /plain non-negative decimal/);
  assert.throws(() => buildSaleDraft({ saleId, lines: [{ ...base, unitPrice: "0" }] }), /greater than zero/);
});

test("sale rejects invalid timestamps, currency, and discount flags", () => {
  const line = { lineId: quailLineId, menuItemId: quailMenuId, menuItemName: "Quail Fry", quantity: 1, unitPrice: "100" };
  assert.throws(() => buildSaleDraft({ saleId, createdAt: "not-a-date", lines: [line] }), /Sale date must be valid/);
  assert.throws(() => buildSaleDraft({ saleId, currency: "Baht", lines: [line] }), /three-letter code/);
  assert.throws(() => buildSaleDraft({ saleId, lines: [{ ...line, discounted: "yes" }] }), /Discounted must be true or false/);
});

test("sale projection recomputes totals from saved price snapshots", () => {
  const sale = draft();
  const projected = projectSale({ ...sale, totalAmount: "0.00" });
  assert.equal(projected.totalAmount, "150.00");
  assert.equal(projected.saleType, "discounted");
});
