import {
  createStockCountSession, addStockCountLine, listStockCountSessions, listStockCountLines, enterStockCount,
  reviewStockCountLine, postReviewedStockCountSubset, cancelStockCountSession, refreshStaleStockCountLine,
} from "./stock-count-store.js";
import { listIngredients } from "./ingredient-store.js";
import { listMenuItems } from "./menu-item-store.js";

const $ = (selector, root = document) => root.querySelector(selector);
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const pretty = value => String(value ?? "").replaceAll("_", " ");
const quantity = value => value === null || value === undefined ? "—" : String(value);

/** Accessible review/posting UI. It never treats a local draft as a server-confirmed stock change. */
export function initializeStockCountUI(context) {
  const refreshButton = $("#stock-count-refresh");
  const sessionSelect = $("#stock-count-session");
  const sessionState = $("#stock-count-state");
  const lineList = $("#stock-count-lines");
  const postButton = $("#stock-count-post-selected");
  const cancelButton = $("#stock-count-cancel");
  const createForm = $("#stock-count-create-form");
  const sessionNote = $("#stock-count-session-note");
  const createButton = $("#stock-count-create");
  const addLineForm = $("#stock-count-add-line-form");
  const itemClassSelect = $("#stock-count-item-class");
  const itemSelect = $("#stock-count-item");
  const itemUnitSelect = $("#stock-count-item-unit");
  const addLineButton = $("#stock-count-add-line");
  const message = (text, error = false) => {
    if (!sessionState) return;
    sessionState.textContent = text;
    sessionState.classList.toggle("is-error", error);
  };
  let sessions = [];
  let lines = [];
  let selectedSessionId = "";
  let busy = false;
  let ingredients = [];
  let menuItems = [];

  function lockControls() {
    const session = sessions.find(item => item.sessionId === selectedSessionId);
    if (postButton) {
      const hasAuth = Boolean(context.getSession()?.access_token);
      const pendingPost = Boolean(session?.pendingPost);
      postButton.textContent = pendingPost ? "Retry pending posting" : "Post selected reviewed lines";
      postButton.disabled = busy || !hasAuth || !session || (pendingPost
        ? !navigator.onLine
        : session.status !== "ready_for_review" || !lines.some(line => line.state === "reviewed"));
    }
    if (cancelButton) cancelButton.disabled = busy || !session || Boolean(session.pendingPost) || !["open", "ready_for_review"].includes(session.status);
    if (refreshButton) refreshButton.disabled = busy;
    if (sessionSelect) sessionSelect.disabled = busy || sessions.length === 0;
    const canCapture = Boolean(context.getSession()?.access_token && context.getRemoteBusinessId() && context.getScope()?.ownerId === context.getSession()?.user?.id && navigator.onLine);
    if (createButton) createButton.disabled = busy || !canCapture;
    if (addLineButton) addLineButton.disabled = busy || !canCapture || !session || Boolean(session.pendingPost) || !["open", "ready_for_review"].includes(session.status);
  }

  function renderItemOptions() {
    if (!itemSelect) return;
    const previous = itemSelect.value;
    itemSelect.replaceChildren(new Option("Choose an item", ""));
    const records = itemClassSelect?.value === "finished" ? menuItems : ingredients;
    for (const record of records.filter(item => item.status !== "archived")) {
      itemSelect.append(new Option(record.name, record.id));
    }
    if (records.some(item => item.id === previous && item.status !== "archived")) itemSelect.value = previous;

  }

  async function renderLines() {
    if (!lineList) return;
    lineList.replaceChildren();
    const session = sessions.find(item => item.sessionId === selectedSessionId);
    if (!session) {
      lineList.append(make("li", "Select a stock-count session to review its lines."));
      lockControls();
      return;
    }
    const heading = make("p", `Session status: ${pretty(session.status)} · ${lines.length} lines`);
    heading.className = "stock-count-session-summary";
    lineList.append(heading);
    if (session.pendingPost) {
      const pending = make("p", "A posting outcome is uncertain. Editing, reviewing and cancellation are locked until the saved command is reconciled.");
      pending.setAttribute("role", "alert");
      lineList.append(pending);
    }
    if (!lines.length) lineList.append(make("li", "This session has no count lines yet."));
    for (const line of lines) {
      const item = make("li", undefined, "stock-count-line");
      const title = make("h4", line.stockItemName);
      const meta = make("p", `${pretty(line.stockClass)} · ${line.unit} · expected ${quantity(line.systemQuantity)} · counted ${quantity(line.countedQuantity)} · variance ${quantity(line.variance)} · ${pretty(line.state)}`);
      item.append(title, meta);
      if (line.note) item.append(make("p", "Note: " + line.note));
      if (line.reason) item.append(make("p", "Review reason: " + line.reason));
      if (["open", "counted"].includes(line.state) && !session.pendingPost && !["cancelled", "posted"].includes(session.status)) {
        const form = make("form", undefined, "stock-count-line-form");
        const countLabel = make("label", "Counted quantity");
        const count = make("input");
        count.type = "number"; count.min = "0"; count.step = "any"; count.required = true;
        count.inputMode = "decimal"; count.value = line.countedQuantity === null ? "" : String(line.countedQuantity);
        countLabel.append(count);
        const noteLabel = make("label", "Count note");
        const noteInput = make("input");
        noteInput.type = "text"; noteInput.maxLength = 500; noteInput.value = line.note ?? "";
        noteLabel.append(noteInput);
        const saveCount = make("button", "Save count", "button button-secondary");
        saveCount.type = "submit";
        form.append(countLabel, noteLabel, saveCount);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          await runAction(async () => {
            await enterStockCount(context.getScope(), selectedSessionId, line.lineId, count.value, noteInput.value);
            lines = await listStockCountLines(context.getScope(), selectedSessionId);
            message("Count saved locally. Inventory has not changed.");
            await renderLines();
          });
        });
        item.append(form);
        const reviewForm = make("form", undefined, "stock-count-line-form");
        const reasonLabel = make("label", line.variance !== "0" ? "Review reason (required for non-zero variance)" : "Review note (optional)");
        const reason = make("input");
        reason.type = "text"; reason.maxLength = 500; reason.required = line.countedQuantity !== null && line.variance !== "0";
        reason.value = line.reason ?? "";
        reasonLabel.append(reason);
        const review = make("button", "Mark reviewed", "button button-secondary");
        review.type = "submit"; review.disabled = line.countedQuantity === null;
        reviewForm.append(reasonLabel, review);
        reviewForm.addEventListener("submit", async event => {
          event.preventDefault();
          await runAction(async () => {
            await reviewStockCountLine(context.getScope(), selectedSessionId, line.lineId, { reviewedBy: context.getSession()?.user?.id, reason: reason.value });
            lines = await listStockCountLines(context.getScope(), selectedSessionId);
            sessions = await listStockCountSessions(context.getScope());
            message("Line reviewed locally. Posting is a separate action.");
            await renderLines();
          });
        });
        item.append(reviewForm);
      }
      if (line.state === "stale" && context.getSession() && navigator.onLine) {
        const refreshLine = make("button", "Refresh stale item", "button button-secondary");
        refreshLine.type = "button";
        refreshLine.addEventListener("click", () => void runAction(async () => {
          await refreshStaleStockCountLine(context.getScope(), selectedSessionId, line.lineId, context.getSession());
          lines = await listStockCountLines(context.getScope(), selectedSessionId);
          sessions = await listStockCountSessions(context.getScope());
          message("Stale item refreshed from the server. Review it again before posting.");
          await renderLines();
        }));
        item.append(refreshLine);
      }
      const selectLabel = make("label", `Select ${line.stockItemName} for posting`);
      const checkbox = make("input");
      checkbox.type = "checkbox"; checkbox.dataset.lineId = line.lineId;
      checkbox.checked = false;
      checkbox.disabled = line.state !== "reviewed" || Boolean(session.pendingPost) || !context.getSession();
      selectLabel.prepend(checkbox);
      item.append(selectLabel);
      lineList.append(item);
    }
    lockControls();
  }

  async function submitPosting(lineIds, authSession) {
    let result;
    let actionError;
    try {
      result = await postReviewedStockCountSubset(context.getScope(), selectedSessionId, lineIds, authSession);
    } catch (error) {
      actionError = error;
    }

    // Always reload local state: a stale rejection clears the pending command and marks lines stale.
    try {
      sessions = await listStockCountSessions(context.getScope());
      lines = await listStockCountLines(context.getScope(), selectedSessionId);
      await renderLines();
    } catch (refreshError) {
      if (!actionError) actionError = refreshError;
    }
    if (actionError) throw actionError;
    message(result?.session?.status === "posted"
      ? "Server confirmed the stock-count posting."
      : "Server confirmed the selected posting. Review any remaining lines before posting again.");
  }

  async function runAction(action) {
    if (busy) return;
    busy = true; lockControls();
    try { await action(); }
    catch (error) { message(error instanceof Error ? error.message : "Stock-count action failed.", true); }
    finally { busy = false; lockControls(); }
  }

  async function refresh() {
    const scope = context.getScope();
    if (!scope) {
      sessions = []; lines = []; ingredients = []; menuItems = []; selectedSessionId = "";
      renderItemOptions();
      if (sessionSelect) { sessionSelect.replaceChildren(new Option("Save or load a business profile first", "")); }
      message("Save or load a business profile to review stock counts.");
      await renderLines();
      return;
    }
    await runAction(async () => {
      sessions = await listStockCountSessions(scope);
      ingredients = await listIngredients(scope);
      menuItems = await listMenuItems(scope);
      renderItemOptions();
      if (sessionSelect) {
        sessionSelect.replaceChildren(new Option("Choose a stock-count session", ""));
        for (const session of sessions) sessionSelect.append(new Option(`${new Date(session.createdAt).toLocaleString()} · ${pretty(session.status)} · ${session.lineCount} lines`, session.sessionId));
        if (sessions.some(item => item.sessionId === selectedSessionId)) sessionSelect.value = selectedSessionId;
        else selectedSessionId = sessionSelect.value = sessions[0]?.sessionId ?? "";
      }
      lines = selectedSessionId ? await listStockCountLines(scope, selectedSessionId) : [];
      message(sessions.length ? "Local count drafts loaded. Posting requires an authenticated owner and server confirmation." : "No stock-count sessions found in this business workspace.");
      await renderLines();
    });
  }

  sessionSelect?.addEventListener("change", () => void runAction(async () => {
    selectedSessionId = sessionSelect.value;
    lines = selectedSessionId ? await listStockCountLines(context.getScope(), selectedSessionId) : [];
    await renderLines();
  }));
  createForm?.addEventListener("submit", event => {
    event.preventDefault();
    void runAction(async () => {
      const scope = context.getScope();
      const session = context.getSession();
      const remoteBusinessId = context.getRemoteBusinessId();
      if (!scope || !session?.access_token || !remoteBusinessId || scope.ownerId !== session.user?.id || !navigator.onLine) {
        throw new Error("Sign in to the synced business workspace and connect to the internet to create a stock-count session.");
      }
      const created = await createStockCountSession(scope, remoteBusinessId, { note: sessionNote?.value ?? "" });
      selectedSessionId = created.sessionId;
      if (sessionNote) sessionNote.value = "";
      sessions = await listStockCountSessions(scope);
      lines = await listStockCountLines(scope, selectedSessionId);
      if (sessionSelect) {
        sessionSelect.replaceChildren(new Option("Choose a stock-count session", ""));
        for (const item of sessions) {
          sessionSelect.append(new Option(`${new Date(item.createdAt).toLocaleString()} · ${pretty(item.status)} · ${item.lineCount} lines`, item.sessionId));
        }
        sessionSelect.value = selectedSessionId;
      }
      renderItemOptions();
      await renderLines();
      message("Stock-count session created. Add items to capture their current server quantities.");
    });
  });
  itemClassSelect?.addEventListener("change", renderItemOptions);
  addLineForm?.addEventListener("submit", event => {
    event.preventDefault();
    void runAction(async () => {
      const scope = context.getScope();
      const session = context.getSession();
      const remoteBusinessId = context.getRemoteBusinessId();
      const stockClass = itemClassSelect?.value;
      const selected = (stockClass === "finished" ? menuItems : ingredients).find(item => item.id === itemSelect?.value);
      if (!scope || !selectedSessionId || !session?.access_token || !remoteBusinessId || !navigator.onLine) {
        throw new Error("Select a session, sign in to the synced business, and connect to the internet to capture an item snapshot.");
      }
      if (!selected) throw new Error("Choose a stock item first.");
      await addStockCountLine(scope, selectedSessionId, {
        stockClass, stockItemId: selected.id, stockItemName: selected.name,
        ...(itemUnitSelect?.value ? { unit: itemUnitSelect.value } : {}),
      }, session);
      lines = await listStockCountLines(scope, selectedSessionId);
      sessions = await listStockCountSessions(scope);
      message("Item added using a server snapshot. Record the physical quantity when ready.");
      await renderLines();
    });
  });
  refreshButton?.addEventListener("click", () => void refresh());
  cancelButton?.addEventListener("click", () => {
    if (!selectedSessionId || !window.confirm("Cancel this stock-count session? No inventory will be changed.")) return;
    void runAction(async () => {
      await cancelStockCountSession(context.getScope(), selectedSessionId);
      sessions = await listStockCountSessions(context.getScope());
      lines = await listStockCountLines(context.getScope(), selectedSessionId);
      message("Session cancelled. Inventory was not changed.");
      await renderLines();
    });
  });
  postButton?.addEventListener("click", () => {
    const session = sessions.find(item => item.sessionId === selectedSessionId);
    const authSession = context.getSession();
    if (!authSession?.access_token) { message("Sign in as the business owner before posting reviewed counts.", true); return; }
    if (session?.pendingPost) {
      const pendingIds = session.pendingPost.lineIds ?? session.pendingPost.command?.lines?.map(line => line.lineId) ?? [];
      if (!pendingIds.length) { message("The saved posting command has no recoverable line IDs. Keep the session unchanged and request support.", true); return; }
      void runAction(async () => {
        message("Retrying the saved posting command to reconcile the server result. Do not edit this session until reconciliation finishes.");
        await submitPosting(pendingIds, authSession);
      });
      return;
    }
    const ids = [...(lineList?.querySelectorAll('input[type="checkbox"][data-line-id]:checked') ?? [])].map(input => input.dataset.lineId);
    if (!ids.length) { message("Select at least one reviewed line to post.", true); return; }
    void runAction(async () => {
      message("Posting submitted. Do not edit this session until the server result is confirmed.");
      await submitPosting(ids, authSession);
    });
  });
  renderItemOptions();
  void refresh();
  return { refresh };
}
