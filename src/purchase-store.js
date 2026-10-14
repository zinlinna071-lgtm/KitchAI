import { openBusinessDatabase } from "./business-data-store.js";
import { buildPurchaseDraft, buildPurchaseReceiptCommand, projectPurchase } from "./purchase-domain.js";
import { applyInventoryCommand } from "./supabase-api.js";

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " is required.");
  return value.trim();
}
function scopeKey(scope) {
  return { ownerId: requireText(scope?.ownerId, "Owner scope"), businessId: requireText(scope?.businessId, "Local business partition") };
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
    tx.onerror = () => reject(tx.error ?? new Error("Purchase storage transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Purchase storage transaction was aborted."));
  });
}
async function readPurchase(scope, purchaseId) {
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readonly");
  return requestResult(tx.objectStore("purchases").get([scope.ownerId, scope.businessId, purchaseId]), "Could not read purchase.");
}
export async function createPurchase(scope, input) {
  const partition = scopeKey(scope);
  const purchase = buildPurchaseDraft(input);
  const record = { ...purchase, ownerId: partition.ownerId, businessId: partition.businessId };
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readwrite");
  const store = tx.objectStore("purchases");
  const request = store.add(record);
  request.onerror = () => { try { tx.abort(); } catch {} };
  return transactionResult(tx, resolve => { request.onsuccess = () => resolve(record); });
}
export async function listPurchases(scope) {
  const partition = scopeKey(scope);
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readonly");
  const request = tx.objectStore("purchases").index("byScope").getAll([partition.ownerId, partition.businessId]);
  return (await requestResult(request, "Could not list purchases.")).map(projectPurchase).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function recordPurchaseReceipt(scope, purchaseId, entries, remoteBusinessId) {
  const partition = scopeKey(scope);
  requireText(remoteBusinessId, "Server business ID");
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readwrite");
  const store = tx.objectStore("purchases");
  const request = store.get([partition.ownerId, partition.businessId, purchaseId]);
  return transactionResult(tx, resolve => {
    request.onsuccess = () => {
      try {
        const purchase = request.result;
        if (!purchase) throw new Error("Purchase was not found in this business workspace.");
        if (purchase.ownerId !== partition.ownerId || purchase.businessId !== partition.businessId) throw new Error("Purchase is outside this business workspace.");
        const receipt = buildPurchaseReceiptCommand(purchase, entries, { remoteBusinessId });
        const updated = { ...purchase, receipts: [...(purchase.receipts ?? []), receipt], updatedAt: new Date().toISOString() };
        store.put(updated);
        resolve({ purchase: projectPurchase(updated), receipt: structuredClone(receipt) });
      } catch (error) {
        try { tx.abort(); } catch {}
        resolve({ error });
      }
    };
    request.onerror = () => { try { tx.abort(); } catch {} };
  }).then(result => {
    if (result?.error) throw result.error;
    return result;
  });
}
export async function syncPurchaseReceipt(scope, purchaseId, receiptId, session, remoteBusinessId) {
  const partition = scopeKey(scope);
  if (session?.user?.id !== partition.ownerId || !session?.access_token) throw new Error("Sign in as the owner of this business before posting a receipt.");
  requireText(remoteBusinessId, "Server business ID");
  const purchase = await readPurchase(partition, purchaseId);
  if (!purchase) throw new Error("Purchase was not found in this business workspace.");
  const receipt = (purchase.receipts ?? []).find(item => item.receiptId === receiptId);
  if (!receipt) throw new Error("Receipt command was not found.");
  if (receipt.state === "synced") return projectPurchase(purchase);
  if (receipt.state === "abandoned" || receipt.state === "permanent_error") throw new Error("This receipt was rejected or abandoned and cannot be retried. Record a new receipt after correcting the issue.");
  if (receipt.command.businessId !== remoteBusinessId) throw new Error("Receipt is bound to a different server business ID; do not rewrite its command.");
  try {
    const result = await applyInventoryCommand(receipt.command, session);
    const latest = await readPurchase(partition, purchaseId);
    const updatedReceipts = latest.receipts.map(item => item.receiptId === receiptId
      ? { ...item, state: "synced", serverResult: result, lastError: null, syncedAt: new Date().toISOString() }
      : item);
    const projected = projectPurchase({ ...latest, receipts: updatedReceipts });
    const status = projected.lines.every(line => line.receivedQuantity === line.orderedQuantity) ? "received"
      : projected.lines.some(line => line.receivedQuantity !== "0") ? "partially_received" : "open";
    const db = await openBusinessDatabase();
    const tx = db.transaction("purchases", "readwrite");
    tx.objectStore("purchases").put({ ...latest, receipts: updatedReceipts, status, updatedAt: new Date().toISOString() });
    await transactionResult(tx);
    return projectPurchase({ ...latest, receipts: updatedReceipts, status });
  } catch (error) {
    const latest = await readPurchase(partition, purchaseId);
    const status = /** @type {any} */ (error).status;
    const code = /** @type {any} */ (error).code;
    const message = error instanceof Error ? error.message : "Receipt posting failed.";
    const permanent = [400, 403, 422].includes(status) || ["22023", "23514", "42501"].includes(code)
      || /server rejected/i.test(message);
    const updatedReceipts = latest.receipts.map(item => item.receiptId === receiptId
      ? { ...item, state: permanent ? "permanent_error" : "retryable_error", lastError: message }
      : item);
    const db = await openBusinessDatabase();
    const tx = db.transaction("purchases", "readwrite");
    tx.objectStore("purchases").put({ ...latest, receipts: updatedReceipts, updatedAt: new Date().toISOString() });
    await transactionResult(tx);
    throw error;
  }
}
/** Preserve a rejected immutable command while explicitly releasing its local quantity reservation. */
export async function abandonPurchaseReceipt(scope, purchaseId, receiptId, reason) {
  const partition = scopeKey(scope);
  const message = requireText(reason, "Abandonment reason");
  const purchase = await readPurchase(partition, purchaseId);
  if (!purchase) throw new Error("Purchase was not found in this business workspace.");
  const receipt = (purchase.receipts ?? []).find(item => item.receiptId === receiptId);
  if (!receipt || receipt.state !== "permanent_error") {
    throw new Error("Only a definitively rejected receipt can be abandoned. Retry uncertain network failures instead.");
  }
  const receipts = purchase.receipts.map(item => item.receiptId === receiptId
    ? { ...item, state: "abandoned", abandonedAt: new Date().toISOString(), abandonmentReason: message }
    : item);
  const projected = projectPurchase({ ...purchase, receipts });
  const status = projected.lines.every(line => line.receivedQuantity === line.orderedQuantity) ? "received"
    : projected.lines.some(line => line.receivedQuantity !== "0") ? "partially_received" : "open";
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readwrite");
  tx.objectStore("purchases").put({ ...purchase, receipts, status, updatedAt: new Date().toISOString() });
  await transactionResult(tx);
  return projectPurchase({ ...purchase, receipts, status });
}

export async function cancelPurchase(scope, purchaseId, reason) {
  const partition = scopeKey(scope);
  const message = requireText(reason, "Cancellation reason");
  const db = await openBusinessDatabase();
  const tx = db.transaction("purchases", "readwrite");
  const store = tx.objectStore("purchases");
  const request = store.get([partition.ownerId, partition.businessId, purchaseId]);
  return transactionResult(tx, resolve => {
    request.onsuccess = () => {
      const purchase = request.result;
      if (!purchase) { try { tx.abort(); } catch {} return; }
      if ((purchase.receipts ?? []).some(receipt => ["pending", "syncing", "retryable_error", "permanent_error"].includes(receipt.state))) {
        try { tx.abort(); } catch {}
        return;
      }
      if (purchase.status === "cancelled") { resolve(projectPurchase(purchase)); return; }
      const updated = { ...purchase, status: "cancelled", cancelledAt: new Date().toISOString(), cancellationReason: message };
      store.put(updated);
      resolve(projectPurchase(updated));
    };
    request.onerror = () => { try { tx.abort(); } catch {} };
  });
}
