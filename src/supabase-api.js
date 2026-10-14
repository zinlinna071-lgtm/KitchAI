const SESSION_KEY = "kitchai.auth.session";

/** @returns {{supabaseUrl?:string,supabaseAnonKey?:string}} */
function runtimeConfig() {
  return /** @type {any} */ (globalThis).KITCHAI_CONFIG ?? {};
}

export function isSupabaseConfigured() {
  const config = runtimeConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function apiUrl(path) {
  const config = runtimeConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase is not configured. The local-only profile remains available.");
  }
  return config.supabaseUrl.replace(/\/$/, "") + path;
}

/** @param {string} path @param {{method?:string,body?:unknown,session?:any,prefer?:string}=} options */
async function request(path, options = {}) {
  const config = runtimeConfig();
  const headers = /** @type {Record<string, string>} */ ({
    apikey: config.supabaseAnonKey ?? "",
    Accept: "application/json",
  });
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.session?.access_token) headers.Authorization = "Bearer " + options.session.access_token;
  if (options.prefer) headers.Prefer = options.prefer;
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Network unavailable.");
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    const error = new Error(data?.msg ?? data?.message ?? data?.error_description ?? "Supabase request failed.");
    Object.assign(error, { status: response.status, code: data?.code });
    throw error;
  }
  return data;
}

function readStoredSession() {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  const normalized = {
    ...session,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function signUp(email, password) {
  const result = await request("/auth/v1/signup", { method: "POST", body: { email: email.trim(), password } });
  const session = writeSession(result);
  if (!session) throw new Error("Account created, but no active session was returned. Sign in to continue.");
  return session;
}

export async function signIn(email, password) {
  const result = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: email.trim(), password },
  });
  const session = writeSession(result);
  if (!session) throw new Error("Sign-in did not return an active session.");
  return session;
}

export async function getSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  try {
    const refreshed = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    return writeSession(refreshed);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function signOut() {
  const session = await getSession();
  try {
    if (session) await request("/auth/v1/logout", { method: "POST", session });
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/** @param {any} row */
export function normalizeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id ?? row.ownerId,
    businessId: row.business_id ?? row.businessId,
    name: row.name,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    revision: Number(row.revision),
  };
}

/** @param {any} session */
export async function readRemoteProfile(session) {
  const rows = await request("/rest/v1/business_profiles?select=id,owner_id,business_id,name,created_at,updated_at,revision&limit=1", { session });
  return normalizeProfile(rows?.[0] ?? null);
}

/**
 * @param {any} operation
 * @param {any} session
 * @returns {Promise<{status:"accepted",profile:any}|{status:"conflict",remoteProfile:any}|{status:"auth_required"}|{status:"permanent_error",message:string}>}
 */
export async function sendProfileOperation(operation, session) {
  if (!session?.access_token || !session?.user?.id || operation.ownerId !== session.user.id) {
    return { status: "auth_required" };
  }
  try {
    const result = await request("/rest/v1/rpc/apply_business_profile_operation", {
      method: "POST",
      session,
      body: {
        p_operation_id: operation.operationId,
        p_record_id: operation.recordId,
        p_operation: operation.operation,
        p_base_revision: operation.baseRevision,
        p_name: operation.payload?.name,
      },
    });
    if (result?.status === "accepted") return { status: "accepted", profile: normalizeProfile(result.profile) };
    if (result?.status === "conflict") return { status: "conflict", remoteProfile: normalizeProfile(result.remoteProfile) };
    return { status: "permanent_error", message: "Supabase returned an unsupported operation result." };
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    if (status === 401) return { status: "auth_required" };
    if (status === 403 || code === "42501" || code === "22023" || status === 400 || status === 422) {
      return { status: "permanent_error", message: error instanceof Error ? error.message : "The server rejected this change." };
    }
    throw error;
  }
}


/**
 * Execute one idempotent inventory command through the owner-authorized database RPC.
 * The server derives owner identity from the authenticated JWT; owner IDs are never client-supplied.
 * @param {{commandId:string,businessId:string,commandType:string,payload:{movements?:unknown[],lots?:unknown[],allocations?:unknown[]}}} command
 * @param {any} session
 */
/**
 * Read a server-authoritative inventory balance and item version under the database item lock.
 * This is a snapshot only; it never mutates stock.
 * @param {string} businessId Server-issued business UUID.
 * @param {"ingredient"|"finished"} stockClass
 * @param {string} stockItemId Server-side ingredient or menu-item UUID.
 * @param {any} session Authenticated owner session.
 */
export async function getInventoryItemSnapshot(businessId, stockClass, stockItemId, session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("An authenticated owner session is required to capture a stock-count snapshot.");
  }
  if (typeof businessId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) {
    throw new TypeError("A server-issued business ID is required to capture a stock-count snapshot.");
  }
  if (!["ingredient", "finished"].includes(stockClass)) throw new TypeError("Choose a supported stock class.");
  if (typeof stockItemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stockItemId)) {
    throw new TypeError("A server-issued stock item ID is required to capture a stock-count snapshot.");
  }
  try {
    const result = await request("/rest/v1/rpc/get_inventory_item_snapshot", {
      method: "POST",
      session,
      body: { p_business_id: businessId, p_stock_class: stockClass, p_stock_item_id: stockItemId },
    });
    if (result?.status !== "snapshot" || result.stockClass !== stockClass || result.stockItemId !== stockItemId ||
        typeof result.version !== "string" || !/^\\d+$/.test(result.version) ||
        typeof result.systemQuantity !== "string" || !/^(?:0|[1-9]\\d*)(?:[.]\\d{1,6})?$/.test(result.systemQuantity) ||
        (result.unit !== null && !["g", "kg", "ml", "l", "each"].includes(result.unit))) {
      throw new Error("Supabase returned an unsupported inventory item snapshot.");
    }
    return {
      stockClass: result.stockClass,
      stockItemId: result.stockItemId,
      version: result.version,
      systemQuantity: result.systemQuantity,
      unit: result.unit,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    if (status === 401) throw new Error("Your session expired. Sign in again before capturing a stock count.");
    if (status === 403 || code === "42501") throw new Error("The server rejected access to this business or stock item.");
    throw error;
  }
}

export async function applyInventoryCommand(command, session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("An authenticated owner session is required for inventory posting.");
  }
  if (!command?.commandId || !command?.businessId || !command?.commandType || !command?.payload) {
    throw new TypeError("A complete inventory command is required.");
  }
  try {
    const result = await request("/rest/v1/rpc/apply_inventory_command", {
      method: "POST",
      session,
      body: {
        p_command_id: command.commandId,
        p_business_id: command.businessId,
        p_command_type: command.commandType,
        p_payload: command.payload,
      },
    });
    const movementCount = command.payload?.movements?.length;
    const lotCount = command.payload?.lots?.length ?? 0;
    const allocationCount = command.payload?.allocations?.length ?? 0;
    if (
      result?.status !== "accepted" ||
      result.commandId !== command.commandId ||
      !Number.isInteger(result.movementCount) ||
      !Number.isInteger(result.lotCount) ||
      !Number.isInteger(result.allocationCount) ||
      !Array.isArray(result.eventIds) ||
      result.movementCount !== movementCount ||
      result.lotCount !== lotCount ||
      result.allocationCount !== allocationCount ||
      result.eventIds.length !== result.movementCount
    ) {
      throw new Error("Supabase returned an unsupported inventory command result.");
    }
    return result;
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    if (status === 401) throw new Error("Your session expired. Sign in again before retrying production posting.");
    if (status === 403 || code === "42501") {
      throw new Error("The server rejected production posting because this account cannot access the business.");
    }
    throw error;
  }
}

/**
 * Persist a carry-forward suitability event without changing inventory quantity.
 * The event is immutable and the event ID is its idempotency key.
 * @param {{eventId:string,businessId:string,lotId:string,quantity:string,unit:string,carryForwardDate:string,confirmedAt:string,reason?:string}} decision
 * @param {any} session
 */
export async function recordFinishedLotCarryForward(decision, session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("An authenticated owner session is required to record carry-forward.");
  }
  if (!decision?.eventId || !decision?.businessId || !decision?.lotId ||
      !decision?.quantity || !decision?.unit || !decision?.carryForwardDate || !decision?.confirmedAt) {
    throw new TypeError("A complete carry-forward decision is required.");
  }
  try {
    const result = await request("/rest/v1/rpc/record_finished_lot_carry_forward", {
      method: "POST",
      session,
      body: {
        p_event_id: decision.eventId,
        p_business_id: decision.businessId,
        p_lot_id: decision.lotId,
        p_quantity: decision.quantity,
        p_unit: decision.unit,
        p_carry_forward_date: decision.carryForwardDate,
        p_confirmed_at: decision.confirmedAt,
        p_reason: decision.reason ?? null,
      },
    });
    if (result?.status !== "accepted" ||
        result.eventId !== decision.eventId ||
        result.businessId !== decision.businessId ||
        result.lotId !== decision.lotId ||
        result.handlingType !== "carry_forward" ||
        result.inventoryEffect !== "none" ||
        result.quantity !== decision.quantity ||
        result.unit !== decision.unit ||
        result.carryForwardDate !== decision.carryForwardDate) {
      throw new Error("Supabase returned an unsupported carry-forward result.");
    }
    return result;
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    if (status === 401) throw new Error("Your session expired. Sign in again before recording carry-forward.");
    if (status === 403 || code === "42501") {
      throw new Error("The server rejected carry-forward because this account cannot access the business or lot.");
    }
    throw error;
  }
}


/**
 * Read the authenticated owner's finished lots and immutable lot allocations.
 * Remaining quantities are projected locally from these canonical records.
 * @param {string} businessId Server-issued business UUID, never the local IndexedDB partition ID.
 * @param {any} session
 */
export async function readFinishedStock(businessId, session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("Sign in as the business owner before reading finished stock.");
  }
  if (typeof businessId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) {
    throw new TypeError("A server-issued business ID is required to read finished stock.");
  }
  const filter = "&business_id=eq." + encodeURIComponent(businessId);
  try {
    const [lotRows, allocationRows] = await Promise.all([
      request("/rest/v1/finished_lots?select=lot_id,menu_item_id,produced_quantity,unit,produced_at&order=produced_at.asc" + filter, { session }),
      request("/rest/v1/stock_movement_lot_allocations?select=event_id,lot_id,quantity,unit" + filter, { session }),
    ]);
    if (!Array.isArray(lotRows) || !Array.isArray(allocationRows)) {
      throw new Error("Supabase returned an unsupported finished-stock snapshot.");
    }
    return {
      lots: lotRows.map((row) => ({
        lotId: row.lot_id,
        menuItemId: row.menu_item_id,
        producedQuantity: String(row.produced_quantity),
        unit: row.unit,
        producedAt: row.produced_at,
      })),
      allocations: allocationRows.map((row) => ({
        eventId: row.event_id,
        lotId: row.lot_id,
        quantity: String(row.quantity),
        unit: row.unit,
      })),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const status = /** @type {any} */ (error).status;
    if (status === 401) throw new Error("Your session expired. Sign in again before reading finished stock.");
    if (status === 403 || /** @type {any} */ (error).code === "42501") {
      throw new Error("The server rejected access to this business's finished stock.");
    }
    throw error;
  }
}
