import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStockCountSession,
  buildStockCountLine,
  recordStockCount,
  reviewStockCountLine,
  projectStockCountSession,
  cancelStockCountSession,
} from "../src/stock-count-domain.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const localBusinessId = "local-profile-1";
const remoteBusinessId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const lineId = "44444444-4444-4444-8444-444444444444";
const stockItemId = "55555555-5555-4555-8555-555555555555";
const capturedAt = "2026-10-14T10:00:00.000Z";

function makeSession() {
  return buildStockCountSession({
    sessionId, ownerId, businessId: localBusinessId, remoteBusinessId,
    createdAt: capturedAt, note: "Morning count",
  });
}
function makeLine(overrides = {}) {
  return buildStockCountLine({
    lineId, sessionId, stockClass: "ingredient", stockItemId, stockItemName: "Rice",
    version: "12", systemQuantity: "4.25", unit: "kg", snapshotAt: capturedAt,
    ...overrides,
  });
}

test("stock count session keeps local partition separate from server business ID", () => {
  const session = makeSession();
  assert.equal(session.businessId, localBusinessId);
  assert.equal(session.remoteBusinessId, remoteBusinessId);
  assert.equal(session.status, "open");
  assert.equal(session.note, "Morning count");
  assert.throws(() => buildStockCountSession({
    sessionId, ownerId, businessId: localBusinessId, remoteBusinessId: "not-a-uuid",
    createdAt: capturedAt,
  }), /Server business ID must be a UUID/);
});

test("count line captures server version and exact system quantity without inventing a count", () => {
  const line = makeLine();
  assert.equal(line.version, "12");
  assert.equal(line.systemQuantity, "4.25");
  assert.equal(line.countedQuantity, null);
  assert.equal(line.variance, null);
  assert.equal(line.state, "open");
});

test("exact count supports zero, calculates signed variance without floating point, and requires a reason for non-zero variance", () => {
  const line = recordStockCount(makeLine(), "3.125");
  assert.equal(line.countedQuantity, "3.125");
  assert.equal(line.variance, "-1.125");
  assert.ok(Number.isFinite(Date.parse(line.countedAt)));
  assert.equal(line.state, "counted");
  assert.throws(() => reviewStockCountLine(line, { reviewedBy: ownerId, reviewedAt: capturedAt }), /requires a reason/);
  const reviewed = reviewStockCountLine(line, {
    reviewedBy: ownerId, reviewedAt: capturedAt, reason: "Spillage found during count",
  });
  assert.equal(reviewed.state, "reviewed");
  assert.equal(reviewed.reason, "Spillage found during count");
  assert.equal(reviewed.version, "12");
});

test("zero variance is reviewed without requiring a reason and zero is not confused with an unentered count", () => {
  const line = recordStockCount(makeLine(), "4.250");
  assert.equal(line.countedQuantity, "4.25");
  assert.equal(line.variance, "0");
  assert.notEqual(line.countedQuantity, null);
  const reviewed = reviewStockCountLine(line, { reviewedBy: ownerId, reviewedAt: capturedAt });
  assert.equal(reviewed.state, "reviewed");
  assert.equal(reviewed.reason, "");
});

test("rejects negative, excessive precision, and fractional each counts", () => {
  assert.throws(() => recordStockCount(makeLine(), "-1"), /plain decimal/);
  assert.throws(() => recordStockCount(makeLine(), "1.0000001"), /plain decimal/);
  assert.throws(() => recordStockCount(makeLine({ unit: "each", systemQuantity: "2" }), "1.5"), /whole numbers/);
  assert.throws(() => makeLine({ version: "-1" }), /version must be a non-negative integer/);
  assert.throws(() => makeLine({ unit: "each", systemQuantity: "1.5" }), /System quantities in each must be whole numbers/);
});

test("session projection reports incomplete and reviewed lines without mutating audit data", () => {
  const session = makeSession();
  const line = recordStockCount(makeLine(), "4.25");
  const reviewed = reviewStockCountLine(line, { reviewedBy: ownerId, reviewedAt: capturedAt });
  const projection = projectStockCountSession(session, [makeLine(), reviewed]);
  assert.equal(projection.lineCount, 2);
  assert.equal(projection.countedLineCount, 1);
  assert.equal(projection.reviewedLineCount, 1);
  assert.equal(session.status, "open");
});

test("cancellation preserves draft details and is rejected after an accepted adjustment", () => {
  const session = makeSession();
  const cancelled = cancelStockCountSession(session, [makeLine()], capturedAt);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt, capturedAt);
  assert.equal(session.status, "open");
  assert.throws(() => cancelStockCountSession(session, [{ ...makeLine(), state: "posted" }], capturedAt), /accepted adjustment/);
});
