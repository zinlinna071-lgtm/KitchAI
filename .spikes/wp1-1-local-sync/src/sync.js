import { clearDatabase, getRecord, getRecords, writeRecords } from "./database.js";
import { FakeRemote } from "./fake-remote.js";

export const maximumAttempts = 3;
export const fakeRemote = new FakeRemote();
const copy = (value) => structuredClone(value);

function validateProfile(input) {
  if (!input || typeof input.id !== "string" || !input.id.trim()) {
    throw new Error("Profile id is required");
  }
  if (typeof input.ownerId !== "string" || !input.ownerId.trim()) {
    throw new Error("Owner id is required");
  }
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
    throw new Error("Name must contain 1 to 80 characters");
  }
  return { ...input, name: input.name.trim() };
}

function createOperation(profile, baseProfile) {
  return {
    operationId: crypto.randomUUID(),
    profileId: profile.id,
    ownerId: profile.ownerId,
    baseRevision: baseProfile?.revision ?? null,
    baseCandidate: baseProfile ? copy(baseProfile) : null,
    candidate: copy(profile),
    state: "pending",
    attempts: 0,
    createdAt: profile.updatedAt,
  };
}

export async function createProfile(input) {
  const fields = validateProfile(input);
  const now = new Date().toISOString();
  const profile = {
    ...fields,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
  const operation = createOperation(profile, null);
  await writeRecords(["profiles", "outbox"], (transaction) => {
    transaction.objectStore("profiles").add(profile);
    transaction.objectStore("outbox").add(operation);
  });
  return copy(profile);
}

export async function updateProfile(id, name) {
  const current = await getRecord("profiles", id);
  if (!current) throw new Error("Profile does not exist");
  const fields = validateProfile({ ...current, name });
  const profile = {
    ...fields,
    updatedAt: new Date().toISOString(),
    revision: current.revision + 1,
  };
  const operation = createOperation(profile, current);
  await writeRecords(["profiles", "outbox"], (transaction) => {
    transaction.objectStore("profiles").put(profile);
    transaction.objectStore("outbox").add(operation);
  });
  return copy(profile);
}

export const readProfile = (id) => getRecord("profiles", id);
export const listOutbox = () => getRecords("outbox");
export const listConflicts = () => getRecords("conflicts");

export async function syncOperation(operationId) {
  const operation = await getRecord("outbox", operationId);
  if (!operation) throw new Error("Outbox operation does not exist");
  if (!navigator.onLine) return { status: "offline" };
  if (operation.state === "conflict") return { status: "conflict" };
  if (operation.state === "failed" && operation.attempts >= maximumAttempts) {
    return { status: "retry-exhausted" };
  }

  const response = await fakeRemote.push({
    operationId: operation.operationId,
    profileId: operation.profileId,
    ownerId: operation.ownerId,
    baseRevision: operation.baseRevision,
    baseCandidate: operation.baseCandidate,
    candidate: operation.candidate,
  });
  if (operation.state === "synced") return response;

  const updated = {
    ...operation,
    attempts: operation.attempts + 1,
    state: "failed",
    lastError: response.status,
  };
  if (response.status === "accepted" || response.status === "duplicate") {
    updated.state = "synced";
    delete updated.lastError;
  } else if (response.status === "conflict") {
    updated.state = "conflict";
    await writeRecords(["outbox", "conflicts"], (transaction) => {
      transaction.objectStore("outbox").put(updated);
      transaction.objectStore("conflicts").put({
        id: operation.operationId,
        operationId: operation.operationId,
        profileId: operation.profileId,
        baseRevision: operation.baseRevision,
        baseCandidate: copy(operation.baseCandidate),
        localCandidate: copy(operation.candidate),
        remoteCandidate: copy(response.remoteCandidate),
        status: "unresolved",
        createdAt: new Date().toISOString(),
      });
    });
    return { status: response.status, conflictId: operation.operationId };
  }

  await writeRecords(["outbox"], (transaction) => {
    transaction.objectStore("outbox").put(updated);
  });
  return response;
}

export async function resolveConflict(conflictId, choice) {
  if (choice !== "local" && choice !== "remote") {
    throw new Error("Choose either the local or remote candidate");
  }
  const conflict = await getRecord("conflicts", conflictId);
  if (!conflict || conflict.status !== "unresolved") {
    throw new Error("Conflict is not unresolved");
  }
  if (choice === "remote" && !conflict.remoteCandidate) {
    throw new Error("There is no remote candidate to select");
  }

  const now = new Date().toISOString();
  const latestRemote = conflict.remoteCandidate;
  const selected = choice === "local" ? conflict.localCandidate : latestRemote;
  const profile = choice === "local"
    ? {
        ...selected,
        updatedAt: now,
        revision: (latestRemote?.revision ?? 0) + 1,
      }
    : copy(selected);
  const resolvedConflict = {
    ...conflict,
    status: "resolved",
    resolution: choice,
    resolvedAt: now,
  };
  const stores = choice === "local" ? ["profiles", "outbox", "conflicts"] : ["profiles", "conflicts"];
  await writeRecords(stores, (transaction) => {
    transaction.objectStore("profiles").put(profile);
    transaction.objectStore("conflicts").put(resolvedConflict);
    if (choice === "local") {
      transaction.objectStore("outbox").add(createOperation(profile, latestRemote));
    }
  });
  return copy(resolvedConflict);
}

export async function resetSpike() {
  await clearDatabase();
  fakeRemote.reset();
}
