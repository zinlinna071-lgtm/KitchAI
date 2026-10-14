import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryCommand, readFinishedStock } from "../src/supabase-api.js";

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
