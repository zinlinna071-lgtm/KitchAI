import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryCommand } from "../src/supabase-api.js";

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
        eventIds: [],
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
