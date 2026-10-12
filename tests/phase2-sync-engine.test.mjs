import test from "node:test";
import assert from "node:assert/strict";
import {
  phase2RetryDelayMs, syncPhase2Operations, normalizeRemoteEntity, sendPhase2EntityOperation,
} from "../src/phase2-sync-engine.js";

const operation = (overrides = {}) => ({
  operationId: "op-1", ownerId: "owner-1", businessId: "local-profile-1",
  entityType: "ingredient", recordId: "ingredient-1", operation: "create",
  baseRevision: null, payload: { name: "Rice", status: "active" },
  baseSnapshot: null, localSnapshot: { id: "ingredient-1", name: "Rice" },
  createdAt: "2026-10-12T00:00:00.000Z", attemptCount: 0, state: "pending", nextAttemptAt: 0,
  ...overrides,
});
const session = { access_token: "test-token", user: { id: "owner-1" } };

function fakeStore(operations, options = {}) {
  const calls = [];
  const rows = operations.map(item => ({ ...item }));
  return {
    calls, rows,
    async listOperations(ownerId, businessId) {
      return rows.filter(item => item.ownerId === ownerId && item.businessId === businessId);
    },
    async markInFlight(item) { calls.push(["inFlight", item.operationId]); item.state = "in_flight"; },
    async acknowledge(item, remote) { calls.push(["ack", item.operationId, remote]); item.state = "synced"; },
    async preserveConflict(item, remote) { calls.push(["conflict", item.operationId, item.baseSnapshot, item.localSnapshot, remote]); item.state = "conflict"; },
    async pauseForAuth(item) { calls.push(["auth", item.operationId]); item.state = "needs_auth"; },
    async markPermanentFailure(item, message) { calls.push(["failed", item.operationId, message]); item.state = "permanent_error"; },
    async scheduleRetry(item, attempts, nextAt, message) { calls.push(["retry", item.operationId, attempts, nextAt, message]); item.state = "retryable_error"; },
    async dependenciesSynced(item) { return (item.dependsOnOperationIds ?? []).every(id => rows.find(row => row.operationId === id)?.state === "synced"); },
    async releaseDependency(item) { calls.push(["release", item.operationId]); item.state = "pending"; },
    ...options,
  };
}

test("Phase 2 retry delay is jittered, exponential, and capped", () => {
  assert.equal(phase2RetryDelayMs(1, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 0 }), 500);
  assert.equal(phase2RetryDelayMs(2, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 0.5 }), 2000);
  assert.equal(phase2RetryDelayMs(30, { baseDelayMs: 1000, maxDelayMs: 5000, random: () => 1 }), 5000);
});

test("accepted operation is acknowledged only after the transport returns remote state", async () => {
  const store = fakeStore([operation()]);
  const remoteRecord = { id: "ingredient-1", owner_id: "owner-1", business_id: "remote-business-1", name: "Rice", status: "active", revision: 1 };
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store, now: () => 1000,
    async send(item, activeSession) {
      assert.equal(item.operationId, "op-1");
      assert.equal(activeSession.user.id, "owner-1");
      return { status: "accepted", remoteRecord };
    },
  });
  assert.equal(result.synced, 1);
  assert.equal(store.calls[1][0], "ack");
  assert.equal(store.rows[0].state, "synced");
});

test("transient failures preserve the operation ID and schedule a durable retry", async () => {
  const store = fakeStore([operation()]);
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store, now: () => 2000,
    baseDelayMs: 1000, maxDelayMs: 10000, random: () => 0,
    async send() { throw new Error("network unavailable"); },
  });
  assert.equal(result.retried, 1);
  assert.deepEqual(store.calls.find(call => call[0] === "retry"), ["retry", "op-1", 1, 2500, "network unavailable"]);
  assert.equal(store.rows[0].operationId, "op-1");
});

test("dependencies block child dispatch until the parent is synced", async () => {
  const parent = operation({ operationId: "parent", recordId: "menu-1", entityType: "menuItem", state: "synced" });
  const child = operation({ operationId: "child", entityType: "recipe", recordId: "recipe-1", state: "blocked_dependency", dependsOnOperationIds: ["parent"] });
  const store = fakeStore([parent, child]);
  let sent = 0;
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store,
    async send() { sent++; return { status: "accepted", remoteRecord: { id: "recipe-1", owner_id: "owner-1", business_id: "remote", revision: 1 } }; },
  });
  assert.equal(sent, 1);
  assert.equal(result.synced, 1);
  assert.equal(store.calls.some(call => call[0] === "release" && call[1] === "child"), true);
});

test("dependent update refreshes its base revision after the parent operation is acknowledged", async () => {
  const parent = operation({ operationId: "parent", recordId: "ingredient-1", state: "synced" });
  const child = operation({ operationId: "child", operation: "update", baseRevision: null, state: "blocked_dependency", dependsOnOperationIds: ["parent"] });
  const store = fakeStore([parent, child], {
    async prepareForDispatch(item) {
      return item.operationId === "child" ? { ...item, baseRevision: 3, baseSnapshot: { name: "Remote base" } } : item;
    },
  });
  let sent;
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store,
    async send(item) {
      sent = item;
      return { status: "accepted", remoteRecord: { id: item.recordId, owner_id: "owner-1", business_id: "remote", revision: 4 } };
    },
  });
  assert.equal(result.synced, 1);
  assert.equal(sent.operationId, "child");
  assert.equal(sent.baseRevision, 3);
  assert.deepEqual(sent.baseSnapshot, { name: "Remote base" });
});

test("a child listed before its parent is dispatched after the parent is acknowledged", async () => {
  const child = operation({
    operationId: "child-late-parent", entityType: "recipe", recordId: "recipe-1",
    state: "blocked_dependency", dependsOnOperationIds: ["parent-late"],
    createdAt: "2026-10-12T00:00:00.000Z",
  });
  const parent = operation({
    operationId: "parent-late", entityType: "menuItem", recordId: "menu-1", state: "pending",
    createdAt: "2026-10-12T00:00:01.000Z",
  });
  const store = fakeStore([child, parent]);
  const sent = [];
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store,
    async send(item) {
      sent.push(item.operationId);
      return { status: "accepted", remoteRecord: { id: item.recordId, owner_id: "owner-1", business_id: "remote", revision: 1 } };
    },
  });
  assert.deepEqual(sent, ["parent-late", "child-late-parent"]);
  assert.equal(result.synced, 2);
});

test("a conflict preserves base, local, and remote snapshots and is not retried", async () => {
  const queued = operation({ baseRevision: 1, baseSnapshot: { name: "Old" }, localSnapshot: { name: "Local" } });
  const store = fakeStore([queued]);
  const remote = { id: "ingredient-1", owner_id: "owner-1", business_id: "remote", name: "Remote", status: "active", revision: 4 };
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store,
    async send() { return { status: "conflict", remoteRecord: remote }; },
  });
  assert.equal(result.conflicts, 1);
  const conflict = store.calls.find(call => call[0] === "conflict");
  assert.deepEqual(conflict.slice(2), [{ name: "Old" }, { name: "Local" }, remote]);
  assert.equal(store.calls.some(call => call[0] === "retry"), false);
});

test("auth expiry pauses dispatch for the run and permanent denial is not retried", async () => {
  const store = fakeStore([operation(), operation({ operationId: "op-2", recordId: "ingredient-2" })]);
  let sent = 0;
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store,
    async send() { sent++; return { status: "auth_required" }; },
  });
  assert.equal(result.pausedForAuth, 1);
  assert.equal(sent, 1);
  assert.equal(store.rows[0].state, "needs_auth");

  const deniedStore = fakeStore([operation()]);
  const denied = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1", session, store: deniedStore,
    async send() { return { status: "permanent_error", message: "invalid input" }; },
  });
  assert.equal(denied.failed, 1);
  assert.equal(deniedStore.calls.some(call => call[0] === "retry"), false);
});

test("mismatched session cannot dispatch another owner's queue", async () => {
  const store = fakeStore([operation()]);
  let sent = 0;
  const result = await syncPhase2Operations({
    ownerId: "owner-1", businessId: "local-profile-1",
    session: { access_token: "token", user: { id: "owner-2" } }, store,
    async send() { sent++; return {}; },
  });
  assert.equal(sent, 0);
  assert.equal(result.skipped, 0);
  assert.equal(store.calls.length, 0);
});

test("remote records normalize without replacing the stable local business partition", () => {
  assert.deepEqual(normalizeRemoteEntity("recipeLine", {
    id: "line-1", owner_id: "owner-1", business_id: "remote-1", recipe_id: "recipe-1",
    ingredient_id: "ingredient-1", quantity: "2.5", unit: "g", position: 0, revision: 2,
    created_at: "a", updated_at: "b",
  }), {
    id: "line-1", ownerId: "owner-1", businessId: "remote-1", status: undefined,
    createdAt: "a", updatedAt: "b", revision: 2, recipeId: "recipe-1",
    ingredientId: "ingredient-1", quantity: 2.5, unit: "g", position: 0,
  });
});

test("RPC transport sends the stable operation ID and maps accepted results", async () => {
  let captured;
  const remoteRecord = { id: "ingredient-1", owner_id: "owner-1", business_id: "remote", revision: 1 };
  const result = await sendPhase2EntityOperation(operation(), session, async (path, init) => {
    captured = { path, body: JSON.parse(init.body) };
    return { status: "accepted", record: remoteRecord };
  });
  assert.equal(captured.path, "/rest/v1/rpc/apply_phase2_entity_operation");
  assert.equal(captured.body.p_operation_id, "op-1");
  assert.equal(captured.body.p_entity_type, "ingredient");
  assert.equal(result.status, "accepted");
  assert.equal(result.remoteRecord, remoteRecord);
});

test("RPC transport treats authorization/validation errors as permanent and 401 as auth-required", async () => {
  const permanent = await sendPhase2EntityOperation(operation(), session, async () => {
    const error = new Error("denied"); Object.assign(error, { status: 403, code: "42501" }); throw error;
  });
  assert.equal(permanent.status, "permanent_error");
  const auth = await sendPhase2EntityOperation(operation(), session, async () => {
    const error = new Error("expired"); Object.assign(error, { status: 401 }); throw error;
  });
  assert.equal(auth.status, "auth_required");
});
