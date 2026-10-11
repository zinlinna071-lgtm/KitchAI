import { readLocalProfile, saveLocalProfile } from "./local-store.js";

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
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("KitchAI offline support could not be registered.", error));
  });
}

const profileForm = /** @type {HTMLFormElement | null} */ (document.querySelector("#profile-form"));
const businessNameInput = /** @type {HTMLInputElement | null} */ (document.querySelector("#business-name"));
const profileState = /** @type {HTMLParagraphElement | null} */ (document.querySelector("#profile-state"));
let currentProfile = null;

async function loadLocalProfile() {
  if (!profileForm || !businessNameInput || !profileState) return;
  try {
    currentProfile = await readLocalProfile();
    if (currentProfile) {
      businessNameInput.value = currentProfile.name;
      profileState.textContent = "Saved on this device · not synced.";
    } else {
      profileState.textContent = "No profile saved on this device yet.";
    }
  } catch (error) {
    profileState.textContent = error instanceof Error
      ? "Local storage is unavailable: " + error.message
      : "Local storage is unavailable. Your profile has not been saved.";
    profileState.classList.add("is-error");
  }
}

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!businessNameInput || !profileState) return;
  const submitButton = /** @type {HTMLButtonElement | null} */ (profileForm.querySelector('button[type="submit"]'));
  if (submitButton) submitButton.disabled = true;
  profileState.classList.remove("is-error");
  profileState.textContent = "Saving on this device…";
  try {
    const saved = await saveLocalProfile({ id: currentProfile?.id, name: businessNameInput.value });
    currentProfile = saved.profile;
    businessNameInput.value = saved.profile.name;
    profileState.textContent = "Saved on this device · not synced (local version " + saved.localRevision + ").";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected storage error.";
    profileState.textContent = /business name|80 characters/i.test(message)
      ? message
      : "Could not save locally; your changes were not saved. " + message;
    profileState.classList.add("is-error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

void loadLocalProfile();
