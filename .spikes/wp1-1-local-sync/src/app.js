import {
  createProfile,
  fakeRemote,
  listConflicts,
  listOutbox,
  readProfile,
  resetSpike,
  resolveConflict,
  syncOperation,
  updateProfile,
} from "./sync.js";

const summary = document.querySelector("#sync-summary");

async function refreshSummary() {
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
  createProfile: withSummary(createProfile),
  updateProfile: withSummary(updateProfile),
  readProfile,
  listOutbox,
  listConflicts,
  syncOperation: withSummary(syncOperation),
  resolveConflict: withSummary(resolveConflict),
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
