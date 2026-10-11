/** @typedef {Event & { prompt: () => Promise<void> }} BeforeInstallPromptEvent */

const connectionStatus = document.querySelector("#connection-status");
const installButton = document.querySelector("#install-button");

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
