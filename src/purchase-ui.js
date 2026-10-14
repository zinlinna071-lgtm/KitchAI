import { createPurchase, listPurchases, recordPurchaseReceipt, syncPurchaseReceipt, cancelPurchase, abandonPurchaseReceipt } from "./purchase-store.js";
import { listIngredients } from "./ingredient-store.js";

/** @param {string} selector @param {ParentNode} [root] @returns {Element|null} */
const $ = (selector, root = document) => root.querySelector(selector);
/** @param {string} selector @param {ParentNode} [root] @returns {Element[]} */
const queryAll = (selector, root = document) => [...root.querySelectorAll(selector)];

function setMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}
function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

/**
 * @param {{getScope:()=>any,getSession:()=>any,getRemoteBusinessId:()=>string|null|undefined}} context
 */
export function initializePurchaseUI(context) {
  const form = /** @type {HTMLFormElement|null} */ ($("#purchase-create-form"));
  const supplier = /** @type {HTMLInputElement|null} */ ($("#purchase-supplier"));
  const currency = /** @type {HTMLInputElement|null} */ ($("#purchase-currency"));
  const note = /** @type {HTMLTextAreaElement|null} */ ($("#purchase-note"));
  const linesContainer = /** @type {HTMLElement|null} */ ($("#purchase-line-entry-list"));
  const addLine = /** @type {HTMLButtonElement|null} */ ($("#purchase-add-line"));
  const state = /** @type {HTMLParagraphElement|null} */ ($("#purchase-state"));
  const listState = /** @type {HTMLParagraphElement|null} */ ($("#purchase-list-state"));
  const list = /** @type {HTMLUListElement|null} */ ($("#purchase-list"));
  const refreshButton = /** @type {HTMLButtonElement|null} */ ($("#purchase-refresh"));
  const submitButton = /** @type {HTMLButtonElement|null} */ ($("#purchase-create-button"));
  let cachedIngredients = [];

  function addLineRow() {
    if (!linesContainer) return;
    const row = document.createElement("fieldset");
    row.className = "purchase-line-entry";
    const legend = document.createElement("legend");
    legend.textContent = "Ingredient line";
    row.append(legend);
    const ingredientLabel = document.createElement("label");
    ingredientLabel.textContent = "Ingredient";
    const ingredientSelect = document.createElement("select");
    ingredientSelect.dataset.field = "ingredient";
    ingredientSelect.required = true;
    ingredientSelect.append(makeOption("", "Choose an ingredient"));
    for (const ingredient of cachedIngredients.filter(item => item.status !== "archived")) {
      ingredientSelect.append(makeOption(ingredient.id, ingredient.name));
    }
    ingredientLabel.append(ingredientSelect);
    const quantityLabel = document.createElement("label");
    quantityLabel.textContent = "Ordered quantity";
    const quantity = document.createElement("input");
    quantity.type = "number"; quantity.min = "0.000001"; quantity.step = "any";
    quantity.inputMode = "decimal"; quantity.required = true; quantity.dataset.field = "quantity";
    quantityLabel.append(quantity);
    const unitLabel = document.createElement("label");
    unitLabel.textContent = "Unit";
    const unit = document.createElement("select");
    unit.required = true; unit.dataset.field = "unit";
    for (const [value, label] of [["g","g · grams"],["kg","kg · kilograms"],["ml","ml · millilitres"],["l","l · litres"],["each","each · count"]]) unit.append(makeOption(value,label));
    unitLabel.append(unit);
    const priceLabel = document.createElement("label");
    priceLabel.textContent = "Unit price (optional)";
    const unitPrice = document.createElement("input");
    unitPrice.type = "text"; unitPrice.inputMode = "decimal"; unitPrice.placeholder = "0.00";
    unitPrice.value = ""; unitPrice.dataset.field = "unitPrice";
    priceLabel.append(unitPrice);
    row.append(ingredientLabel, quantityLabel, unitLabel, priceLabel);
    if (linesContainer.children.length > 0) {
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "button button-secondary";
      remove.textContent = "Remove line";
      remove.addEventListener("click", () => row.remove());
      row.append(remove);
    }
    linesContainer.append(row);
  }

  async function refresh() {
    if (!list || !listState || !form || !linesContainer) return;
    list.replaceChildren();
    const scope = context.getScope();
    if (!scope) {
      listState.textContent = "Save or load a business profile to manage purchases.";
      if (submitButton) submitButton.disabled = true;
      return;
    }
    try {
      cachedIngredients = await listIngredients(scope);
      const activeIngredients = cachedIngredients.filter(item => item.status !== "archived");
      if (linesContainer.children.length === 0) {
        addLineRow();
      } else {
        for (const row of queryAll(".purchase-line-entry", linesContainer)) {
          const select = /** @type {HTMLSelectElement|null} */ ($('[data-field="ingredient"]', row));
          if (!select) continue;
          const selected = select.value;
          select.replaceChildren(makeOption("", "Choose an ingredient"));
          for (const ingredient of activeIngredients) select.append(makeOption(ingredient.id, ingredient.name));
          if (activeIngredients.some(ingredient => ingredient.id === selected)) select.value = selected;
        }
      }
      if (addLine) addLine.disabled = activeIngredients.length === 0;
      if (submitButton) submitButton.disabled = cachedIngredients.filter(item => item.status !== "archived").length === 0;
      const purchases = await listPurchases(scope);
      listState.textContent = purchases.length ? "Purchase drafts and receipts are stored on this device. Only confirmed receipts affect server stock." : "No purchases yet.";
      if (!cachedIngredients.some(item => item.status !== "archived")) {
        listState.textContent = "Create an active ingredient first, then add a purchase.";
      }
      for (const purchase of purchases) {
        const item = document.createElement("li");
        item.className = "purchase-card";
        const heading = document.createElement("strong");
        heading.textContent = (purchase.supplierName || "Unspecified supplier") + " · " + purchase.status.replaceAll("_", " ");
        item.append(heading);
        const meta = document.createElement("p");
        meta.textContent = "Created " + new Date(purchase.createdAt).toLocaleString() + " · " + purchase.currency + " · prices are purchase inputs only, not inventory valuation.";
        item.append(meta);
        if (purchase.note) { const p = document.createElement("p"); p.textContent = purchase.note; item.append(p); }
        const lineList = document.createElement("ul");
        lineList.className = "purchase-card-lines";
        for (const line of purchase.lines) {
          const lineItem = document.createElement("li");
          lineItem.textContent = line.ingredientName + ": ordered " + line.orderedQuantity + " " + line.unit
            + ", confirmed " + line.receivedQuantity + " " + line.unit
            + ", pending/reserved " + (String(Number(line.reservedQuantity) - Number(line.receivedQuantity))) + " " + line.unit
            + ", outstanding " + line.outstandingQuantity + " " + line.unit;
          lineList.append(lineItem);
        }
        item.append(lineList);
        for (const receipt of purchase.receipts ?? []) {
          const receiptRow = document.createElement("div");
          receiptRow.className = "purchase-receipt-row";
          const receiptText = document.createElement("p");
          receiptText.textContent = "Receipt " + receipt.receiptId + " · " + receipt.state.replaceAll("_", " ")
            + (receipt.lastError ? " · " + receipt.lastError : "");
          receiptRow.append(receiptText);
          if (receipt.state === "permanent_error") {
            const abandonForm = document.createElement("form");
            abandonForm.className = "purchase-abandon-form";
            const reason = document.createElement("input");
            reason.type = "text"; reason.maxLength = 500; reason.required = true;
            reason.placeholder = "Why abandon this rejected receipt?";
            reason.setAttribute("aria-label", "Reason for abandoning rejected receipt");
            const abandon = document.createElement("button");
            abandon.type = "submit"; abandon.className = "button button-secondary";
            abandon.textContent = "Abandon rejected receipt";
            abandonForm.append(reason, abandon);
            abandonForm.addEventListener("submit", async event => {
              event.preventDefault();
              abandon.disabled = true;
              try {
                await abandonPurchaseReceipt(scope, purchase.purchaseId, receipt.receiptId, reason.value);
                setMessage(state, "Rejected receipt preserved in history and its quantity reservation released. No stock was added.");
              } catch (error) {
                setMessage(state, error instanceof Error ? error.message : "Could not abandon rejected receipt.", true);
              }
              await refresh();
            });
            receiptRow.append(abandonForm);
          } else if (receipt.state !== "synced" && receipt.state !== "abandoned") {
            const retry = document.createElement("button");
            retry.type = "button"; retry.className = "button button-secondary";
            retry.textContent = "Retry receipt";
            retry.disabled = !navigator.onLine || !context.getSession() || !context.getRemoteBusinessId();
            retry.addEventListener("click", async () => {
              retry.disabled = true;
              try {
                await syncPurchaseReceipt(scope, purchase.purchaseId, receipt.receiptId, context.getSession(), context.getRemoteBusinessId());
                setMessage(state, "Receipt accepted by the server. Stock was updated once.");
              } catch (error) {
                setMessage(state, "Receipt remains saved locally for retry. " + (error instanceof Error ? error.message : ""), true);
              }
              await refresh();
            });
            receiptRow.append(retry);
          }
          item.append(receiptRow);
        }
        if (purchase.status !== "cancelled" && purchase.status !== "received") {
          const receiptForm = document.createElement("form");
          receiptForm.className = "purchase-receipt-form";
          const label = document.createElement("strong");
          label.textContent = "Record partial or full receipt";
          receiptForm.append(label);
          for (const line of purchase.lines.filter(candidate => candidate.outstandingQuantity !== "0")) {
            const field = document.createElement("label");
            field.textContent = line.ingredientName + " · outstanding " + line.outstandingQuantity + " " + line.unit;
            const input = document.createElement("input");
            input.type = "number"; input.min = "0.000001"; input.step = "any"; input.inputMode = "decimal";
            input.placeholder = "Quantity received"; input.dataset.lineId = line.lineId;
            input.setAttribute("aria-label", line.ingredientName + " quantity received");
            field.append(input); receiptForm.append(field);
          }
          const receive = document.createElement("button");
          receive.type = "submit"; receive.className = "button button-primary"; receive.textContent = "Save receipt";
          receive.disabled = !context.getRemoteBusinessId();
          const help = document.createElement("p");
          help.className = "field-help";
          help.textContent = context.getRemoteBusinessId()
            ? "Receipt commands are saved before network delivery. Offline or failed posts do not change confirmed stock."
            : "A synced, server-issued business profile is required before a stock-changing receipt can be queued.";
          receiptForm.append(receive, help);
          receiptForm.addEventListener("submit", async event => {
            event.preventDefault();
            const receiptInputs = /** @type {HTMLInputElement[]} */ (queryAll("input[data-line-id]", receiptForm));
            const entries = receiptInputs.filter(input => input.value.trim() !== "")
              .map(input => ({ lineId: input.dataset.lineId, quantity: input.value.trim() }));
            if (!entries.length) { setMessage(state, "Enter at least one quantity received.", true); return; }
            receive.disabled = true;
            try {
              const saved = await recordPurchaseReceipt(scope, purchase.purchaseId, entries, context.getRemoteBusinessId());
              if (navigator.onLine && context.getSession()) {
                try {
                  await syncPurchaseReceipt(scope, purchase.purchaseId, saved.receipt.receiptId, context.getSession(), context.getRemoteBusinessId());
                  setMessage(state, "Receipt accepted by the server. Stock was updated once.");
                } catch (error) {
                  setMessage(state, "Receipt saved locally; server posting is pending. " + (error instanceof Error ? error.message : ""), true);
                }
              } else {
                setMessage(state, "Receipt command saved locally. Stock has not changed until an authenticated server accepts it.");
              }
              await refresh();
            } catch (error) {
              setMessage(state, error instanceof Error ? error.message : "Could not save receipt.", true);
              receive.disabled = false;
            }
          });
          item.append(receiptForm);
          const unresolvedReceipt = (purchase.receipts ?? []).some(receipt => ["pending", "syncing", "retryable_error", "permanent_error"].includes(receipt.state));
          if (unresolvedReceipt) {
            const help = document.createElement("p");
            help.className = "field-help";
            help.textContent = "Resolve receipt commands first. Network-uncertain commands must be retried; definitively rejected commands can be abandoned with a reason.";
            item.append(help);
          } else {
            const cancelForm = document.createElement("form");
            cancelForm.className = "purchase-cancel-form";
            const reason = document.createElement("input");
            reason.type = "text"; reason.maxLength = 500; reason.placeholder = "Cancellation reason"; reason.setAttribute("aria-label", "Purchase cancellation reason");
            const cancel = document.createElement("button");
            cancel.type = "submit"; cancel.className = "button button-secondary"; cancel.textContent = "Cancel unreceived remainder";
            cancelForm.append(reason, cancel);
            cancelForm.addEventListener("submit", async event => {
              event.preventDefault();
              try {
                await cancelPurchase(scope, purchase.purchaseId, reason.value);
                setMessage(state, "Purchase remainder cancelled. Earlier confirmed receipts remain in the ledger.");
                await refresh();
              } catch (error) {
                setMessage(state, error instanceof Error ? error.message : "Could not cancel purchase.", true);
              }
            });
            item.append(cancelForm);
          }
        }
        list.append(item);
      }
    } catch (error) {
      listState.textContent = error instanceof Error ? error.message : "Could not load purchases.";
      listState.classList.add("is-error");
    }
  }

  addLine?.addEventListener("click", () => {
    if (linesContainer && linesContainer.children.length < 100) addLineRow();
  });
  refreshButton?.addEventListener("click", () => { void refresh(); });
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const scope = context.getScope();
    if (!scope || !linesContainer) { setMessage(state, "Save a Business Profile first.", true); return; }
    if (submitButton) submitButton.disabled = true;
    try {
      const lines = queryAll(".purchase-line-entry", linesContainer).map(row => {
        const ingredientId = /** @type {HTMLSelectElement} */ ($('[data-field="ingredient"]', row)).value;
        const ingredient = cachedIngredients.find(item => item.id === ingredientId);
        if (!ingredient) throw new Error("Choose an active ingredient for each purchase line.");
        return {
          ingredientId, ingredientName: ingredient.name,
          orderedQuantity: /** @type {HTMLInputElement} */ ($('[data-field="quantity"]', row)).value.trim(),
          unit: /** @type {HTMLSelectElement} */ ($('[data-field="unit"]', row)).value,
          unitPrice: /** @type {HTMLInputElement} */ ($('[data-field="unitPrice"]', row)).value.trim() || null,
        };
      });
      await createPurchase(scope, {
        supplierName: supplier?.value ?? "", currency: currency?.value ?? "THB",
        note: note?.value ?? "", lines,
      });
      form.reset();
      if (currency) currency.value = "THB";
      setMessage(state, "Purchase draft saved locally. Stock has not changed.");
      await refresh();
    } catch (error) {
      setMessage(state, error instanceof Error ? error.message : "Could not save purchase.", true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  window.addEventListener("online", () => { void refresh(); });
  void refresh();
  return { refresh };
}
