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
