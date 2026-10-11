import {
  createProfile,
  exportWorkspace,
  fakeRemote,
  listConflicts,
  listOutbox,
  readProfile,
  resetSpike,
  resolveConflict,
  restoreWorkspace,
  signInAs: withSummary(signInAs),
  signOut: withSummary(signOut),
  simulateStorageFailure,
  syncOperation,
  updateProfile,
  workspaceStatus,
} from "./sync.js";

const summary = document.querySelector("#sync-summary");

async function refreshSummary() {
  const status = workspaceStatus();
  if (status.locked) {
    summary.textContent = "Workspace locked; unsynced local data preserved";
    return;
  }
  const operations = await listOutbox();
  const count = (state) => operations.filter((operation) => operation.state === state).length;
  summary.textContent = `${count("pending")} pending, ${count("failed")} failed, ${count("conflict")} conflicts`;
}

const withSummary = (action) => async (...args) => {
  const result = await action(...args);
  await refreshSummary();
  return result;
};

window.spike = {
  signInAs,
  signOut,
  workspaceStatus,
  createProfile: withSummary(createProfile),
  updateProfile: withSummary(updateProfile),
  readProfile,
  listOutbox,
  listConflicts,
  syncOperation: withSummary(syncOperation),
  resolveConflict: withSummary(resolveConflict),
  exportWorkspace,
  simulateStorageFailure,
  restoreWorkspace: withSummary(restoreWorkspace),
  remote: fakeRemote,
  async reset() {
    await resetSpike();
    await refreshSummary();
  },
  async refresh() {
    await refreshSummary();
  },
};

await refreshSummary();
