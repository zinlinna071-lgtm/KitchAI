import test from "node:test";
import assert from "node:assert/strict";
import { retryDelayMs, syncPendingOperations, resolveSyncConflict } from "../src/sync-engine.js";

const op = (overrides = {}) => ({
  operationId: "op-a", ownerId: "owner-a", recordId: "record-a", operation: "update",
  baseRevision: 1, payload: { name: "Kitchen A" }, createdAt: "2026-10-12T00:00:00.000Z",
  attemptCount: 0, state: "pending", ...overrides,
});

function fakeStore(operations) {
  const calls = [];
  return {
    calls,
    async listOperations() { return operations; },
    async markInFlight(...args) { calls.push(["inFlight", ...args]); },
    async acknowledge(...args) { calls.push(["ack", ...args]); },
    async preserveConflict(...args) { calls.push(["conflict", ...args]); },
    async pauseForAuth(...args) { calls.push(["auth", ...args]); },
    async markPermanentFailure(...args) { calls.push(["failed", ...args]); },
    async scheduleRetry(...args) { calls.push(["retry", ...args]); },
  };
}

test("retry delay is exponential, jittered, and capped", () => {
  assert.equal(retryDelayMs(1, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 0 }), 500);
  assert.equal(retryDelayMs(2, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 0.5 }), 2000);
  assert.equal(retryDelayMs(30, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 1 }), 5000);
});

test("successful operations are acknowledged with stable operation identity", async () => {
  const store = fakeStore([op()]);
  const summary = await syncPendingOperations({
    ownerId: "owner-a", store, now: () => 1000, random: () => 0.5,
    async send(operation) { assert.equal(operation.operationId, "op-a"); return { status: "accepted", profile: { id: "record-a", revision: 2 } }; },
  });
  assert.deepEqual(summary, { synced: 1, conflicts: 0, pausedForAuth: 0, failed: 0, retried: 0, skipped: 0 });
  assert.equal(store.calls[0][0], "inFlight");
  assert.equal(store.calls[1][0], "ack");
});

test("cross-owner operations and not-yet-due retries are never sent", async () => {
  const store = fakeStore([
    op({ operationId: "op-other", ownerId: "owner-b" }),
    op({ operationId: "op-later", state: "retryable_error", nextAttemptAt: 9000 }),
  ]);
  let sent = 0;
  const summary = await syncPendingOperations({ ownerId: "owner-a", store, now: () => 1000, async send() { sent++; return { status: "accepted", profile: {} }; } });
  assert.equal(sent, 0);
  assert.equal(summary.skipped, 2);
  assert.equal(store.calls.length, 0);
});

test("transient transport failures persist bounded retry timing and error details", async () => {
  const store = fakeStore([op()]);
  const summary = await syncPendingOperations({
    ownerId: "owner-a", store, now: () => 2000, baseDelayMs: 1000, maxDelayMs: 10000, random: () => 0,
    async send() { throw new Error("network unavailable"); },
  });
  assert.equal(summary.retried, 1);
  const retry = store.calls.find(call => call[0] === "retry");
  assert.deepEqual(retry.slice(1), ["op-a", "owner-a", 1, 2500, "network unavailable"]);
});

test("revision mismatch preserves conflict and does not retry stale operation", async () => {
  const store = fakeStore([op()]);
  const summary = await syncPendingOperations({
    ownerId: "owner-a", store,
    async send() { return { status: "conflict", remoteProfile: { id: "record-a", revision: 3, name: "Remote" } }; },
  });
  assert.equal(summary.conflicts, 1);
  assert.equal(store.calls[1][0], "conflict");
  assert.equal(store.calls.some(call => call[0] === "retry"), false);
});

test("authentication expiry pauses sync; permanent rejection does not retry", async () => {
  const authStore = fakeStore([op()]);
  const auth = await syncPendingOperations({ ownerId: "owner-a", store: authStore, async send() { return { status: "auth_required" }; } });
  assert.equal(auth.pausedForAuth, 1);
  assert.equal(authStore.calls[1][0], "auth");

  const rejectedStore = fakeStore([op()]);
  const rejected = await syncPendingOperations({ ownerId: "owner-a", store: rejectedStore, async send() { return { status: "permanent_error", message: "invalid payload" }; } });
  assert.equal(rejected.failed, 1);
  assert.equal(rejectedStore.calls[1][0], "failed");
  assert.equal(rejectedStore.calls.some(call => call[0] === "retry"), false);
});

test("keep-local conflict resolution creates a new operation based on current remote revision", async () => {
  let captured;
  const conflict = {
    conflictId: "conflict-a", operationId: "old-op", ownerId: "owner-a", recordId: "record-a",
    baseRevision: 1, baseSnapshot: { name: "Base" }, localSnapshot: { name: "Local" },
    remoteSnapshot: { name: "Remote", revision: 4 }, remoteRevision: 4,
    detectedAt: "2026-10-12T00:00:00.000Z", state: "unresolved",
  };
  await resolveSyncConflict({
    ownerId: "owner-a", conflict, choice: "keep_local", operationId: "new-op", now: () => 5000,
    store: {
      async keepLocalAndResolve(...args) { captured = args; },
      async applyRemoteAndResolve() { assert.fail("unexpected remote resolution"); },
    },
  });
  assert.equal(captured[0], conflict);
  assert.equal(captured[1], "owner-a");
  assert.equal(captured[2].operationId, "new-op");
  assert.equal(captured[2].baseRevision, 4);
  assert.equal(captured[2].operation, "update");
  assert.equal(captured[2].payload.name, "Local");
  await assert.rejects(() => resolveSyncConflict({
    ownerId: "owner-b", conflict, choice: "keep_local",
    store: { async keepLocalAndResolve() {}, async applyRemoteAndResolve() {} },
  }), /different owner/);
});
