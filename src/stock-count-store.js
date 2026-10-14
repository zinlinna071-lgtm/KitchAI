import { openBusinessDatabase } from "./business-data-store.js";
import { getInventoryItemSnapshot, postStockCountSubset } from "./supabase-api.js";
import {
  buildStockCountSession,
  buildStockCountLine,
  recordStockCount,
  reviewStockCountLine as reviewLine,
  projectStockCountSession,
  cancelStockCountSession as cancelSession,
} from "./stock-count-domain.js";

const SESSION_STORE = "stockCountSessions";
const LINE_STORE = "stockCountLines";

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}
function scopeKey(scope) {
  return {
    ownerId: requireText(scope?.ownerId, "Owner scope"),
    businessId: requireText(scope?.businessId, "Local business partition"),
  };
}
function requestResult(request, fallback) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(fallback));
  });
}
function transactionResult(tx, getResult) {
  return new Promise((resolve, reject) => {
    let result;
    if (getResult) getResult(value => { result = value; });
    tx.oncomplete = () => resolve(structuredClone(result));
    tx.onerror = () => reject(tx.error ?? new Error("Stock-count storage transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Stock-count storage transaction was aborted."));
  });
}
function sessionKey(scope, sessionId) {
  return [scope.ownerId, scope.businessId, requireText(sessionId, "Count session ID")];
}
function lineKey(scope, sessionId, lineId) {
  return [scope.ownerId, scope.businessId, requireText(sessionId, "Count session ID"), requireText(lineId, "Count line ID")];
}
async function readSession(scope, sessionId) {
  const db = await openBusinessDatabase();
  const tx = db.transaction(SESSION_STORE, "readonly");
  return requestResult(tx.objectStore(SESSION_STORE).get(sessionKey(scope, sessionId)), "Could not read stock-count session.");
}
async function readLines(scope, sessionId) {
  const db = await openBusinessDatabase();
  const tx = db.transaction(LINE_STORE, "readonly");
  return requestResult(tx.objectStore(LINE_STORE).index("bySession").getAll([
    scope.ownerId, scope.businessId, requireText(sessionId, "Count session ID"),
  ]), "Could not read stock-count lines.");
}

/** Create a local-first draft. This does not capture stock or change the ledger. */
export async function createStockCountSession(scope, remoteBusinessId, options = {}) {
  const partition = scopeKey(scope);
  const session = buildStockCountSession({
    sessionId: options.sessionId ?? crypto.randomUUID(),
    ownerId: partition.ownerId,
    businessId: partition.businessId,
    remoteBusinessId,
    createdAt: options.createdAt,
    note: options.note,
  });
  const db = await openBusinessDatabase();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  tx.objectStore(SESSION_STORE).add(session);
  return transactionResult(tx, resolve => { tx.objectStore(SESSION_STORE).get(sessionKey(partition, session.sessionId)).onsuccess = event => resolve(event.target.result); });
}

/**
 * Capture one line from the trusted server snapshot RPC before saving it locally.
 * This requires connectivity and an authenticated owner. Counts can be entered offline afterward.
 */
export async function addStockCountLine(scope, sessionId, item, authSession, options = {}) {
  const partition = scopeKey(scope);
  const session = await readSession(partition, sessionId);
  if (!session) throw new Error("Stock-count session was not found in this business workspace.");
  if (session.status === "cancelled" || session.status === "posted") throw new Error("This stock-count session is closed.");
  if (authSession?.user?.id !== partition.ownerId || !authSession?.access_token) {
    throw new Error("Sign in as this business owner before capturing the server stock snapshot.");
  }
  if (typeof item?.stockClass !== "string" || !["ingredient", "finished"].includes(item.stockClass)) {
    throw new TypeError("Choose an ingredient or finished-product stock item.");
  }
  const stockItemId = requireText(item?.stockItemId, "Stock item ID");
  const snapshot = await getInventoryItemSnapshot(session.remoteBusinessId, item.stockClass, stockItemId, authSession);
  const unit = snapshot.unit ?? item.unit;
  if (typeof unit !== "string" || !unit.trim()) {
    throw new Error("This item has no recorded stock unit. Choose its real unit explicitly before counting; no conversion is assumed.");
  }
  if (snapshot.unit && item.unit && snapshot.unit !== item.unit) {
    throw new Error("The selected unit differs from the server ledger unit. Automatic unit conversion is not enabled.");
  }
  const line = buildStockCountLine({
    lineId: options.lineId ?? crypto.randomUUID(),
    sessionId: session.sessionId,
    stockClass: item.stockClass,
    stockItemId,
    stockItemName: item.stockItemName,
    version: snapshot.version,
    systemQuantity: snapshot.systemQuantity,
    unit,
    snapshotAt: snapshot.capturedAt,
    note: options.note ?? "",
  });
  const db = await openBusinessDatabase();
  const tx = db.transaction([SESSION_STORE, LINE_STORE], "readwrite");
  const sessions = tx.objectStore(SESSION_STORE);
  const lines = tx.objectStore(LINE_STORE);
  const existingSessionRequest = sessions.get(sessionKey(partition, sessionId));
  let failure;
  existingSessionRequest.onsuccess = () => {
    const latestSession = existingSessionRequest.result;
    if (!latestSession || latestSession.status === "cancelled" || latestSession.status === "posted") {
      failure = new Error("Stock-count session was closed while the snapshot was being captured.");
      try { tx.abort(); } catch {}
      return;
    }
    const existingLinesRequest = lines.index("bySession").getAll([
      partition.ownerId, partition.businessId, session.sessionId,
    ]);
    existingLinesRequest.onsuccess = () => {
      if (existingLinesRequest.result.some(existing => existing.stockClass === line.stockClass && existing.stockItemId === line.stockItemId)) {
        failure = new Error("This stock item already has a line in this count session.");
        try { tx.abort(); } catch {}
        return;
      }
      lines.add({ ...line, ownerId: partition.ownerId, businessId: partition.businessId });
      sessions.put({ ...latestSession, status: "open", updatedAt: new Date().toISOString() });
    };
    existingLinesRequest.onerror = () => { failure = existingLinesRequest.error; try { tx.abort(); } catch {} };
  };
  existingSessionRequest.onerror = () => { failure = existingSessionRequest.error; try { tx.abort(); } catch {} };
  try {
    return await transactionResult(tx, resolve => resolve(line));
  } catch (error) {
    throw failure ?? error;
  }
}

/** Read all count sessions in this owner/business local partition. */
export async function listStockCountSessions(scope) {
  const partition = scopeKey(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction(SESSION_STORE, "readonly");
  const sessions = await requestResult(tx.objectStore(SESSION_STORE).index("byScope").getAll([
    partition.ownerId, partition.businessId,
  ]), "Could not list stock-count sessions.");
  const projected = await Promise.all(sessions.map(async session => projectStockCountSession(session, await readLines(partition, session.sessionId))));
  return projected.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Read the lines belonging to one session, without exposing another partition. */
export async function listStockCountLines(scope, sessionId) {
  const partition = scopeKey(scope);
  const session = await readSession(partition, sessionId);
  if (!session) throw new Error("Stock-count session was not found in this business workspace.");
  return (await readLines(partition, sessionId)).sort((a, b) => a.stockItemName.localeCompare(b.stockItemName) || a.lineId.localeCompare(b.lineId));
}

/** Record an exact count offline; this saves a draft only and does not change stock. */
export async function enterStockCount(scope, sessionId, lineId, countedQuantity, note) {
  const partition = scopeKey(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction([SESSION_STORE, LINE_STORE], "readwrite");
  const sessions = tx.objectStore(SESSION_STORE);
  const lines = tx.objectStore(LINE_STORE);
  const key = lineKey(partition, sessionId, lineId);
  const sessionRequest = sessions.get(sessionKey(partition, sessionId));
  const lineRequest = lines.get(key);
  let updatedLine;
  let failure;
  let session;
  let line;
  const maybeUpdate = () => {
    if (session === undefined || line === undefined) return;
    try {
      if (!session || !line) throw new Error("Stock-count session or line was not found in this business workspace.");
      if (["cancelled", "posted"].includes(session.status)) throw new Error("This stock-count session is closed.");
      updatedLine = recordStockCount(line, countedQuantity, note);
      lines.put({ ...updatedLine, ownerId: partition.ownerId, businessId: partition.businessId });
      sessions.put({ ...session, updatedAt: new Date().toISOString() });
    } catch (error) { failure = error; try { tx.abort(); } catch {} }
  };
  sessionRequest.onsuccess = () => { session = sessionRequest.result ?? null; maybeUpdate(); };
  lineRequest.onsuccess = () => { line = lineRequest.result ?? null; maybeUpdate(); };
  sessionRequest.onerror = () => { failure = sessionRequest.error; try { tx.abort(); } catch {} };
  lineRequest.onerror = () => { failure = lineRequest.error; try { tx.abort(); } catch {} };
  try {
    return await transactionResult(tx, resolve => { tx.addEventListener("complete", () => resolve(updatedLine), { once: true }); });
  } catch (error) { throw failure ?? error; }
}

/** Review a counted line offline; non-zero variance requires a reason. */
export async function reviewStockCountLine(scope, sessionId, lineId, input) {
  const partition = scopeKey(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction([SESSION_STORE, LINE_STORE], "readwrite");
  const sessions = tx.objectStore(SESSION_STORE);
  const lines = tx.objectStore(LINE_STORE);
  const sessionRequest = sessions.get(sessionKey(partition, sessionId));
  const lineRequest = lines.get(lineKey(partition, sessionId, lineId));
  let session;
  let line;
  let updatedLine;
  let failure;
  const maybeUpdate = () => {
    if (session === undefined || line === undefined) return;
    try {
      if (!session || !line) throw new Error("Stock-count session or line was not found in this business workspace.");
      if (["cancelled", "posted"].includes(session.status)) throw new Error("This stock-count session is closed.");
      updatedLine = reviewLine(line, input);
      const allLinesRequest = lines.index("bySession").getAll([partition.ownerId, partition.businessId, sessionId]);
      allLinesRequest.onsuccess = () => {
        lines.put({ ...updatedLine, ownerId: partition.ownerId, businessId: partition.businessId });
        const reviewed = allLinesRequest.result.filter(existing => existing.lineId !== lineId).every(existing => existing.state === "reviewed" || existing.state === "posted");
        sessions.put({ ...session, status: reviewed ? "ready_for_review" : "open", updatedAt: new Date().toISOString() });
      };
      allLinesRequest.onerror = () => { failure = allLinesRequest.error; try { tx.abort(); } catch {} };
    } catch (error) { failure = error; try { tx.abort(); } catch {} }
  };
  sessionRequest.onsuccess = () => { session = sessionRequest.result ?? null; maybeUpdate(); };
  lineRequest.onsuccess = () => { line = lineRequest.result ?? null; maybeUpdate(); };
  sessionRequest.onerror = () => { failure = sessionRequest.error; try { tx.abort(); } catch {} };
  lineRequest.onerror = () => { failure = lineRequest.error; try { tx.abort(); } catch {} };
  try {
    return await transactionResult(tx, resolve => { tx.addEventListener("complete", () => resolve(updatedLine), { once: true }); });
  } catch (error) { throw failure ?? error; }
}

/** Preserve the cancelled draft and its lines; cancellation never mutates stock. */
export async function cancelStockCountSession(scope, sessionId, cancelledAt = new Date().toISOString()) {
  const partition = scopeKey(scope);
  const session = await readSession(partition, sessionId);
  if (!session) throw new Error("Stock-count session was not found in this business workspace.");
  const lines = await readLines(partition, sessionId);
  const cancelled = cancelSession(session, lines, cancelledAt);
  const db = await openBusinessDatabase();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  tx.objectStore(SESSION_STORE).put(cancelled);
  return transactionResult(tx, resolve => { tx.objectStore(SESSION_STORE).get(sessionKey(partition, sessionId)).onsuccess = event => resolve(event.target.result); });
}


/**
 * Persist a stable command before delivery, then retry the exact same ID and payload
 * until the server acknowledges it. Each submitted reviewed subset is atomic.
 * @param {{ownerId:string,businessId:string}} scope Local owner/business partition.
 * @param {string} sessionId Local stock-count session ID.
 * @param {string[]} lineIds Reviewed line IDs to submit in this atomic subset.
 * @param {any} authSession Authenticated owner session.
 * @param {{completeSession?:boolean}} options
 */
export async function postReviewedStockCountSubset(scope, sessionId, lineIds, authSession, options = {}) {
  const partition = scopeKey(scope);
  if (authSession?.user?.id !== partition.ownerId || !authSession?.access_token) {
    throw new Error("Sign in as this business owner before posting stock counts.");
  }
  if (!Array.isArray(lineIds) || lineIds.length < 1 || lineIds.length > 200 ||
      lineIds.some(id => typeof id !== "string" || !id.trim()) ||
      new Set(lineIds).size !== lineIds.length) {
    throw new TypeError("Choose 1 to 200 distinct reviewed count lines to post.");
  }
  if (options.completeSession !== undefined && typeof options.completeSession !== "boolean") {
    throw new TypeError("The session-completion choice must be true or false.");
  }

  const db = await openBusinessDatabase();
  const tx = db.transaction([SESSION_STORE, LINE_STORE], "readwrite");
  const sessions = tx.objectStore(SESSION_STORE);
  const lines = tx.objectStore(LINE_STORE);
  const sessionRequest = sessions.get(sessionKey(partition, sessionId));
  const linesRequest = lines.index("bySession").getAll([
    partition.ownerId, partition.businessId, requireText(sessionId, "Count session ID"),
  ]);
  let pending;
  let failure;
  let session;
  let allLines;
  const prepare = () => {
    if (session === undefined || allLines === undefined || failure) return;
    try {
      if (!session) throw new Error("Stock-count session was not found in this business workspace.");
      if (session.pendingPost) {
        pending = session.pendingPost;
      } else {
        if (["cancelled", "posted"].includes(session.status)) throw new Error("This stock-count session is closed.");
        const selected = lineIds.map(id => allLines.find(line => line.lineId === id));
        if (selected.some(line => !line || line.state !== "reviewed" || line.countedQuantity === null || line.variance === null)) {
          throw new Error("Only reviewed, counted lines can be posted. Review the selected lines first.");
        }
        const command = {
          commandId: crypto.randomUUID(),
          businessId: session.remoteBusinessId,
          sessionId: session.sessionId,
          completeSession: options.completeSession === true,
          lines: selected.map(line => ({
            lineId: line.lineId,
            stockClass: line.stockClass,
            stockItemId: line.stockItemId,
            expectedVersion: line.version,
            countedQuantity: line.countedQuantity,
            unit: line.unit,
            reason: line.reason,
            ...(line.variance === "0" ? {} : { varianceEventId: crypto.randomUUID() }),
            countedAt: line.countedAt,
            reviewedAt: line.reviewedAt,
          })),
        };
        pending = {
          command,
          lineIds: selected.map(line => line.lineId),
          completeSession: command.completeSession,
          createdAt: new Date().toISOString(),
        };
        sessions.put({ ...session, pendingPost: pending, updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      failure = error;
      try { tx.abort(); } catch {}
    }
  };
  sessionRequest.onsuccess = () => { session = sessionRequest.result ?? null; prepare(); };
  linesRequest.onsuccess = () => { allLines = linesRequest.result; prepare(); };
  sessionRequest.onerror = () => { failure = sessionRequest.error; try { tx.abort(); } catch {} };
  linesRequest.onerror = () => { failure = linesRequest.error; try { tx.abort(); } catch {} };
  try {
    await transactionResult(tx, resolve => { tx.addEventListener("complete", () => resolve(pending), { once: true }); });
  } catch (error) {
    throw failure ?? error;
  }
  if (!pending?.command) throw new Error("Could not persist the stock-count command before delivery.");

  const result = await postStockCountSubset(pending.command, authSession);
  const acceptedIds = [...result.postedLineIds].sort();
  if (JSON.stringify(acceptedIds) !== JSON.stringify([...pending.lineIds].sort())) {
    throw new Error("The server accepted an unexpected set of stock-count lines. The saved command remains available for safe retry/review.");
  }

  const finalizeDb = await openBusinessDatabase();
  const finalizeTx = finalizeDb.transaction([SESSION_STORE, LINE_STORE], "readwrite");
  const finalizeSessions = finalizeTx.objectStore(SESSION_STORE);
  const finalizeLines = finalizeTx.objectStore(LINE_STORE);
  const currentSessionRequest = finalizeSessions.get(sessionKey(partition, sessionId));
  const currentLinesRequest = finalizeLines.index("bySession").getAll([
    partition.ownerId, partition.businessId, requireText(sessionId, "Count session ID"),
  ]);
  let finalizedSession;
  let finalizeFailure;
  let currentSession;
  let currentLines;
  const finalize = () => {
    if (currentSession === undefined || currentLines === undefined || finalizeFailure) return;
    try {
      if (!currentSession?.pendingPost ||
          currentSession.pendingPost.command.commandId !== pending.command.commandId) {
        throw new Error("The pending stock-count command changed before local finalization; retry/review is required.");
      }
      for (const lineId of pending.lineIds) {
        const line = currentLines.find(candidate => candidate.lineId === lineId);
        if (!line || !["reviewed", "posted"].includes(line.state)) {
          throw new Error("A posted count line is missing from local storage; the server result is retained for safe retry/recovery.");
        }
        if (line.state !== "posted") {
          finalizeLines.put({ ...line, state: "posted", postedAt: new Date().toISOString() });
        }
      }
      finalizedSession = {
        ...currentSession,
        status: pending.completeSession ? "posted" : currentSession.status,
        ...(pending.completeSession ? { postedAt: new Date().toISOString() } : {}),
        pendingPost: null,
        lastPostResult: result,
        updatedAt: new Date().toISOString(),
      };
      finalizeSessions.put(finalizedSession);
    } catch (error) {
      finalizeFailure = error;
      try { finalizeTx.abort(); } catch {}
    }
  };
  currentSessionRequest.onsuccess = () => { currentSession = currentSessionRequest.result ?? null; finalize(); };
  currentLinesRequest.onsuccess = () => { currentLines = currentLinesRequest.result; finalize(); };
  currentSessionRequest.onerror = () => { finalizeFailure = currentSessionRequest.error; try { finalizeTx.abort(); } catch {} };
  currentLinesRequest.onerror = () => { finalizeFailure = currentLinesRequest.error; try { finalizeTx.abort(); } catch {} };
  try {
    await transactionResult(finalizeTx, resolve => { finalizeTx.addEventListener("complete", () => resolve(finalizedSession), { once: true }); });
  } catch (error) {
    // Keep the saved command if local finalization fails after remote acceptance;
    // the next call replays the exact command ID/payload and receives the same result.
    throw finalizeFailure ?? error;
  }
  return { ...result, session: finalizedSession };
}
