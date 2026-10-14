import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryCommand, readFinishedStock, getInventoryItemSnapshot, postStockCountSubset } from "../src/supabase-api.js";

const session = {
  access_token: "test-access-token",
  user: { id: "11111111-1111-4111-8111-111111111111" },
};
const command = {
  commandId: "22222222-2222-4222-8222-222222222222",
  businessId: "33333333-3333-4333-8333-333333333333",
  commandType: "stock_movement",
  payload: { movements: [{ eventId: "event-1" }], lots: [], allocations: [] },
};

test("applyInventoryCommand sends the exact idempotent command to the authenticated RPC", async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  let observed;
  globalThis.KITCHAI_CONFIG = {
    supabaseUrl: "https://example.supabase.co/",
    supabaseAnonKey: "public-anon-key",
  };
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: "accepted",
        commandId: command.commandId,
        movementCount: 1,
        lotCount: 0,
        allocationCount: 0,
        eventIds: ["event-1"],
      }),
    };
  };
  try {
    const result = await applyInventoryCommand(command, session);
    assert.equal(result.status, "accepted");
    assert.equal(observed.url, "https://example.supabase.co/rest/v1/rpc/apply_inventory_command");
    assert.equal(observed.options.method, "POST");
    assert.equal(observed.options.headers.apikey, "public-anon-key");
    assert.equal(observed.options.headers.Authorization, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(observed.options.body), {
      p_command_id: command.commandId,
      p_business_id: command.businessId,
      p_command_type: command.commandType,
      p_payload: command.payload,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

test("applyInventoryCommand rejects missing authentication and mismatched server result", async () => {
  await assert.rejects(() => applyInventoryCommand(command, null), /authenticated owner session/);
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ status: "accepted", commandId: "different-command" }),
  });
  try {
    await assert.rejects(() => applyInventoryCommand(command, session), /unsupported inventory command result/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

import { recordFinishedLotCarryForward } from "../src/supabase-api.js";

const carryForward = {
  eventId: "55555555-5555-4555-8555-555555555555",
  businessId: "33333333-3333-4333-8333-333333333333",
  lotId: "66666666-6666-4666-8666-666666666666",
  quantity: "4",
  unit: "each",
  carryForwardDate: "2026-10-15",
  confirmedAt: "2026-10-14T17:00:00.000Z",
  reason: "Stored safely",
};

test("recordFinishedLotCarryForward sends an authenticated idempotent handling event, not a stock movement", async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  let observed;
  globalThis.KITCHAI_CONFIG = {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "public-anon-key",
  };
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: "accepted",
        eventId: carryForward.eventId,
        businessId: carryForward.businessId,
        lotId: carryForward.lotId,
        handlingType: "carry_forward",
        quantity: carryForward.quantity,
        unit: carryForward.unit,
        carryForwardDate: carryForward.carryForwardDate,
        inventoryEffect: "none",
      }),
    };
  };
  try {
    const result = await recordFinishedLotCarryForward(carryForward, session);
    assert.equal(result.inventoryEffect, "none");
    assert.equal(observed.url, "https://example.supabase.co/rest/v1/rpc/record_finished_lot_carry_forward");
    assert.equal(observed.options.method, "POST");
    assert.equal(observed.options.headers.Authorization, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(observed.options.body), {
      p_event_id: carryForward.eventId,
      p_business_id: carryForward.businessId,
      p_lot_id: carryForward.lotId,
      p_quantity: carryForward.quantity,
      p_unit: carryForward.unit,
      p_carry_forward_date: carryForward.carryForwardDate,
      p_confirmed_at: carryForward.confirmedAt,
      p_reason: carryForward.reason,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

test("recordFinishedLotCarryForward requires authentication and rejects mismatched results", async () => {
  await assert.rejects(() => recordFinishedLotCarryForward(carryForward, null), /authenticated owner session/);
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ status: "accepted", eventId: "different-event" }),
  });
  try {
    await assert.rejects(() => recordFinishedLotCarryForward(carryForward, session), /unsupported carry-forward result/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});


test("readFinishedStock scopes both queries to the server business and normalizes immutable rows", async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  const urls = [];
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
  globalThis.fetch = async (url, options) => {
    urls.push({ url: String(url), authorization: options.headers.Authorization });
    const body = String(url).includes("/finished_lots?")
      ? [{ lot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", menu_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", produced_quantity: "4.000000", unit: "each", produced_at: "2026-10-14T09:00:00+00:00" }]
      : [{ event_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", lot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantity: "1.000000", unit: "each" }];
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  try {
    const snapshot = await readFinishedStock(command.businessId, session);
    assert.equal(urls.length, 2);
    assert.ok(urls.every(item => item.url.includes("business_id=eq." + command.businessId)));
    assert.ok(urls.every(item => item.authorization === "Bearer test-access-token"));
    assert.equal(snapshot.lots[0].producedQuantity, "4.000000");
    assert.equal(snapshot.lots[0].menuItemId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(snapshot.allocations[0].quantity, "1.000000");
    assert.equal(snapshot.allocations[0].lotId, snapshot.lots[0].lotId);
    assert.ok(Number.isFinite(Date.parse(snapshot.fetchedAt)));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

test("readFinishedStock requires an authenticated owner and server UUID", async () => {
  await assert.rejects(() => readFinishedStock(command.businessId, null), /sign in as the business owner/i);
  await assert.rejects(() => readFinishedStock("local-business-id", session), /server-issued business ID/i);
});

const snapshotBusinessId = "77777777-7777-4777-8777-777777777777";
const snapshotItemId = "88888888-8888-4888-8888-888888888888";
test("getInventoryItemSnapshot requests the owner-scoped locked ledger snapshot and preserves exact values", async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  let observed;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co/", supabaseAnonKey: "anon" };
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({
        status: "snapshot", stockClass: "ingredient", stockItemId: snapshotItemId,
        version: "15", systemQuantity: "3.125", unit: "kg",
      }),
    };
  };
  try {
    const result = await getInventoryItemSnapshot(snapshotBusinessId, "ingredient", snapshotItemId, session);
    assert.equal(observed.url, "https://example.supabase.co/rest/v1/rpc/get_inventory_item_snapshot");
    assert.equal(observed.options.method, "POST");
    assert.equal(observed.options.headers.Authorization, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(observed.options.body), {
      p_business_id: snapshotBusinessId, p_stock_class: "ingredient", p_stock_item_id: snapshotItemId,
    });
    assert.deepEqual({ ...result, capturedAt: undefined }, {
      stockClass: "ingredient", stockItemId: snapshotItemId, version: "15",
      systemQuantity: "3.125", unit: "kg", capturedAt: undefined,
    });
    assert.ok(Number.isFinite(Date.parse(result.capturedAt)));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

test("getInventoryItemSnapshot rejects missing auth, local partition IDs, and malformed server snapshots", async () => {
  await assert.rejects(() => getInventoryItemSnapshot(snapshotBusinessId, "ingredient", snapshotItemId, null), /authenticated owner session/);
  await assert.rejects(() => getInventoryItemSnapshot("local-business", "ingredient", snapshotItemId, session), /server-issued business ID/);
  await assert.rejects(() => getInventoryItemSnapshot(snapshotBusinessId, "ingredient", "local-item", session), /server-issued stock item ID/);
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({
    status: "snapshot", stockClass: "ingredient", stockItemId: snapshotItemId,
    version: "not-a-version", systemQuantity: "1", unit: "kg",
  }) });
  try {
    await assert.rejects(() => getInventoryItemSnapshot(snapshotBusinessId, "ingredient", snapshotItemId, session), /unsupported inventory item snapshot/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});


const countCommand = {
  commandId: "61111111-1111-4111-8111-111111111111",
  businessId: "62222222-2222-4222-8222-222222222222",
  sessionId: "63333333-3333-4333-8333-333333333333",
  completeSession: false,
  lines: [{
    lineId: "64444444-4444-4444-8444-444444444444",
    stockClass: "ingredient",
    stockItemId: "65555555-5555-4555-8555-555555555555",
    expectedVersion: "8",
    countedQuantity: "3.125",
    unit: "kg",
    reason: "Physical count",
    varianceEventId: "66666666-6666-4666-8666-666666666666",
    countedAt: "2026-10-14T10:00:00.000Z",
    reviewedAt: "2026-10-14T10:05:00.000Z",
  }],
};

test("postStockCountSubset sends stable expected-version lines to the authenticated atomic RPC", async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  let observed;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public-anon-key" };
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: "accepted",
        commandId: countCommand.commandId,
        sessionId: countCommand.sessionId,
        postedLineIds: [countCommand.lines[0].lineId],
        eventIds: [countCommand.lines[0].varianceEventId],
        movementCount: 1,
        zeroVarianceCount: 0,
        sessionStatus: "open",
      }),
    };
  };
  try {
    const result = await postStockCountSubset(countCommand, session);
    assert.equal(result.status, "accepted");
    assert.equal(observed.url, "https://example.supabase.co/rest/v1/rpc/post_stock_count_subset");
    assert.equal(observed.options.method, "POST");
    assert.equal(observed.options.headers.Authorization, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(observed.options.body), {
      p_command_id: countCommand.commandId,
      p_business_id: countCommand.businessId,
      p_session_id: countCommand.sessionId,
      p_lines: countCommand.lines,
      p_complete_session: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});

test("postStockCountSubset rejects missing auth, invalid commands, and stale count responses clearly", async () => {
  await assert.rejects(() => postStockCountSubset(countCommand, null), /authenticated owner session/);
  await assert.rejects(() => postStockCountSubset({ ...countCommand, lines: [] }, session), /1 to 200 reviewed lines/);
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.KITCHAI_CONFIG;
  globalThis.KITCHAI_CONFIG = { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" };
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    text: async () => JSON.stringify({
      code: "40001",
      message: "Stock count is stale for item. Refresh the snapshot.",
    }),
  });
  try {
    await assert.rejects(() => postStockCountSubset(countCommand, session), /stale because stock changed/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.KITCHAI_CONFIG;
    else globalThis.KITCHAI_CONFIG = originalConfig;
  }
});
