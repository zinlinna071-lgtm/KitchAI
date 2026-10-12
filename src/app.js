import { readLocalProfile, saveLocalProfile } from "./local-store.js";
import {
  adoptRemoteProfile, acknowledge, applyRemoteAndResolve, keepLocalAndResolve,
  listConflicts, listOperations, listOwnerProfiles, markInFlight, markPermanentFailure,
  pauseForAuth, preserveConflict, recoverInterruptedOperations, saveOwnerProfileDraft, scheduleRetry,
} from "./sync-store.js";
import { resolveSyncConflict, syncPendingOperations } from "./sync-engine.js";
import { getSession, isSupabaseConfigured, readRemoteProfile, sendProfileOperation, signIn, signOut, signUp } from "./supabase-api.js";
import { listIngredients, saveIngredient, setIngredientStatus } from "./ingredient-store.js";
import { listMenuItems, saveMenuItem, setMenuItemStatus } from "./menu-item-store.js";

/** @typedef {Event & { prompt: () => Promise<void> }} BeforeInstallPromptEvent */
const connectionStatus = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#connection-status"));
const installButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#install-button"));

function updateConnectionStatus() {
  if (!connectionStatus) return;
  const online = navigator.onLine;
  connectionStatus.classList.toggle("is-offline", !online);
  connectionStatus.lastChild.textContent = online ? " Online" : " Offline · changes stay on this device";
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

const basePathMeta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="kitchai-base-path"]'));
const configuredBasePath = basePathMeta?.content ?? "/";
const appBasePath = configuredBasePath.startsWith("/") && configuredBasePath.endsWith("/")
  ? configuredBasePath
  : "/";

/** @type {BeforeInstallPromptEvent | undefined} */
let installPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  const promptEvent = /** @type {BeforeInstallPromptEvent} */ (event);
  promptEvent.preventDefault();
  installPrompt = promptEvent;
  if (installButton) installButton.hidden = false;
});
installButton?.addEventListener("click", async () => {
  const promptEvent = installPrompt;
  if (!promptEvent) return;
  await promptEvent.prompt();
  installPrompt = undefined;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  if (installButton) installButton.hidden = true;
});
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${appBasePath}sw.js`, { scope: appBasePath })
      .catch((error) => console.error("KitchAI offline support could not be registered.", error));
  });
}

const profileForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#profile-form"));
const businessNameInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#business-name"));
const profileState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#profile-state"));
const saveProfileButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#save-profile-button"));
const adoptLocalButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#adopt-local-draft"));
const authPanel = /** @type {HTMLElement | null} */ (document.querySelector("#auth-panel"));
const authForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#auth-form"));
const authEmail = /** @type {HTMLInputElement | null} */ (document.querySelector("#auth-email"));
const authPassword = /** @type {HTMLInputElement | null} */ (document.querySelector("#auth-password"));
const authActions = /** @type {HTMLElement | null} */ (document.querySelector("#auth-actions"));
const signUpButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#sign-up-button"));
const signOutButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#sign-out-button"));
const authState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#auth-state"));
const conflictPanel = /** @type {HTMLElement | null} */ (document.querySelector("#conflict-panel"));
const conflictBase = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#conflict-base"));
const conflictLocal = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#conflict-local"));
const conflictRemote = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#conflict-remote"));
const keepLocalButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#keep-local-button"));
const useRemoteButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#use-remote-button"));
let currentProfile = null;
let currentOwnerProfile = null;
let activeSession = null;
let syncRunning = false;
let retryTimer;

const ingredientForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#ingredient-form"));
const ingredientNameInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#ingredient-name"));
const ingredientDescriptionInput = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#ingredient-description"));
const ingredientState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#ingredient-state"));
const ingredientListState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#ingredient-list-state"));
const ingredientList = /** @type {HTMLUListElement | null} */ (document.querySelector("#ingredient-list"));
const saveIngredientButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#save-ingredient-button"));
const cancelIngredientEditButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#cancel-ingredient-edit"));
let editingIngredientId = null;

const menuItemForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#menu-item-form"));
const menuItemNameInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#menu-item-name"));
const menuItemDescriptionInput = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#menu-item-description"));
const menuItemState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#menu-item-state"));
const menuListState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#menu-list-state"));
const menuItemList = /** @type {HTMLUListElement | null} */ (document.querySelector("#menu-item-list"));
const saveMenuItemButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#save-menu-item-button"));
const cancelMenuItemEditButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#cancel-menu-item-edit"));
let editingMenuItemId = null;

function activeMenuScope() {
  if (activeSession?.user?.id) {
    if (!currentOwnerProfile?.businessId) return null;
    return { ownerId: activeSession.user.id, businessId: currentOwnerProfile.businessId };
  }
  if (!currentProfile?.businessId) return null;
  return { ownerId: "local:" + currentProfile.businessId, businessId: currentProfile.businessId };
}

/** @param {string} message @param {boolean=} isError */
function setMenuItemState(message, isError = false) {
  if (!menuItemState) return;
  menuItemState.textContent = message;
  menuItemState.classList.toggle("is-error", isError);
}

function resetMenuItemForm() {
  editingMenuItemId = null;
  if (menuItemForm) menuItemForm.reset();
  if (saveMenuItemButton) saveMenuItemButton.textContent = "Add menu item";
  if (cancelMenuItemEditButton) cancelMenuItemEditButton.hidden = true;
}

async function refreshMenuView() {
  if (!menuItemForm || !menuItemNameInput || !menuItemDescriptionInput || !menuItemList || !menuListState || !saveMenuItemButton) return;
  const scope = activeMenuScope();
  const disabled = !scope;
  menuItemNameInput.disabled = disabled;
  menuItemDescriptionInput.disabled = disabled;
  saveMenuItemButton.disabled = disabled;
  if (cancelMenuItemEditButton) cancelMenuItemEditButton.disabled = disabled;
  menuItemList.replaceChildren();
  if (!scope) {
    menuListState.textContent = activeSession
      ? "Create or load this account's Business Profile before managing menu items."
      : "Save a Business Profile first to start a menu.";
    setMenuItemState("Menu items are stored locally and are not synced to the cloud.");
    return;
  }
  try {
    const records = await listMenuItems(scope);
    menuListState.textContent = records.length
      ? records.length + (records.length === 1 ? " menu item in this business." : " menu items in this business.")
      : "No menu items yet. Add the first one using the form.";
    for (const record of records) {
      const item = document.createElement("li");
      item.className = "ingredient-list-item";
      const copy = document.createElement("div");
      copy.className = "ingredient-item-copy";
      const name = document.createElement("strong");
      name.textContent = record.name;
      copy.append(name);
      if (record.description) {
        const description = document.createElement("p");
        description.textContent = record.description;
        copy.append(description);
      }
      const status = document.createElement("span");
      status.className = "ingredient-item-status" + (record.status === "archived" ? " is-archived" : "");
      status.textContent = record.status === "archived" ? "Archived" : "Active";
      copy.append(status);
      const actions = document.createElement("div");
      actions.className = "ingredient-item-actions";
      const actionButton = (label, action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button-secondary";
        button.textContent = label;
        button.addEventListener("click", async () => {
          try {
            if (action === "edit") {
              editingMenuItemId = record.id;
              menuItemNameInput.value = record.name;
              menuItemDescriptionInput.value = record.description ?? "";
              saveMenuItemButton.textContent = "Save changes";
              if (cancelMenuItemEditButton) cancelMenuItemEditButton.hidden = false;
              setMenuItemState("Editing " + record.name + ". Changes stay on this device.");
              menuItemNameInput.focus();
              return;
            }
            await setMenuItemStatus(scope, record.id, action === "archive" ? "archived" : "active");
            if (editingMenuItemId === record.id) resetMenuItemForm();
            await refreshMenuView();
            setMenuItemState(action === "archive" ? "Menu item archived. It has not been deleted." : "Menu item reactivated.");
          } catch (error) {
            setMenuItemState(error instanceof Error ? error.message : "Could not update menu item status.", true);
          }
        });
        return button;
      };
      if (record.status === "active") {
        actions.append(actionButton("Edit", "edit"), actionButton("Archive", "archive"));
      } else {
        actions.append(actionButton("Reactivate", "reactivate"));
      }
      item.append(copy, actions);
      menuItemList.append(item);
    }
    if (!editingMenuItemId) setMenuItemState("Saved on this device only · menu item cloud sync is not implemented yet.");
  } catch (error) {
    menuListState.textContent = "Menu could not be loaded.";
    setMenuItemState(error instanceof Error ? "Local menu storage is unavailable: " + error.message : "Local menu storage is unavailable.", true);
  }
}


/** A signed-in workspace never falls back to another local identity's catalog. */
function activeIngredientScope() {
  if (activeSession?.user?.id) {
    if (!currentOwnerProfile?.businessId) return null;
    return { ownerId: activeSession.user.id, businessId: currentOwnerProfile.businessId };
  }
  if (!currentProfile?.businessId) return null;
  return { ownerId: "local:" + currentProfile.businessId, businessId: currentProfile.businessId };
}

/** @param {string} message @param {boolean=} isError */
function setIngredientState(message, isError = false) {
  if (!ingredientState) return;
  ingredientState.textContent = message;
  ingredientState.classList.toggle("is-error", isError);
}

function resetIngredientForm() {
  editingIngredientId = null;
  if (ingredientForm) ingredientForm.reset();
  if (saveIngredientButton) saveIngredientButton.textContent = "Add ingredient";
  if (cancelIngredientEditButton) cancelIngredientEditButton.hidden = true;
}

/** Render only records returned for the current owner/business partition. */
async function refreshIngredientView() {
  if (!ingredientForm || !ingredientNameInput || !ingredientDescriptionInput || !ingredientList || !ingredientListState || !saveIngredientButton) return;
  const scope = activeIngredientScope();
  const disabled = !scope;
  ingredientNameInput.disabled = disabled;
  ingredientDescriptionInput.disabled = disabled;
  saveIngredientButton.disabled = disabled;
  if (cancelIngredientEditButton) cancelIngredientEditButton.disabled = disabled;
  ingredientList.replaceChildren();
  if (!scope) {
    ingredientListState.textContent = activeSession
      ? "Create or load this account's Business Profile before managing its ingredients."
      : "Save a Business Profile first to start an ingredient catalog.";
    setIngredientState("Ingredient changes are stored locally and are not synced to the cloud.");
    return;
  }
  try {
    const records = await listIngredients(scope);
    ingredientListState.textContent = records.length
      ? records.length + (records.length === 1 ? " ingredient in this business." : " ingredients in this business.")
      : "No ingredients yet. Add the first one using the form.";
    for (const record of records) {
      const item = document.createElement("li");
      item.className = "ingredient-list-item";
      const copy = document.createElement("div");
      copy.className = "ingredient-item-copy";
      const name = document.createElement("strong");
      name.textContent = record.name;
      copy.append(name);
      if (record.description) {
        const description = document.createElement("p");
        description.textContent = record.description;
        copy.append(description);
      }
      const status = document.createElement("span");
      status.className = "ingredient-item-status" + (record.status === "archived" ? " is-archived" : "");
      status.textContent = record.status === "archived" ? "Archived" : "Active";
      copy.append(status);
      const actions = document.createElement("div");
      actions.className = "ingredient-item-actions";
      const actionButton = (label, action, variant = "button-secondary") => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button " + variant;
        button.textContent = label;
        button.addEventListener("click", async () => {
          try {
            if (action === "edit") {
              editingIngredientId = record.id;
              ingredientNameInput.value = record.name;
              ingredientDescriptionInput.value = record.description ?? "";
              saveIngredientButton.textContent = "Save changes";
              if (cancelIngredientEditButton) cancelIngredientEditButton.hidden = false;
              setIngredientState("Editing " + record.name + ". Changes stay on this device.");
              ingredientNameInput.focus();
              return;
            }
            await setIngredientStatus(scope, record.id, action === "archive" ? "archived" : "active");
            if (editingIngredientId === record.id) resetIngredientForm();
            await refreshIngredientView();
            setIngredientState(action === "archive" ? "Ingredient archived. It has not been deleted." : "Ingredient reactivated.");
          } catch (error) {
            setIngredientState(error instanceof Error ? error.message : "Could not update ingredient status.", true);
          }
        });
        return button;
      };
      if (record.status === "active") {
        actions.append(actionButton("Edit", "edit"));
        actions.append(actionButton("Archive", "archive"));
      } else {
        actions.append(actionButton("Reactivate", "reactivate"));
      }
      item.append(copy, actions);
      ingredientList.append(item);
    }
    if (!editingIngredientId) setIngredientState("Saved on this device only · ingredient cloud sync is not implemented yet.");
  } catch (error) {
    ingredientListState.textContent = "Ingredient catalog could not be loaded.";
    setIngredientState(error instanceof Error ? "Local ingredient storage is unavailable: " + error.message : "Local ingredient storage is unavailable.", true);
  }
}


/** @param {string} message @param {boolean=} isError */
function setProfileState(message, isError = false) {
  if (!profileState) return;
  profileState.textContent = message;
  profileState.classList.toggle("is-error", isError);
}

/** @param {string} message @param {boolean=} isError */
function setAuthState(message, isError = false) {
  if (!authState) return;
  authState.textContent = message;
  authState.classList.toggle("is-error", isError);
}

function updateAuthControls() {
  if (!authPanel) return;
  authPanel.hidden = !isSupabaseConfigured();
  const signedIn = Boolean(activeSession?.user?.id);
  if (authEmail) authEmail.disabled = signedIn;
  if (authPassword) authPassword.disabled = signedIn;
  if (authActions) authActions.hidden = signedIn;
  if (signOutButton) signOutButton.hidden = !signedIn;
  if (signedIn) {
    setAuthState("Signed in as " + (activeSession.user.email ?? activeSession.user.id) + ". Sync is limited to this account.");
  } else if (!isSupabaseConfigured()) {
    setAuthState("Local-only mode. Configure the local Supabase endpoint to enable account sync.");
  }
}

const syncStore = {
  listOperations,
  markInFlight,
  acknowledge,
  preserveConflict,
  pauseForAuth,
  markPermanentFailure,
  scheduleRetry,
};

async function showUnresolvedConflict(ownerId) {
  if (!conflictPanel) return;
  const conflicts = (await listConflicts(ownerId)).filter(conflict => conflict.state === "unresolved");
  const conflict = conflicts[0];
  conflictPanel.hidden = !conflict;
  if (!conflict) return;
  if (conflictBase) conflictBase.textContent = "Base (revision " + (conflict.baseRevision ?? "new") + "): " + (conflict.baseSnapshot?.name ?? "No prior profile");
  if (conflictLocal) conflictLocal.textContent = "Your version: " + (conflict.localSnapshot?.name ?? "Unavailable");
  if (conflictRemote) conflictRemote.textContent = "Remote version (revision " + conflict.remoteRevision + "): " + (conflict.remoteSnapshot?.name ?? "Unavailable");
}

/** @param {any} profile */
function stateLabel(profile) {
  switch (profile?.syncState) {
    case "synced": return "Synced with your account · revision " + profile.revision + ".";
    case "syncing": return "Syncing with your account…";
    case "retryable_error": return "Saved on this device · retry is pending.";
    case "needs_auth": return "Saved on this device · sign in again to sync.";
    case "failed_permanent": return "Saved on this device · the server rejected this change. Review the error before retrying.";
    case "conflict": return "Both versions are preserved. Review the conflict below.";
    default: return "Saved on this device · waiting to sync.";
  }
}

async function refreshOwnerView() {
  if (!activeSession || !businessNameInput) return;
  const ownerId = activeSession.user.id;
  const profiles = await listOwnerProfiles(ownerId);
  currentOwnerProfile = profiles[0] ?? null;
  if (currentOwnerProfile) {
    businessNameInput.value = currentOwnerProfile.name;
    setProfileState(stateLabel(currentOwnerProfile));
    if (adoptLocalButton) adoptLocalButton.hidden = true;
  } else {
    businessNameInput.value = "";
    setProfileState(currentProfile
      ? "No account profile yet. Your existing local draft is separate; copy it explicitly if you want to use it in this account."
      : "No profile in this account yet. Enter a business name and save to create one.");
    if (adoptLocalButton) adoptLocalButton.hidden = !currentProfile;
  }
  await showUnresolvedConflict(ownerId);
  await refreshIngredientView();
  await refreshMenuView();
}

async function scheduleRetryForOwner(ownerId) {
  const operations = await listOperations(ownerId);
  const dueTimes = operations
    .filter(operation => operation.state === "retryable_error")
    .map(operation => operation.nextAttemptAt ?? Date.now());
  if (!dueTimes.length) return;
  const delay = Math.max(250, Math.min(5 * 60 * 1000, Math.min(...dueTimes) - Date.now()));
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { void runSync(); }, delay);
}

async function runSync() {
  if (!activeSession || !navigator.onLine || syncRunning || !isSupabaseConfigured()) return;
  syncRunning = true;
  try {
    const session = await getSession();
    if (!session) {
      activeSession = null;
      currentOwnerProfile = null;
      updateAuthControls();
      await loadLocalProfile();
      setAuthState("Your session expired. Local changes are preserved; sign in to resume sync.", true);
      return;
    }
    activeSession = session;
    const ownerId = session.user.id;
    await recoverInterruptedOperations(ownerId);
    const summary = await syncPendingOperations({
      ownerId,
      store: syncStore,
      send: operation => activeSession?.user?.id === ownerId
        ? sendProfileOperation(operation, session)
        : Promise.resolve({ status: "auth_required" }),
    });
    await refreshOwnerView();
    if (summary.pausedForAuth) {
      clearTimeout(retryTimer);
      try { await signOut(); } catch {}
      activeSession = null;
      currentOwnerProfile = null;
      updateAuthControls();
      await loadLocalProfile();
      setAuthState("Your session needs attention. Unsynced account work is preserved and locked; sign in again to resume sync.", true);
      return;
    } else if (summary.conflicts) {
      setAuthState("A revision conflict needs your review. Neither version was discarded.", true);
    } else if (summary.failed) {
      setAuthState("The server rejected a change. Local data is preserved; automatic retries have stopped.", true);
    } else if (summary.synced) {
      setAuthState("Sync complete. The server confirmed the latest profile revision.");
    } else if (summary.retried) {
      setAuthState("Connection failed temporarily. The queued operation will retry with the same operation ID.", true);
    }
    await scheduleRetryForOwner(ownerId);
  } catch (error) {
    setProfileState("Could not sync. Local changes and queued operations are preserved. " + (error instanceof Error ? error.message : ""), true);
  } finally {
    syncRunning = false;
  }
}

async function loadOwnerWorkspace(session) {
  activeSession = session;
  currentOwnerProfile = null;
  updateAuthControls();
  if (!session?.user?.id || !businessNameInput) return;
  businessNameInput.value = "";
  if (adoptLocalButton) adoptLocalButton.hidden = true;
  const ownerId = session.user.id;
  try {
    await recoverInterruptedOperations(ownerId);
    let profiles = await listOwnerProfiles(ownerId);
    const operations = await listOperations(ownerId);
    if (!profiles.length && !operations.length && navigator.onLine) {
      const remote = await readRemoteProfile(session);
      if (remote) await adoptRemoteProfile(ownerId, remote);
      profiles = await listOwnerProfiles(ownerId);
    }
    await refreshOwnerView();
    if (operations.some(operation => ["pending", "retryable_error", "in_flight"].includes(operation.state))) {
      await runSync();
    }
  } catch (error) {
    setProfileState("Account workspace could not be loaded. Existing local data is preserved. " + (error instanceof Error ? error.message : ""), true);
  }
}

async function loadLocalProfile() {
  if (!profileForm || !businessNameInput || !profileState) return;
  try {
    currentProfile = await readLocalProfile();
    if (activeSession) {
      await loadOwnerWorkspace(activeSession);
      return;
    }
    if (currentProfile) {
      businessNameInput.value = currentProfile.name;
      setProfileState("Saved on this device · not synced.");
    } else {
      businessNameInput.value = "";
      setProfileState("No profile saved on this device yet.");
    }
    if (adoptLocalButton) adoptLocalButton.hidden = true;
    await refreshIngredientView();
    await refreshMenuView();
  } catch (error) {
    setProfileState(error instanceof Error
      ? "Local storage is unavailable: " + error.message
      : "Local storage is unavailable. Your profile has not been saved.", true);
  }
}

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!businessNameInput || !profileState) return;
  if (saveProfileButton) saveProfileButton.disabled = true;
  if (adoptLocalButton) adoptLocalButton.disabled = true;
  try {
    if (activeSession) {
      const ownerId = activeSession.user.id;
      if (currentOwnerProfile?.syncState === "conflict") {
        setProfileState("Resolve the existing conflict before making another edit.", true);
        return;
      }
      const saved = await saveOwnerProfileDraft({
        ownerId,
        id: currentOwnerProfile?.id,
        name: businessNameInput.value,
        baseRevision: currentOwnerProfile?.revision ?? null,
      });
      currentOwnerProfile = saved.profile;
      businessNameInput.value = saved.profile.name;
      setProfileState(stateLabel(saved.profile));
      await refreshIngredientView();
      await refreshMenuView();
      await runSync();
    } else {
      const saved = await saveLocalProfile({ id: currentProfile?.id, name: businessNameInput.value });
      currentProfile = saved.profile;
      businessNameInput.value = saved.profile.name;
      setProfileState("Saved on this device · not synced (local version " + saved.localRevision + ").");
      await refreshIngredientView();
      await refreshMenuView();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected storage error.";
    setProfileState(/business name|80 characters/i.test(message)
      ? message
      : "Could not save locally; your changes were not saved. " + message, true);
  } finally {
    if (saveProfileButton) saveProfileButton.disabled = false;
    if (adoptLocalButton) adoptLocalButton.disabled = false;
  }
});


ingredientForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const scope = activeIngredientScope();
  if (!scope || !ingredientNameInput || !ingredientDescriptionInput || !saveIngredientButton) {
    setIngredientState("Save or load a Business Profile before adding ingredients.", true);
    return;
  }
  saveIngredientButton.disabled = true;
  if (cancelIngredientEditButton) cancelIngredientEditButton.disabled = true;
  try {
    const saved = await saveIngredient(scope, {
      ...(editingIngredientId ? { id: editingIngredientId } : {}),
      name: ingredientNameInput.value,
      description: ingredientDescriptionInput.value,
    });
    resetIngredientForm();
    await refreshIngredientView();
    setIngredientState((saved.status === "archived" ? "Ingredient updated." : "Ingredient saved on this device.") + " Cloud sync is not implemented yet.");
  } catch (error) {
    setIngredientState(error instanceof Error ? error.message : "Could not save ingredient.", true);
  } finally {
    saveIngredientButton.disabled = !activeIngredientScope();
    if (cancelIngredientEditButton) cancelIngredientEditButton.disabled = false;
  }
});

cancelIngredientEditButton?.addEventListener("click", () => {
  resetIngredientForm();
  setIngredientState("Edit cancelled. No changes were made.");
});


menuItemForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const scope = activeMenuScope();
  if (!scope || !menuItemNameInput || !menuItemDescriptionInput || !saveMenuItemButton) {
    setMenuItemState("Save or load a Business Profile before adding menu items.", true);
    return;
  }
  saveMenuItemButton.disabled = true;
  if (cancelMenuItemEditButton) cancelMenuItemEditButton.disabled = true;
  try {
    await saveMenuItem(scope, {
      ...(editingMenuItemId ? { id: editingMenuItemId } : {}),
      name: menuItemNameInput.value,
      description: menuItemDescriptionInput.value,
    });
    resetMenuItemForm();
    await refreshMenuView();
    setMenuItemState("Menu item saved on this device. Recipe association and cloud sync are not implemented yet.");
  } catch (error) {
    setMenuItemState(error instanceof Error ? error.message : "Could not save menu item.", true);
  } finally {
    saveMenuItemButton.disabled = !activeMenuScope();
    if (cancelMenuItemEditButton) cancelMenuItemEditButton.disabled = false;
  }
});

cancelMenuItemEditButton?.addEventListener("click", () => {
  resetMenuItemForm();
  setMenuItemState("Edit cancelled. No changes were made.");
});

adoptLocalButton?.addEventListener("click", async () => {
  if (!activeSession || !currentProfile) return;
  adoptLocalButton.disabled = true;
  try {
    const saved = await saveOwnerProfileDraft({ ownerId: activeSession.user.id, name: currentProfile.name });
    currentOwnerProfile = saved.profile;
    await refreshIngredientView();
    await refreshMenuView();
    await runSync();
  } catch (error) {
    setProfileState("Could not copy the local draft into this account. The original draft remains unchanged. " + (error instanceof Error ? error.message : ""), true);
  } finally {
    adoptLocalButton.disabled = false;
  }
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authEmail || !authPassword || !isSupabaseConfigured()) return;
  const button = /** @type {HTMLButtonElement | null} */ (authForm.querySelector('button[type="submit"]'));
  if (button) button.disabled = true;
  try {
    const session = await signIn(authEmail.value, authPassword.value);
    authPassword.value = "";
    await loadOwnerWorkspace(session);
    setAuthState("Signed in. Your workspace is scoped to this account.");
  } catch (error) {
    setAuthState(error instanceof Error ? error.message : "Sign-in failed.", true);
  } finally {
    if (button) button.disabled = false;
  }
});

signUpButton?.addEventListener("click", async () => {
  if (!authEmail || !authPassword || !isSupabaseConfigured()) return;
  signUpButton.disabled = true;
  try {
    const session = await signUp(authEmail.value, authPassword.value);
    authPassword.value = "";
    await loadOwnerWorkspace(session);
    setAuthState("Account created and signed in. Your workspace is scoped to this account.");
  } catch (error) {
    setAuthState(error instanceof Error ? error.message : "Account creation failed.", true);
  } finally {
    signUpButton.disabled = false;
  }
});

signOutButton?.addEventListener("click", async () => {
  clearTimeout(retryTimer);
  activeSession = null;
  currentOwnerProfile = null;
  updateAuthControls();
  try {
    await signOut();
  } catch {
    // Local session data is cleared even if the remote logout endpoint is unreachable.
  }
  await loadLocalProfile();
  setAuthState("Signed out. Unsynced account work is preserved and locked to its previous owner.");
});

async function resolveConflictChoice(choice) {
  if (!activeSession) return;
  const conflicts = (await listConflicts(activeSession.user.id)).filter(conflict => conflict.state === "unresolved");
  if (!conflicts.length) return;
  try {
    await resolveSyncConflict({
      ownerId: activeSession.user.id,
      conflict: conflicts[0],
      choice,
      store: { keepLocalAndResolve, applyRemoteAndResolve },
    });
    await refreshOwnerView();
    if (choice === "keep_local") await runSync();
    else setAuthState("Remote version selected. The original conflict and resolution are retained.");
  } catch (error) {
    setProfileState("Conflict resolution was not completed; both versions remain recoverable. " + (error instanceof Error ? error.message : ""), true);
  }
}
keepLocalButton?.addEventListener("click", () => { void resolveConflictChoice("keep_local"); });
useRemoteButton?.addEventListener("click", () => { void resolveConflictChoice("use_remote"); });
window.addEventListener("online", () => { void runSync(); });

updateAuthControls();
void (async () => {
  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (session) {
      await loadOwnerWorkspace(session);
      return;
    }
  }
  await loadLocalProfile();
})();
