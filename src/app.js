import { readLocalProfile, saveLocalProfile } from "./local-store.js";
import { scopeForBusinessProfile } from "./business-data-store.js";
import {
  adoptRemoteProfile, acknowledge, applyRemoteAndResolve, keepLocalAndResolve,
  listConflicts, listOperations, listOwnerProfiles, markInFlight, markPermanentFailure,
  pauseForAuth, preserveConflict, recoverInterruptedOperations, saveOwnerProfileDraft, scheduleRetry,
} from "./sync-store.js";
import { resolveSyncConflict, syncPendingOperations } from "./sync-engine.js";
import { getSession, isSupabaseConfigured, readRemoteProfile, sendProfileOperation, signIn, signOut, signUp } from "./supabase-api.js";
import { listIngredients, saveIngredient, setIngredientStatus } from "./ingredient-store.js";
import { listMenuItems, saveMenuItem, setMenuItemStatus } from "./menu-item-store.js";
import { listRecipes, listRecipeLines, saveRecipe, saveRecipeLine, setRecipeStatus } from "./recipe-store.js";
import { createPhase2SyncStore, syncPhase2Operations, sendPhase2EntityOperation, readRemotePhase2Entity, normalizeRemoteEntity } from "./phase2-sync-engine.js";
import { buildCarryForwardDecision, buildFinishedDispositionCommand, projectFinishedLotBalances } from "./finished-stock-domain.js";
import { listCarryForwardDecisions, saveCarryForwardDecision, syncCarryForwardDecision } from "./finished-stock-store.js";
import { getFinishedStockSnapshot, listFinishedDispositions, refreshFinishedStock, saveFinishedDisposition, syncFinishedDisposition } from "./finished-stock-workflow-store.js";
import { listProductionBatches, startProductionBatch, recordProductionBatchActualUsage, prepareProductionBatchForPosting, cancelProductionBatch, postProductionBatch } from "./production-batch-store.js";

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
const phase2SyncState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#phase2-sync-state"));
const phase2SyncButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#phase2-sync-now"));
const phase2ConflictList = /** @type {HTMLElement | null} */ (document.querySelector("#phase2-conflict-list"));
let currentProfile = null;
let currentOwnerProfile = null;
let activeSession = null;
let syncRunning = false;
let phase2SyncRunning = false;
let retryTimer;
const phase2SyncStore = createPhase2SyncStore();

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
    if (!currentOwnerProfile?.id) return null;
    return scopeForBusinessProfile({ ownerId: activeSession.user.id, profileId: currentOwnerProfile.id });
  }
  if (!currentProfile?.id) return null;
  return scopeForBusinessProfile({ profileId: currentProfile.id, local: true });
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
      await refreshRecipeView();
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
    if (!editingMenuItemId) setMenuItemState(activeSession?.user?.id ? "Menu items loaded. Account sync status is shown above." : "Saved on this device only. Sign in to sync menu items.");
  } catch (error) {
    menuListState.textContent = "Menu could not be loaded.";
    setMenuItemState(error instanceof Error ? "Local menu storage is unavailable: " + error.message : "Local menu storage is unavailable.", true);
  }
}



const recipeForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#recipe-form"));
const recipeMenuItemSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#recipe-menu-item"));
const recipeNameInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#recipe-name"));
const recipeDescriptionInput = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#recipe-description"));
const recipeInstructionsInput = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#recipe-instructions"));
const recipeYieldInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#recipe-yield"));
const recipeStatusSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#recipe-status"));
const saveRecipeButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#save-recipe-button"));
const cancelRecipeEditButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#cancel-recipe-edit"));
const recipeState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#recipe-state"));
const recipeListState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#recipe-list-state"));
const recipeList = /** @type {HTMLUListElement | null} */ (document.querySelector("#recipe-list"));
const recipeLineForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#recipe-line-form"));
const recipeLineRecipeSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#recipe-line-recipe"));
const recipeLineIngredientSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#recipe-line-ingredient"));
const recipeLineQuantityInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#recipe-line-quantity"));
const recipeLineUnitSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#recipe-line-unit"));
const recipeLinePositionInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#recipe-line-position"));
const recipeLineNoteInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#recipe-line-note"));
const saveRecipeLineButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#save-recipe-line-button"));
const cancelRecipeLineEditButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#cancel-recipe-line-edit"));
const recipeLineState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#recipe-line-state"));
const recipeLineList = /** @type {HTMLUListElement | null} */ (document.querySelector("#recipe-line-list"));
let editingRecipeId = null;
let selectedRecipeId = "";
let editingRecipeLineId = null;

const productionStartForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#production-start-form"));
const productionRecipeSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector("#production-recipe"));
const productionStartButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#production-start-button"));
const productionState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#production-state"));
const productionListState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#production-list-state"));
const productionBatchList = /** @type {HTMLUListElement | null} */ (document.querySelector("#production-batch-list"));


/** @param {HTMLSelectElement} select @param {{value:string,label:string}[]} options @param {string} placeholder @param {string} selected */
function setSelectOptions(select, options, placeholder, selected) {
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.append(first);
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = options.some((option) => option.value === selected) ? selected : "";
}

/** @param {string} message @param {boolean=} isError */
function setRecipeState(message, isError = false) {
  if (!recipeState) return;
  recipeState.textContent = message;
  recipeState.classList.toggle("is-error", isError);
}

/** @param {string} message @param {boolean=} isError */
function setRecipeLineState(message, isError = false) {
  if (!recipeLineState) return;
  recipeLineState.textContent = message;
  recipeLineState.classList.toggle("is-error", isError);
}

function resetRecipeForm() {
  editingRecipeId = null;
  recipeForm?.reset();
  if (saveRecipeButton) saveRecipeButton.textContent = "Save recipe draft";
  if (cancelRecipeEditButton) cancelRecipeEditButton.hidden = true;
}

function resetRecipeLineForm() {
  editingRecipeLineId = null;
  recipeLineForm?.reset();
  if (recipeLinePositionInput) recipeLinePositionInput.value = "0";
  if (saveRecipeLineButton) saveRecipeLineButton.textContent = "Add ingredient line";
  if (cancelRecipeLineEditButton) cancelRecipeLineEditButton.hidden = true;
}

async function refreshRecipeLines(scope, recipes, ingredients) {
  if (!recipeLineRecipeSelect || !recipeLineIngredientSelect || !recipeLineList || !recipeLineForm || !recipeLineQuantityInput || !recipeLinePositionInput || !recipeLineUnitSelect || !saveRecipeLineButton) return;
  const availableRecipes = recipes;
  setSelectOptions(recipeLineRecipeSelect, availableRecipes.map((recipe) => ({
    value: recipe.id, label: recipe.name + (recipe.status === "active" ? " · Active" : recipe.status === "archived" ? " · Archived" : " · Draft"),
  })), "Choose a recipe", selectedRecipeId);
  if (!recipeLineRecipeSelect.value && availableRecipes.length) {
    selectedRecipeId = (availableRecipes.find((recipe) => recipe.status !== "archived") ?? availableRecipes[0]).id;
    recipeLineRecipeSelect.value = selectedRecipeId;
  } else {
    selectedRecipeId = recipeLineRecipeSelect.value;
  }
  setSelectOptions(recipeLineIngredientSelect, ingredients.filter((item) => item.status === "active").map((item) => ({
    value: item.id, label: item.name,
  })), "Choose an ingredient", recipeLineIngredientSelect.value);
  const selectedRecipe = availableRecipes.find((recipe) => recipe.id === selectedRecipeId);
  const editable = Boolean(scope && selectedRecipe && selectedRecipe.status !== "archived");
  recipeLineRecipeSelect.disabled = !scope || availableRecipes.length === 0;
  recipeLineIngredientSelect.disabled = !editable || ingredients.every((item) => item.status !== "active");
  recipeLineQuantityInput.disabled = !editable;
  recipeLineUnitSelect.disabled = !editable;
  recipeLinePositionInput.disabled = !editable;
  if (recipeLineNoteInput) recipeLineNoteInput.disabled = !editable;
  saveRecipeLineButton.disabled = !editable || ingredients.every((item) => item.status !== "active");
  recipeLineList.replaceChildren();
  if (!scope || !selectedRecipe) {
    setRecipeLineState(!scope ? "Save or load a Business Profile first." : "Save a menu item and recipe draft before adding ingredient lines.");
    return;
  }
  try {
    const lines = await listRecipeLines(scope, selectedRecipe.id);
    recipeLinePositionInput.value = editingRecipeLineId ? recipeLinePositionInput.value : String(lines.length);
    setRecipeLineState(lines.length ? lines.length + " ingredient line(s). Quantities and units are stored exactly as entered." : "No ingredient lines yet. Add at least one valid line before activating this recipe.");
    for (const line of lines) {
      const item = document.createElement("li");
      item.className = "ingredient-list-item";
      const copy = document.createElement("div");
      copy.className = "ingredient-item-copy";
      const name = document.createElement("strong");
      name.textContent = (ingredients.find((ingredient) => ingredient.id === line.ingredientId)?.name ?? "Unknown ingredient") + " · " + line.quantity + " " + line.unit;
      const detail = document.createElement("p");
      detail.textContent = "Position " + line.position + (line.note ? " · " + line.note : "");
      copy.append(name, detail);
      const actions = document.createElement("div");
      actions.className = "ingredient-item-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button button-secondary";
      edit.textContent = "Edit line";
      edit.disabled = selectedRecipe.status === "archived";
      edit.addEventListener("click", () => {
        editingRecipeLineId = line.id;
        recipeLineRecipeSelect.value = line.recipeId;
        selectedRecipeId = line.recipeId;
        recipeLineIngredientSelect.value = line.ingredientId;
        recipeLineQuantityInput.value = String(line.quantity);
        recipeLineUnitSelect.value = line.unit;
        recipeLinePositionInput.value = String(line.position);
        if (recipeLineNoteInput) recipeLineNoteInput.value = line.note ?? "";
        saveRecipeLineButton.textContent = "Save line changes";
        if (cancelRecipeLineEditButton) cancelRecipeLineEditButton.hidden = false;
        setRecipeLineState("Editing ingredient line. Other lines are preserved.");
        recipeLineQuantityInput.focus();
      });
      actions.append(edit);
      item.append(copy, actions);
      recipeLineList.append(item);
    }
  } catch (error) {
    setRecipeLineState(error instanceof Error ? error.message : "Could not load recipe ingredients.", true);
  }
}

async function refreshRecipeView() {
  if (!recipeForm || !recipeMenuItemSelect || !recipeNameInput || !recipeDescriptionInput || !recipeInstructionsInput || !recipeYieldInput || !recipeStatusSelect || !saveRecipeButton || !recipeListState || !recipeList) return;
  const scope = activeMenuScope();
  const disabled = !scope;
  recipeMenuItemSelect.disabled = disabled;
  recipeNameInput.disabled = disabled;
  recipeDescriptionInput.disabled = disabled;
  recipeInstructionsInput.disabled = disabled;
  recipeYieldInput.disabled = disabled;
  recipeStatusSelect.disabled = disabled;
  saveRecipeButton.disabled = disabled;
  if (cancelRecipeEditButton) cancelRecipeEditButton.disabled = disabled;
  recipeList.replaceChildren();
  if (!scope) {
    recipeListState.textContent = activeSession ? "Create or load this account's Business Profile first." : "Save a Business Profile first to manage recipes.";
    setRecipeOptionsWithoutScope();
    setRecipeState("Recipes are stored locally and are not synced to the cloud.");
    await refreshRecipeLines(null, [], []);
    return;
  }
  try {
    const [menuItems, ingredients, recipes] = await Promise.all([
      listMenuItems(scope), listIngredients(scope), listRecipes(scope),
    ]);
    setSelectOptions(recipeMenuItemSelect, menuItems.map((item) => ({
      value: item.id, label: item.name + (item.status === "archived" ? " · Archived" : ""),
    })), "Choose a menu item", recipeMenuItemSelect.value);
    recipeListState.textContent = recipes.length ? recipes.length + (recipes.length === 1 ? " recipe in this business." : " recipes in this business.") : "No recipes yet. Create a draft for a menu item.";
    if (!editingRecipeId && !recipeMenuItemSelect.value && menuItems.some((item) => item.status === "active")) {
      recipeMenuItemSelect.value = menuItems.find((item) => item.status === "active").id;
    }
    for (const recipe of recipes) {
      const item = document.createElement("li");
      item.className = "ingredient-list-item";
      const copy = document.createElement("div");
      copy.className = "ingredient-item-copy";
      const name = document.createElement("strong");
      name.textContent = recipe.name;
      const menuItem = menuItems.find((entry) => entry.id === recipe.menuItemId);
      const detail = document.createElement("p");
      detail.textContent = (menuItem?.name ?? "Unknown menu item") + (recipe.yieldPortions ? " · Yield " + recipe.yieldPortions + " portions" : "");
      const status = document.createElement("span");
      status.className = "ingredient-item-status" + (recipe.status === "archived" ? " is-archived" : "");
      status.textContent = recipe.status === "active" ? "Active" : recipe.status === "archived" ? "Archived" : "Draft";
      copy.append(name, detail, status);
      const actions = document.createElement("div");
      actions.className = "ingredient-item-actions";
      const addAction = (label, action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button-secondary";
        button.textContent = label;
        button.addEventListener("click", async () => {
          try {
            if (action === "edit") {
              editingRecipeId = recipe.id;
              selectedRecipeId = recipe.id;
              recipeMenuItemSelect.value = recipe.menuItemId;
              recipeNameInput.value = recipe.name;
              recipeDescriptionInput.value = recipe.description ?? "";
              recipeInstructionsInput.value = recipe.instructions ?? "";
              recipeYieldInput.value = recipe.yieldPortions === undefined ? "" : String(recipe.yieldPortions);
              recipeStatusSelect.value = recipe.status === "active" ? "active" : "draft";
              saveRecipeButton.textContent = "Save recipe changes";
              if (cancelRecipeEditButton) cancelRecipeEditButton.hidden = false;
              await refreshRecipeView();
              setRecipeState("Editing " + recipe.name + ". Existing ingredient lines are preserved.");
              recipeNameInput.focus();
              return;
            }
            const nextStatus = action === "archive" ? "archived" : action === "activate" ? "active" : "draft";
            await setRecipeStatus(scope, recipe.id, nextStatus);
            selectedRecipeId = recipe.id;
            await refreshRecipeView();
            setRecipeState(nextStatus === "archived" ? "Recipe archived. Its ingredient lines were preserved." : nextStatus === "active" ? "Recipe activated." : "Recipe returned to draft.");
          } catch (error) {
            setRecipeState(error instanceof Error ? error.message : "Could not update recipe.", true);
          }
        });
        return button;
      };
      actions.append(addAction("Edit", "edit"));
      if (recipe.status === "archived") actions.append(addAction("Restore as draft", "draft"));
      else {
        if (recipe.status === "draft") actions.append(addAction("Activate", "activate"));
        else actions.append(addAction("Return to draft", "draft"));
        actions.append(addAction("Archive", "archive"));
      }
      item.append(copy, actions);
      recipeList.append(item);
    }
    await refreshRecipeLines(scope, recipes, ingredients);
    if (!editingRecipeId) setRecipeState(activeSession?.user?.id ? "Recipes loaded. Account sync status is shown above." : "Saved on this device only. Sign in to sync recipes.");
  } catch (error) {
    recipeListState.textContent = "Recipes could not be loaded.";
    setRecipeState(error instanceof Error ? error.message : "Recipe storage is unavailable.", true);
    await refreshRecipeLines(scope, [], []);
  }
}

function setRecipeOptionsWithoutScope() {
  if (recipeMenuItemSelect) setSelectOptions(recipeMenuItemSelect, [], "Choose a menu item", "");
}

/** A signed-in workspace never falls back to another local identity's catalog. */
function activeIngredientScope() {
  if (activeSession?.user?.id) {
    if (!currentOwnerProfile?.id) return null;
    return scopeForBusinessProfile({ ownerId: activeSession.user.id, profileId: currentOwnerProfile.id });
  }
  if (!currentProfile?.id) return null;
  return scopeForBusinessProfile({ profileId: currentProfile.id, local: true });
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
            await refreshRecipeView();
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
    if (!editingIngredientId) setIngredientState(activeSession?.user?.id ? "Ingredients loaded. Account sync status is shown above." : "Saved on this device only. Sign in to sync ingredients.");
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

function setPhase2SyncState(message, isError = false) {
  if (!phase2SyncState) return;
  phase2SyncState.textContent = message;
  phase2SyncState.classList.toggle("is-error", isError);
}

function summarizeEntitySnapshot(entityType, snapshot) {
  if (!snapshot) return "No snapshot available";
  if (snapshot.name) return snapshot.name;
  if (entityType === "recipeLine") return "Recipe " + snapshot.recipeId + " · ingredient " + snapshot.ingredientId + " · " + snapshot.quantity + " " + snapshot.unit;
  return snapshot.id ?? "Saved entity";
}

async function refreshPhase2ConflictView() {
  if (!phase2ConflictList) return;
  if (!activeSession?.user?.id || !currentOwnerProfile?.id) {
    phase2ConflictList.hidden = true;
    phase2ConflictList.replaceChildren();
    return;
  }
  const scope = scopeForBusinessProfile({ ownerId: activeSession.user.id, profileId: currentOwnerProfile.id });
  const conflicts = (await phase2SyncStore.listConflicts(scope.ownerId, scope.businessId))
    .filter(item => item.state === "unresolved" || item.state === "resolution_pending")
    .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
  phase2ConflictList.replaceChildren();
  phase2ConflictList.hidden = conflicts.length === 0;
  for (const conflict of conflicts) {
    const card = document.createElement("article");
    card.className = "phase2-conflict-card";
    const heading = document.createElement("h3");
    heading.textContent = conflict.entityType + " conflict · " + conflict.recordId;
    const base = document.createElement("p");
    base.textContent = "Base (revision " + (conflict.baseRevision ?? "new") + "): " + summarizeEntitySnapshot(conflict.entityType, conflict.baseSnapshot);
    const local = document.createElement("p");
    local.textContent = "Your version: " + summarizeEntitySnapshot(conflict.entityType, conflict.localSnapshot);
    const remote = document.createElement("p");
    remote.textContent = "Remote version (revision " + conflict.remoteRevision + "): " + summarizeEntitySnapshot(conflict.entityType, conflict.remoteSnapshot);
    card.append(heading, base, local, remote);
    if (conflict.state === "resolution_pending") {
      const pending = document.createElement("p");
      pending.className = "profile-state";
      pending.textContent = "Keep-local resolution is queued. It will be marked resolved only after the server confirms it.";
      card.append(pending);
    } else {
      const actions = document.createElement("div");
      actions.className = "conflict-actions";
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "button button-primary";
      keep.textContent = "Keep my version";
      keep.addEventListener("click", async () => {
        keep.disabled = true;
        remoteChoice.disabled = true;
        try {
          await phase2SyncStore.resolveKeepLocal(conflict);
          await refreshPhase2ConflictView();
          await runPhase2EntitySync();
        } catch (error) {
          setPhase2SyncState("Conflict resolution could not be queued. Both versions remain preserved. " + (error instanceof Error ? error.message : ""), true);
          await refreshPhase2ConflictView();
        } finally {
          keep.disabled = false;
          remoteChoice.disabled = false;
        }
      });
      const remoteChoice = document.createElement("button");
      remoteChoice.type = "button";
      remoteChoice.className = "button button-secondary";
      remoteChoice.textContent = "Use remote version";
      remoteChoice.addEventListener("click", async () => {
        keep.disabled = true;
        remoteChoice.disabled = true;
        try {
          const latestRemote = await readRemotePhase2Entity(conflict.entityType, conflict.recordId, activeSession);
          const latestSnapshot = normalizeRemoteEntity(conflict.entityType, latestRemote);
          if (!latestSnapshot || latestSnapshot.revision !== conflict.remoteRevision) {
            await phase2SyncStore.refreshConflictRemote(conflict, latestRemote);
            await refreshPhase2ConflictView();
            setPhase2SyncState("The remote record changed again. The latest snapshot was saved; review the conflict again before choosing.", true);
            return;
          }
          await phase2SyncStore.resolveUseRemote({
            ...conflict,
            remoteSnapshot: { ...latestSnapshot, businessId: conflict.businessId },
            remoteRevision: latestSnapshot.revision,
          });
          await refreshOwnerView();
          setPhase2SyncState("Latest remote version applied by your choice. Conflict history and superseded operations are retained.");
        } catch (error) {
          setPhase2SyncState("Remote version was not applied. Both versions remain preserved. " + (error instanceof Error ? error.message : ""), true);
          await refreshPhase2ConflictView();
        } finally {
          keep.disabled = false;
          remoteChoice.disabled = false;
        }
      });
      actions.append(keep, remoteChoice);
      card.append(actions);
    }
    phase2ConflictList.append(card);
  }
}

async function runPhase2EntitySync(session = activeSession) {
  if (!session?.user?.id || session.user.id !== activeSession?.user?.id) {
    setPhase2SyncState(isSupabaseConfigured() ? "Sign in and load your business profile to sync Phase 2 records." : "Local-only mode: Phase 2 records remain on this device.");
    await refreshPhase2ConflictView();
    return;
  }
  if (!currentOwnerProfile?.id) {
    setPhase2SyncState("Create or load the account's Business Profile before syncing Phase 2 records.");
    await refreshPhase2ConflictView();
    return;
  }
  if (!isSupabaseConfigured()) {
    setPhase2SyncState("Supabase is not configured. Phase 2 records remain safely queued on this device.");
    return;
  }
  if (!navigator.onLine) {
    setPhase2SyncState("Offline. Phase 2 changes remain queued locally and will retry when online.");
    return;
  }
  if (phase2SyncRunning) return;
  phase2SyncRunning = true;
  if (phase2SyncButton) phase2SyncButton.disabled = true;
  try {
    const scope = scopeForBusinessProfile({ ownerId: session.user.id, profileId: currentOwnerProfile.id });
    await phase2SyncStore.recoverInterrupted(scope.ownerId, scope.businessId);
    const summary = await syncPhase2Operations({
      ownerId: scope.ownerId, businessId: scope.businessId, session, store: phase2SyncStore,
      send: (operation, currentSession) => sendPhase2EntityOperation(operation, currentSession),
    });
    await refreshPhase2ConflictView();
    if (summary.pausedForAuth) setPhase2SyncState("Authentication needs attention. Phase 2 operations are preserved and paused.", true);
    else if (summary.conflicts) setPhase2SyncState("A Phase 2 conflict needs review. Both local and remote versions are preserved.", true);
    else if (summary.failed) setPhase2SyncState("A Phase 2 operation was rejected. Local data is preserved; review the operation before retrying.", true);
    else if (summary.retried) setPhase2SyncState("A temporary sync failure occurred. The same operation IDs remain queued for retry.", true);
    else if (summary.synced) setPhase2SyncState("Phase 2 sync acknowledged " + summary.synced + " operation(s).");
    else setPhase2SyncState("Phase 2 sync checked the queue. No due operations were sent.");
  } catch (error) {
    setPhase2SyncState("Phase 2 sync could not complete. Local records and outbox operations remain preserved. " + (error instanceof Error ? error.message : ""), true);
  } finally {
    phase2SyncRunning = false;
    if (phase2SyncButton) phase2SyncButton.disabled = false;
  }
}

function entitySaveMessage() {
  if (!activeSession?.user?.id) return "Changes saved on this device only. Sign in to queue account sync.";
  if (!navigator.onLine) return "Saved locally and queued; sync will resume when online.";
  return "Saved locally and queued for account sync.";
}


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
  await refreshRecipeView();
  await refreshPhase2ConflictView();
}

async function scheduleRetryForOwner(ownerId) {
  const operations = await listOperations(ownerId);
  const dueTimes = operations
    .filter(operation => operation.state === "retryable_error")
    .map(operation => operation.nextAttemptAt ?? Date.now());
  if (currentOwnerProfile?.id) {
    const scope = scopeForBusinessProfile({ ownerId, profileId: currentOwnerProfile.id });
    const entityOperations = await phase2SyncStore.listOperations(scope.ownerId, scope.businessId);
    dueTimes.push(...entityOperations.filter(operation => operation.state === "retryable_error").map(operation => operation.nextAttemptAt ?? Date.now()));
  }
  clearTimeout(retryTimer);
  if (!dueTimes.length) return;
  const delay = Math.max(250, Math.min(5 * 60 * 1000, Math.min(...dueTimes) - Date.now()));
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
    await runPhase2EntitySync(session);
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
    if (currentOwnerProfile || operations.some(operation => ["pending", "retryable_error", "in_flight"].includes(operation.state))) {
      await runSync();
    } else {
      setPhase2SyncState("Create or load this account’s Business Profile before syncing Phase 2 records.");
      await refreshPhase2ConflictView();
    }
    await refreshFinishedStockView(true);
    await refreshProductionView();
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
    await refreshRecipeView();
    await refreshFinishedStockView(false);
    await refreshProductionView();
    await runPhase2EntitySync();
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
      await refreshRecipeView();
      await runSync();
    } else {
      const saved = await saveLocalProfile({ id: currentProfile?.id, name: businessNameInput.value });
      currentProfile = saved.profile;
      businessNameInput.value = saved.profile.name;
      setProfileState("Saved on this device · not synced (local version " + saved.localRevision + ").");
      await refreshIngredientView();
      await refreshMenuView();
      await refreshRecipeView();
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
    await refreshRecipeView();
    setIngredientState(entitySaveMessage());
    if (activeSession) void runSync();
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
      await refreshRecipeView();
    setMenuItemState(entitySaveMessage());
    if (activeSession) void runSync();
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



/** @param {string} message @param {boolean=} isError */
function setProductionState(message, isError = false) {
  if (!productionState) return;
  productionState.textContent = message;
  productionState.classList.toggle("is-error", isError);
}

/** Render local production batches; only a server-confirmed post can complete a batch. */
async function refreshProductionView() {
  if (!productionStartForm || !productionRecipeSelect || !productionStartButton || !productionListState || !productionBatchList) return;
  const scope = activeMenuScope();
  productionBatchList.replaceChildren();
  if (!scope) {
    setSelectOptions(productionRecipeSelect, [], "Choose an active recipe", "");
    productionRecipeSelect.disabled = true;
    productionStartButton.disabled = true;
    productionListState.textContent = activeSession ? "Create or load this account's Business Profile first." : "Save a Business Profile first to start production.";
    setProductionState("Save or load a business profile and activate a recipe to start a batch.");
    return;
  }
  try {
    const [recipes, batches, ingredients, menuItems] = await Promise.all([
      listRecipes(scope), listProductionBatches(scope), listIngredients(scope), listMenuItems(scope),
    ]);
    const activeRecipes = recipes.filter(recipe => recipe.status === "active");
    setSelectOptions(productionRecipeSelect, activeRecipes.map(recipe => ({ value: recipe.id, label: recipe.name })), "Choose an active recipe", productionRecipeSelect.value);
    productionRecipeSelect.disabled = activeRecipes.length === 0;
    productionStartButton.disabled = activeRecipes.length === 0;
    productionListState.textContent = batches.length
      ? batches.length + (batches.length === 1 ? " batch in this business." : " batches in this business.")
      : "No production batches yet. Start one from an active recipe.";
    const ingredientNames = new Map(ingredients.map(item => [item.id, item.name]));
    for (const batch of batches) {
      const item = document.createElement("li");
      item.className = "production-batch-card";
      item.dataset.batchId = batch.batchId;
      const heading = document.createElement("strong");
      heading.textContent = batch.snapshot.recipeName + " · " + batch.state.replaceAll("_", " ");
      const detail = document.createElement("p");
      detail.textContent = "Started " + new Date(batch.startedAt).toLocaleString() + " · " + batch.snapshot.lines.length + " recipe line(s) · " + (batch.output ? "Output " + batch.output.quantity + " " + batch.output.unit : "Output not prepared");
      item.append(heading, detail);
      const note = document.createElement("p");
      note.className = "field-help";
      note.textContent = "Recipe snapshot " + batch.snapshot.snapshotId + " · edits to the recipe do not change this batch.";
      item.append(note);
      if (batch.state === "started") {
        const form = document.createElement("form");
        form.className = "production-usage-form";
        const usageHeading = document.createElement("h4");
        usageHeading.textContent = "Actual ingredient usage";
        form.append(usageHeading);
        for (const line of batch.snapshot.lines) {
          const fieldset = document.createElement("fieldset");
          fieldset.className = "production-usage-line";
          fieldset.dataset.lineId = line.lineId;
          const legend = document.createElement("legend");
          legend.textContent = (ingredientNames.get(line.ingredientId) ?? "Ingredient") + " · " + (line.quantityMode === "to_taste" ? "to taste" : line.quantity + " " + line.unit + (line.quantityMode === "estimated" ? " · estimated target" : ""));
          fieldset.append(legend);
          const dispositionLabel = document.createElement("label");
          dispositionLabel.textContent = "Usage decision";
          const disposition = document.createElement("select");
          disposition.dataset.field = "disposition";
          disposition.required = true;
          for (const [value, label] of [["", "Choose a decision"], ["measured", "Measured actual usage"], ["accepted_estimate", "Accept estimate"], ["not_used", "Not used in this batch"]]) {
            const option = document.createElement("option"); option.value = value; option.textContent = label; disposition.append(option);
          }
          dispositionLabel.append(disposition);
          const quantityLabel = document.createElement("label");
          quantityLabel.textContent = "Actual quantity (" + line.unit + ")";
          const quantity = document.createElement("input");
          quantity.type = "number"; quantity.min = "0.000001"; quantity.step = "any"; quantity.inputMode = "decimal";
          quantity.dataset.field = "quantity"; quantity.value = line.quantity ?? "";
          quantity.required = true;
          quantityLabel.append(quantity);
          const noteLabel = document.createElement("label");
          noteLabel.textContent = "Operator note / reason";
          const noteInput = document.createElement("input");
          noteInput.type = "text"; noteInput.maxLength = 1000; noteInput.dataset.field = "note";
          noteInput.placeholder = "Required for estimates or unused ingredients";
          noteLabel.append(noteInput);
          const varianceLabel = document.createElement("label");
          varianceLabel.textContent = "Variance reason (if actual differs from exact target)";
          const variance = document.createElement("input");
          variance.type = "text"; variance.maxLength = 1000; variance.dataset.field = "varianceReason";
          varianceLabel.append(variance);
          const updateFields = () => {
            const unused = disposition.value === "not_used";
            quantity.disabled = unused;
            quantity.required = !unused;
            quantityLabel.hidden = unused;
            noteInput.required = disposition.value === "accepted_estimate" || unused;
            if (disposition.value === "not_used") quantity.value = "";
            else if (!quantity.value && line.quantity) quantity.value = line.quantity;
          };
          disposition.addEventListener("change", updateFields);
          updateFields();
          fieldset.append(dispositionLabel, quantityLabel, noteLabel, varianceLabel);
          form.append(fieldset);
        }
        const outputHeading = document.createElement("h4");
        outputHeading.textContent = "Finished output";
        const outputQuantityLabel = document.createElement("label");
        outputQuantityLabel.textContent = "Actual output quantity";
        const outputQuantity = document.createElement("input");
        outputQuantity.type = "number"; outputQuantity.min = "1"; outputQuantity.step = "1"; outputQuantity.required = true;
        outputQuantity.dataset.field = "outputQuantity"; outputQuantity.value = String(batch.snapshot.yieldPortions ?? "");
        outputQuantityLabel.append(outputQuantity);
        const outputUnitLabel = document.createElement("label");
        outputUnitLabel.textContent = "Output unit";
        const outputUnit = document.createElement("select");
        outputUnit.dataset.field = "outputUnit";
        for (const unit of ["each", "g", "kg", "ml", "l"]) {
          const option = document.createElement("option"); option.value = unit; option.textContent = unit; outputUnit.append(option);
        }
        outputUnit.value = "each";
        outputUnit.addEventListener("change", () => { outputQuantity.step = outputUnit.value === "each" ? "1" : "any"; outputQuantity.min = outputUnit.value === "each" ? "1" : "0.000001"; });
        outputUnitLabel.append(outputUnit);
        form.append(outputHeading, outputQuantityLabel, outputUnitLabel);
        const submit = document.createElement("button");
        submit.type = "submit"; submit.className = "button button-primary"; submit.textContent = "Save usage and prepare batch";
        const cancelReason = document.createElement("input");
        cancelReason.type = "text"; cancelReason.maxLength = 1000; cancelReason.placeholder = "Cancellation reason (if cancelling)";
        cancelReason.setAttribute("aria-label", "Cancellation reason");
        const cancel = document.createElement("button");
        cancel.type = "button"; cancel.className = "button button-secondary"; cancel.textContent = "Cancel batch";
        cancel.addEventListener("click", async () => {
          if (!cancelReason.value.trim()) { setProductionState("Enter a cancellation reason before cancelling a batch.", true); cancelReason.focus(); return; }
          try { await cancelProductionBatch(scope, batch.batchId, cancelReason.value); await refreshProductionView(); setProductionState("Batch cancelled. Its recipe snapshot and event history are preserved."); }
          catch (error) { setProductionState(error instanceof Error ? error.message : "Could not cancel batch.", true); }
        });
        form.append(submit, cancelReason, cancel);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          submit.disabled = true;
          try {
            const entries = /** @type {HTMLFieldSetElement[]} */ ([...form.querySelectorAll("fieldset[data-line-id]")]).map(fieldset => {
              const get = field => /** @type {HTMLInputElement | HTMLSelectElement} */ (fieldset.querySelector('[data-field="' + field + '"]'));
              const disposition = get("disposition").value;
              return {
                lineId: fieldset.dataset.lineId,
                disposition,
                ...(disposition !== "not_used" ? { quantity: get("quantity").value, unit: batch.snapshot.lines.find(line => line.lineId === fieldset.dataset.lineId).unit } : {}),
                ...(get("note").value.trim() ? { note: get("note").value.trim() } : {}),
                ...(get("varianceReason").value.trim() ? { varianceReason: get("varianceReason").value.trim() } : {}),
              };
            });
            await recordProductionBatchActualUsage(scope, batch.batchId, entries);
            const prepared = await prepareProductionBatchForPosting(scope, batch.batchId, {
              productId: batch.snapshot.menuItemId, quantity: outputQuantity.value, unit: outputUnit.value,
            });
            if (activeSession && navigator.onLine && currentOwnerProfile?.businessId) {
              await postProductionBatch(scope, batch.batchId, activeSession, currentOwnerProfile.businessId);
              setProductionState("Production batch posted. Refresh finished stock to review its new lot.");
            } else {
              setProductionState("Actual usage saved. Batch is ready to post when you are online and signed in; no inventory has changed yet.");
            }
            await refreshProductionView();
            if (prepared && prepared.state === "ready_to_post") setFinishedStockMessage(finishedStockState, "Refresh stock after the production batch is posted.");
          } catch (error) {
            setProductionState(error instanceof Error ? error.message : "Could not prepare production batch.", true);
            await refreshProductionView();
          } finally { submit.disabled = false; }
        });
        item.append(form);
      } else if (batch.state === "ready_to_post" || batch.state === "failed_to_post") {
        const status = document.createElement("p");
        status.className = "field-help";
        status.textContent = batch.state === "failed_to_post" ? "Posting failed. Retry will reuse the same command ID and payload." : "Ready to post. Inventory remains unchanged until the server accepts the command.";
        item.append(status);
        const post = document.createElement("button");
        post.type = "button"; post.className = "button button-primary";
        post.textContent = batch.state === "failed_to_post" ? "Retry posting" : "Post batch";
        post.disabled = !activeSession || !navigator.onLine || !currentOwnerProfile?.businessId;
        post.addEventListener("click", async () => {
          post.disabled = true;
          try {
            await postProductionBatch(scope, batch.batchId, activeSession, currentOwnerProfile.businessId);
            setProductionState("Production batch posted. Refresh finished stock to review its new lot.");
          } catch (error) {
            setProductionState("Batch remains recoverable; posting can be retried. " + (error instanceof Error ? error.message : ""), true);
          } finally { await refreshProductionView(); }
        });
        item.append(post);
      } else if (batch.state === "completed") {
        const status = document.createElement("p");
        status.className = "field-help";
        status.textContent = "Server confirmed posting. Finished stock is derived from the posted ledger.";
        item.append(status);
      } else if (batch.state === "cancelled") {
        const status = document.createElement("p");
        status.className = "field-help";
        status.textContent = "Cancelled: " + (batch.cancellationReason ?? "No reason recorded.");
        item.append(status);
      }
      productionBatchList.append(item);
    }
    if (productionState?.textContent?.includes("Save or load a business profile")) {
      setProductionState(activeRecipes.length ? "Starting a batch saves a recipe snapshot; stock changes only after server confirmation." : "Activate a recipe with at least one ingredient line before starting production.");
    }
  } catch (error) {
    productionListState.textContent = "Production batches could not be loaded.";
    setProductionState(error instanceof Error ? error.message : "Production workspace is unavailable.", true);
  }
}

productionStartForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const scope = activeMenuScope();
  if (!scope || !productionRecipeSelect?.value) { setProductionState("Choose an active recipe first.", true); return; }
  if (productionStartButton) productionStartButton.disabled = true;
  try {
    const batch = await startProductionBatch(scope, productionRecipeSelect.value);
    await refreshProductionView();
    setProductionState("Batch started with an immutable recipe snapshot. Record actual usage before preparing output.");
    productionBatchList?.querySelector('[data-batch-id="' + batch.batchId + '"]')?.scrollIntoView({ block: "nearest" });
  } catch (error) {
    setProductionState(error instanceof Error ? error.message : "Could not start production batch.", true);
  } finally {
    if (productionStartButton) productionStartButton.disabled = false;
  }
  await refreshProductionView();
});

recipeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const scope = activeMenuScope();
  if (!scope || !recipeMenuItemSelect || !recipeNameInput || !recipeDescriptionInput || !recipeInstructionsInput || !recipeYieldInput || !recipeStatusSelect || !saveRecipeButton) {
    setRecipeState("Save or load a Business Profile and menu item first.", true);
    return;
  }
  saveRecipeButton.disabled = true;
  if (cancelRecipeEditButton) cancelRecipeEditButton.disabled = true;
  try {
    const yieldText = recipeYieldInput.value.trim();
    const saved = await saveRecipe(scope, {
      ...(editingRecipeId ? { id: editingRecipeId } : {}),
      menuItemId: recipeMenuItemSelect.value,
      name: recipeNameInput.value,
      description: recipeDescriptionInput.value,
      instructions: recipeInstructionsInput.value,
      ...(yieldText ? { yieldPortions: Number(yieldText) } : {}),
      status: recipeStatusSelect.value,
    });
    selectedRecipeId = saved.id;
    resetRecipeForm();
    await refreshRecipeView();
    await refreshProductionView();
    setRecipeState(entitySaveMessage());
    if (activeSession) void runSync();
  } catch (error) {
    setRecipeState(error instanceof Error ? error.message : "Could not save recipe.", true);
  } finally {
    saveRecipeButton.disabled = !activeMenuScope();
    if (cancelRecipeEditButton) cancelRecipeEditButton.disabled = false;
  }
});

cancelRecipeEditButton?.addEventListener("click", () => {
  resetRecipeForm();
  setRecipeState("Recipe edit cancelled. No changes were made.");
});

recipeLineForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const scope = activeMenuScope();
  if (!scope || !recipeLineRecipeSelect || !recipeLineIngredientSelect || !recipeLineQuantityInput || !recipeLineUnitSelect || !recipeLinePositionInput || !saveRecipeLineButton) {
    setRecipeLineState("Save or load a Business Profile and recipe first.", true);
    return;
  }
  saveRecipeLineButton.disabled = true;
  if (cancelRecipeLineEditButton) cancelRecipeLineEditButton.disabled = true;
  try {
    const saved = await saveRecipeLine(scope, {
      ...(editingRecipeLineId ? { id: editingRecipeLineId } : {}),
      recipeId: recipeLineRecipeSelect.value,
      ingredientId: recipeLineIngredientSelect.value,
      quantity: Number(recipeLineQuantityInput.value),
      unit: recipeLineUnitSelect.value,
      position: Number(recipeLinePositionInput.value),
      note: recipeLineNoteInput?.value ?? "",
    });
    selectedRecipeId = saved.recipeId;
    resetRecipeLineForm();
    await refreshRecipeView();
    setRecipeLineState(entitySaveMessage());
    if (activeSession) void runSync();
  } catch (error) {
    setRecipeLineState(error instanceof Error ? error.message : "Could not save ingredient line.", true);
  } finally {
    saveRecipeLineButton.disabled = !activeMenuScope() || !recipeLineRecipeSelect.value;
    if (cancelRecipeLineEditButton) cancelRecipeLineEditButton.disabled = false;
  }
});

cancelRecipeLineEditButton?.addEventListener("click", () => {
  resetRecipeLineForm();
  setRecipeLineState("Ingredient line edit cancelled. No changes were made.");
});

recipeLineRecipeSelect?.addEventListener("change", async () => {
  selectedRecipeId = recipeLineRecipeSelect.value;
  resetRecipeLineForm();
  await refreshRecipeView();
});

adoptLocalButton?.addEventListener("click", async () => {
  if (!activeSession || !currentProfile) return;
  adoptLocalButton.disabled = true;
  try {
    const saved = await saveOwnerProfileDraft({ ownerId: activeSession.user.id, name: currentProfile.name });
    currentOwnerProfile = saved.profile;
    await refreshIngredientView();
    await refreshMenuView();
      await refreshRecipeView();
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
window.addEventListener("online", () => { if (activeSession) void runSync(); else void runPhase2EntitySync(); });
window.addEventListener("offline", () => { setPhase2SyncState("Offline. Phase 2 changes remain queued locally and will retry when online."); });
phase2SyncButton?.addEventListener("click", () => { if (activeSession) void runSync(); else void runPhase2EntitySync(); });


const finishedStockState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#finished-stock-state"));
const finishedStockRefreshButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#finished-stock-refresh"));
const finishedStockList = /** @type {HTMLUListElement | null} */ (document.querySelector("#finished-stock-list"));
const finishedDispositionForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#finished-disposition-form"));
const finishedDispositionType = /** @type {HTMLSelectElement | null} */ (document.querySelector("#finished-disposition-type"));
const finishedDispositionLot = /** @type {HTMLSelectElement | null} */ (document.querySelector("#finished-disposition-lot"));
const finishedDispositionQuantity = /** @type {HTMLInputElement | null} */ (document.querySelector("#finished-disposition-quantity"));
const finishedDispositionReason = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#finished-disposition-reason"));
const finishedDispositionUnit = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#finished-disposition-unit"));
const finishedDispositionSubmit = /** @type {HTMLButtonElement | null} */ (document.querySelector("#finished-disposition-submit"));
const finishedDispositionState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#finished-disposition-state"));
const finishedDispositionList = /** @type {HTMLUListElement | null} */ (document.querySelector("#finished-disposition-list"));
const carryForwardForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#carry-forward-form"));
const carryForwardLot = /** @type {HTMLSelectElement | null} */ (document.querySelector("#carry-forward-lot"));
const carryForwardDate = /** @type {HTMLInputElement | null} */ (document.querySelector("#carry-forward-date"));
const carryForwardSafe = /** @type {HTMLInputElement | null} */ (document.querySelector("#carry-forward-safe"));
const carryForwardReason = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("#carry-forward-reason"));
const carryForwardSubmit = /** @type {HTMLButtonElement | null} */ (document.querySelector("#carry-forward-submit"));
const carryForwardState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#carry-forward-state"));
const carryForwardList = /** @type {HTMLUListElement | null} */ (document.querySelector("#carry-forward-list"));
let currentFinishedSnapshot = null;
/** @type {readonly any[]} */
let currentFinishedBalances = [];
let currentFinishedMenuNames = new Map();

function setFinishedStockMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}

function finishedLotLabel(lot, menuNames) {
  const name = menuNames.get(lot.menuItemId) ?? "Finished menu item";
  const date = lot.producedAt ? new Date(lot.producedAt).toLocaleString() : "production time unavailable";
  return name + " · " + lot.remainingQuantity + " " + lot.unit + " remaining · " + date;
}

function appendFinishedHistoryItem(list, titleText, detailText, stateText, actionLabel, action) {
  if (!list) return;
  const item = document.createElement("li");
  item.className = "finished-stock-card";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = titleText;
  const detail = document.createElement("p");
  detail.textContent = detailText;
  const state = document.createElement("p");
  state.textContent = stateText;
  copy.append(title, detail, state);
  item.append(copy);
  if (actionLabel && action) {
    const actions = document.createElement("div");
    actions.className = "finished-stock-card-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-secondary";
    button.textContent = actionLabel;
    button.addEventListener("click", action);
    actions.append(button);
    item.append(actions);
  }
  list.append(item);
}

function renderFinishedStockLists() {
  if (!currentFinishedSnapshot) {
    finishedStockList?.replaceChildren();
    if (finishedDispositionLot) setSelectOptions(finishedDispositionLot, [], "Load a stock snapshot first", "");
    if (carryForwardLot) setSelectOptions(carryForwardLot, [], "Load a stock snapshot first", "");
    if (finishedDispositionSubmit) finishedDispositionSubmit.disabled = true;
    if (carryForwardSubmit) carryForwardSubmit.disabled = true;
    return;
  }
  const usable = currentFinishedBalances.filter(lot => Number(lot.remainingQuantity) > 0);
  const options = usable.map(lot => ({ value: lot.lotId, label: finishedLotLabel(lot, currentFinishedMenuNames) }));
  if (finishedDispositionLot) setSelectOptions(finishedDispositionLot, options, options.length ? "Choose a finished lot" : "No remaining finished stock", finishedDispositionLot.value);
  if (carryForwardLot) setSelectOptions(carryForwardLot, options, options.length ? "Choose a lot to carry forward" : "No remaining finished stock", carryForwardLot.value);
  const canRecord = Boolean(activeSession?.user?.id && currentOwnerProfile?.syncState === "synced" && currentFinishedSnapshot.remoteBusinessId);
  if (finishedDispositionSubmit) finishedDispositionSubmit.disabled = !canRecord || !usable.length;
  if (carryForwardSubmit) carryForwardSubmit.disabled = !canRecord || !usable.length;
  if (finishedStockList) {
    finishedStockList.replaceChildren();
    if (!currentFinishedBalances.length) {
      const empty = document.createElement("li");
      empty.className = "finished-stock-card";
      empty.textContent = "No production lots found for this business yet.";
      finishedStockList.append(empty);
    }
    for (const lot of currentFinishedBalances) {
      const item = document.createElement("li");
      item.className = "finished-stock-card";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = currentFinishedMenuNames.get(lot.menuItemId) ?? "Finished menu item";
      const detail = document.createElement("p");
      detail.textContent = "Produced " + lot.producedQuantity + " " + lot.unit + " · Allocated " + lot.allocatedQuantity + " " + lot.unit + " · Remaining " + lot.remainingQuantity + " " + lot.unit;
      const date = document.createElement("p");
      date.textContent = lot.producedAt ? "Produced " + new Date(lot.producedAt).toLocaleString() : "Production time unavailable";
      copy.append(title, detail, date);
      const actions = document.createElement("div");
      actions.className = "finished-stock-card-actions";
      const use = document.createElement("button");
      use.type = "button"; use.className = "button button-secondary"; use.textContent = "Record disposition";
      use.disabled = Number(lot.remainingQuantity) <= 0;
      use.addEventListener("click", () => {
        if (finishedDispositionLot) finishedDispositionLot.value = lot.lotId;
        if (finishedDispositionQuantity) finishedDispositionQuantity.value = lot.remainingQuantity;
        updateFinishedDispositionUnit();
        finishedDispositionForm?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      const carry = document.createElement("button");
      carry.type = "button"; carry.className = "button button-secondary"; carry.textContent = "Carry forward";
      carry.disabled = Number(lot.remainingQuantity) <= 0;
      carry.addEventListener("click", () => {
        if (carryForwardLot) carryForwardLot.value = lot.lotId;
        carryForwardForm?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      actions.append(use, carry);
      item.append(copy, actions);
      finishedStockList.append(item);
    }
  }
  void renderFinishedStockHistory();
  updateFinishedDispositionUnit();
}

function updateFinishedDispositionUnit() {
  const lot = currentFinishedBalances.find(item => item.lotId === finishedDispositionLot?.value);
  if (finishedDispositionUnit) finishedDispositionUnit.textContent = lot
    ? "Unit: " + lot.unit + " · Remaining: " + lot.remainingQuantity + " " + lot.unit
    : "Select a lot to see its unit and remaining quantity.";
  if (lot && finishedDispositionQuantity && (!finishedDispositionQuantity.value || Number(finishedDispositionQuantity.value) > Number(lot.remainingQuantity))) {
    finishedDispositionQuantity.value = lot.remainingQuantity;
  }
}

async function renderFinishedStockHistory() {
  const scope = activeMenuScope();
  if (!scope) {
    finishedDispositionList?.replaceChildren();
    carryForwardList?.replaceChildren();
    return;
  }
  const [dispositions, carryEvents] = await Promise.all([
    listFinishedDispositions(scope).catch(() => []),
    listCarryForwardDecisions(scope).catch(() => []),
  ]);
  if (finishedDispositionList) {
    finishedDispositionList.replaceChildren();
    if (!dispositions.length) {
      const empty = document.createElement("li"); empty.className = "finished-stock-card"; empty.textContent = "No local disposition records yet."; finishedDispositionList.append(empty);
    }
    for (const record of dispositions) {
      const title = record.dispositionType.replaceAll("_", " ");
      const detail = record.quantity + " " + record.unit + (record.reason ? " · " + record.reason : "") + " · " + new Date(record.createdAt).toLocaleString();
      const action = record.state === "synced" || !activeSession ? null : () => void retryFinishedDisposition(record.commandId);
      appendFinishedHistoryItem(finishedDispositionList, title, detail, "Sync: " + record.state + (record.lastError ? " · " + record.lastError : ""), action ? "Retry sync" : "", action);
    }
  }
  if (carryForwardList) {
    carryForwardList.replaceChildren();
    if (!carryEvents.length) {
      const empty = document.createElement("li"); empty.className = "finished-stock-card"; empty.textContent = "No carry-forward decisions yet."; carryForwardList.append(empty);
    }
    for (const record of carryEvents) {
      const detail = record.quantity + " " + record.unit + " · carry-forward date " + record.carryForwardDate + " · " + new Date(record.confirmedAt).toLocaleString();
      const action = record.state === "synced" || !activeSession ? null : () => void retryCarryForward(record.eventId);
      appendFinishedHistoryItem(carryForwardList, "Carry-forward suitability confirmed", detail, "Sync: " + (record.state ?? record.syncState ?? "pending_sync") + (record.lastError ? " · " + record.lastError : ""), action ? "Retry sync" : "", action);
    }
  }
}

async function refreshFinishedStockView(refreshRemote = true) {
  const scope = activeMenuScope();
  if (!scope) {
    currentFinishedSnapshot = null;
    currentFinishedBalances = [];
    renderFinishedStockLists();
    setFinishedStockMessage(finishedStockState, "Create or load a business profile to use finished stock.");
    return;
  }
  let message = "";
  let isError = false;
  if (refreshRemote && activeSession && navigator.onLine && currentOwnerProfile?.syncState === "synced" && currentOwnerProfile.businessId) {
    try {
      currentFinishedSnapshot = await refreshFinishedStock(scope, currentOwnerProfile.businessId, activeSession);
      message = "Stock refreshed from the server · " + new Date(currentFinishedSnapshot.fetchedAt).toLocaleString() + ".";
    } catch (error) {
      currentFinishedSnapshot = await getFinishedStockSnapshot(scope).catch(() => null);
      message = "Could not refresh stock. " + (currentFinishedSnapshot ? "Showing the last saved snapshot. " : "") + (error instanceof Error ? error.message : "Network or server error.");
      isError = true;
    }
  } else {
    currentFinishedSnapshot = await getFinishedStockSnapshot(scope).catch(() => null);
    message = currentFinishedSnapshot
      ? (navigator.onLine ? "Showing the last saved stock snapshot · " : "Offline · showing the last saved stock snapshot · ") + new Date(currentFinishedSnapshot.fetchedAt).toLocaleString() + "."
      : activeSession ? "No finished-stock snapshot is cached yet. Connect to refresh stock." : "Sign in and sync the business profile to load server-authoritative finished stock.";
  }
  const menuItems = await listMenuItems(scope).catch(() => []);
  currentFinishedMenuNames = new Map(menuItems.map(item => [item.id, item.name]));
  currentFinishedBalances = currentFinishedSnapshot
    ? projectFinishedLotBalances(currentFinishedSnapshot.lots, currentFinishedSnapshot.allocations)
    : [];
  renderFinishedStockLists();
  setFinishedStockMessage(finishedStockState, message, isError);
}

async function retryFinishedDisposition(commandId) {
  const scope = activeMenuScope();
  if (!scope || !activeSession) return;
  try {
    await syncFinishedDisposition(scope, commandId, activeSession);
    setFinishedStockMessage(finishedDispositionState, "Disposition synced. Refreshing authoritative stock.");
    await refreshFinishedStockView(true);
  } catch (error) {
    setFinishedStockMessage(finishedDispositionState, "The local record is preserved; sync can be retried. " + (error instanceof Error ? error.message : ""), true);
    await renderFinishedStockHistory();
  }
}

async function retryCarryForward(eventId) {
  const scope = activeMenuScope();
  if (!scope || !activeSession) return;
  try {
    await syncCarryForwardDecision(scope, eventId, activeSession);
    setFinishedStockMessage(carryForwardState, "Carry-forward decision synced. Inventory quantity is unchanged.");
    await renderFinishedStockHistory();
  } catch (error) {
    setFinishedStockMessage(carryForwardState, "The local decision is preserved; sync can be retried. " + (error instanceof Error ? error.message : ""), true);
    await renderFinishedStockHistory();
  }
}

finishedStockRefreshButton?.addEventListener("click", () => { void refreshFinishedStockView(true); });
finishedDispositionLot?.addEventListener("change", updateFinishedDispositionUnit);
finishedDispositionType?.addEventListener("change", () => {
  if (finishedDispositionReason) finishedDispositionReason.required = ["discounted_sale", "waste"].includes(finishedDispositionType.value);
});
finishedDispositionForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const scope = activeMenuScope();
  const snapshot = currentFinishedSnapshot;
  const lot = currentFinishedBalances.find(item => item.lotId === finishedDispositionLot?.value);
  if (!scope || !activeSession || !snapshot?.remoteBusinessId || !lot || !finishedDispositionType || !finishedDispositionQuantity) {
    setFinishedStockMessage(finishedDispositionState, "Load a synced stock snapshot and select a finished lot first.", true);
    return;
  }
  if (finishedDispositionSubmit) finishedDispositionSubmit.disabled = true;
  try {
    const dispositionType = finishedDispositionType.value;
    const quantity = finishedDispositionQuantity.value.trim();
    const saleId = ["sale", "discounted_sale"].includes(dispositionType) ? crypto.randomUUID() : undefined;
    const command = buildFinishedDispositionCommand({
      businessId: snapshot.remoteBusinessId,
      dispositionId: crypto.randomUUID(),
      dispositionType,
      quantity,
      unit: lot.unit,
      allocations: [{ lotId: lot.lotId, quantity, unit: lot.unit }],
      lots: snapshot.lots,
      priorAllocations: snapshot.allocations,
      ...(saleId ? { saleId } : {}),
      ...(finishedDispositionReason?.value.trim() ? { reason: finishedDispositionReason.value.trim() } : {}),
    });
    const saved = await saveFinishedDisposition(scope, command, {
      dispositionType, quantity, unit: lot.unit,
      ...(saleId ? { saleId } : {}),
      ...(finishedDispositionReason?.value.trim() ? { reason: finishedDispositionReason.value.trim() } : {}),
    });
    if (navigator.onLine) {
      try {
        await syncFinishedDisposition(scope, saved.commandId, activeSession);
        setFinishedStockMessage(finishedDispositionState, "Stock disposition synced. Refreshing the server-authoritative balance.");
        await refreshFinishedStockView(true);
      } catch (error) {
        setFinishedStockMessage(finishedDispositionState, "Saved on this device; server sync is pending. " + (error instanceof Error ? error.message : ""), true);
      }
    } else {
      setFinishedStockMessage(finishedDispositionState, "Saved on this device while offline. It will remain queued until you retry sync.");
    }
    if (finishedDispositionReason) finishedDispositionReason.value = "";
    await renderFinishedStockHistory();
  } catch (error) {
    setFinishedStockMessage(finishedDispositionState, error instanceof Error ? error.message : "Could not save this disposition.", true);
  } finally {
    if (finishedDispositionSubmit) finishedDispositionSubmit.disabled = false;
    renderFinishedStockLists();
  }
});

carryForwardForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const scope = activeMenuScope();
  const snapshot = currentFinishedSnapshot;
  const lot = currentFinishedBalances.find(item => item.lotId === carryForwardLot?.value);
  if (!scope || !activeSession || !snapshot?.remoteBusinessId || !lot || !carryForwardDate || !carryForwardSafe?.checked) {
    setFinishedStockMessage(carryForwardState, "Choose a lot, date, and explicitly confirm that the food is safe and suitable to keep.", true);
    return;
  }
  if (carryForwardSubmit) carryForwardSubmit.disabled = true;
  try {
    const decision = buildCarryForwardDecision({
      businessId: snapshot.remoteBusinessId,
      lotId: lot.lotId,
      remainingQuantity: lot.remainingQuantity,
      unit: lot.unit,
      suitable: true,
      confirmedAt: new Date().toISOString(),
      carryForwardDate: carryForwardDate.value,
      ...(carryForwardReason?.value.trim() ? { reason: carryForwardReason.value.trim() } : {}),
      lots: snapshot.lots,
      priorAllocations: snapshot.allocations,
    });
    const saved = await saveCarryForwardDecision(scope, decision);
    if (navigator.onLine) {
      try {
        await syncCarryForwardDecision(scope, saved.eventId, activeSession);
        setFinishedStockMessage(carryForwardState, "Carry-forward decision synced. Stock quantity remains unchanged.");
      } catch (error) {
        setFinishedStockMessage(carryForwardState, "Decision saved locally; cloud sync is pending. " + (error instanceof Error ? error.message : ""), true);
      }
    } else {
      setFinishedStockMessage(carryForwardState, "Decision saved locally while offline; sync can be retried later.");
    }
    if (carryForwardSafe) carryForwardSafe.checked = false;
    if (carryForwardReason) carryForwardReason.value = "";
    await renderFinishedStockHistory();
  } catch (error) {
    setFinishedStockMessage(carryForwardState, error instanceof Error ? error.message : "Could not record carry-forward.", true);
  } finally {
    if (carryForwardSubmit) carryForwardSubmit.disabled = false;
    renderFinishedStockLists();
  }
});

window.addEventListener("online", () => { void refreshFinishedStockView(true); });
window.addEventListener("offline", () => {
  if (currentFinishedSnapshot) setFinishedStockMessage(finishedStockState, "Offline · using the last saved snapshot. New changes remain on this device until synced.");
});
if (carryForwardDate && !carryForwardDate.value) carryForwardDate.value = new Date().toISOString().slice(0, 10);

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
