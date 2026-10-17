/** @typedef {{id:string,businessId:string,name:string,createdAt:string,updatedAt:string}} LocalBusinessProfile */
/** @typedef {{profile:LocalBusinessProfile,localRevision:number,syncState:"local_only"}} SavedLocalProfile */

const DATABASE_NAME = "kitchai-local";
const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const METADATA_STORE = "metadata";
let databasePromise;

/** @param {unknown} value */
export function validateBusinessName(value) {
  if (typeof value !== "string") throw new TypeError("Enter a business name.");
  const name = value.trim();
  if (name.length === 0) throw new Error("Enter a business name.");
  if (name.length > 80) throw new Error("Business name must be 80 characters or fewer.");
  return name;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
      request.transaction?.objectStore(METADATA_STORE).put({
        key: "schemaVersion",
        value: DATABASE_VERSION,
        appliedAt: new Date().toISOString(),
      });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("Could not open local storage."));
    };
    request.onblocked = () => reject(new Error("Local storage upgrade is blocked by another open KitchAI tab."));
  });
  return databasePromise;
}

/** @template T @param {IDBRequest<T>} request */
function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local storage request failed."));
  });
}

/** Read a single profile by its stable profile ID, or the most recently updated profile for legacy callers. */
export async function readLocalProfile(id) {
  const database = await openDatabase();
  const transaction = database.transaction(PROFILE_STORE, "readonly");
  const store = transaction.objectStore(PROFILE_STORE);
  if (id) return (await requestValue(store.get(id))) ?? null;
  const profiles = await requestValue(store.getAll());
  return profiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** Return every profile without mixing business records; archived profiles are included for recovery. */
export async function readLocalProfiles() {
  const database = await openDatabase();
  const profiles = await requestValue(database.transaction(PROFILE_STORE, "readonly").objectStore(PROFILE_STORE).getAll());
  return profiles.sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)) || a.name.localeCompare(b.name));
}

/** Persist the active profile separately from profile data so switching survives refresh and offline use. */
export async function readActiveLocalProfile() {
  const database = await openDatabase();
  const transaction = database.transaction([PROFILE_STORE, METADATA_STORE], "readonly");
  const metadata = await requestValue(transaction.objectStore(METADATA_STORE).get("activeProfileId"));
  if (metadata?.value) {
    const profile = await requestValue(transaction.objectStore(PROFILE_STORE).get(metadata.value));
    if (profile && !profile.archivedAt) return profile;
  }
  const profiles = await requestValue(transaction.objectStore(PROFILE_STORE).getAll());
  const active = profiles.filter(profile => !profile.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  if (active) await setActiveLocalProfile(active.id);
  return active;
}

export async function setActiveLocalProfile(id) {
  const database = await openDatabase();
  const transaction = database.transaction([PROFILE_STORE, METADATA_STORE], "readwrite");
  const profile = await requestValue(transaction.objectStore(PROFILE_STORE).get(id));
  if (!profile || profile.archivedAt) throw new Error("Choose an active, non-archived business.");
  transaction.objectStore(METADATA_STORE).put({ key: "activeProfileId", value: id });
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the active business."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Active business change was cancelled."));
  });
  return profile;
}

export async function archiveLocalProfile(id, archived = true) {
  const database = await openDatabase();
  const transaction = database.transaction([PROFILE_STORE, METADATA_STORE], "readwrite");
  const profiles = transaction.objectStore(PROFILE_STORE);
  const metadata = transaction.objectStore(METADATA_STORE);
  const profile = await requestValue(profiles.get(id));
  if (!profile) throw new Error("Business profile was not found.");
  if (archived) {
    const all = await requestValue(profiles.getAll());
    if (all.filter(item => !item.archivedAt && item.id !== id).length === 0) throw new Error("Keep at least one active business. Create another business before archiving this one.");
    profile.archivedAt = new Date().toISOString();
  } else {
    delete profile.archivedAt;
  }
  profile.updatedAt = new Date().toISOString();
  profiles.put(profile);
  const active = await requestValue(metadata.get("activeProfileId"));
  if (archived && active?.value === id) {
    const all = await requestValue(profiles.getAll());
    const next = all.find(item => item.id !== id && !item.archivedAt);
    metadata.put({ key: "activeProfileId", value: next.id });
  }
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not update business archive status."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Business archive change was cancelled."));
  });
  return profile;
}

/**
 * Saves the profile before returning. ownerId and server revision are intentionally
 * absent: authentication and server-authoritative fields belong to WP1.4.
 * @param {{id?:string,name:unknown,businessType?:string,phone?:string,address?:string,currency?:string,timezone?:string,logo?:string,archivedAt?:string}} input
 * @returns {Promise<SavedLocalProfile>}
 */
export async function saveLocalProfile(input) {
  const name = validateBusinessName(input.name);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROFILE_STORE, METADATA_STORE], "readwrite");
    const profiles = transaction.objectStore(PROFILE_STORE);
    const metadata = transaction.objectStore(METADATA_STORE);
    let saved;

    const fail = (error) => {
      try { transaction.abort(); } catch {}
      reject(error);
    };
    const commit = (existing, localRevision, storedBusinessId) => {
      const now = new Date().toISOString();
      const id = existing?.id ?? input.id ?? crypto.randomUUID();
      const businessId = existing?.businessId ?? crypto.randomUUID();
      const profile = {
        ...existing,
        id,
        businessId,
        name,
        businessType: input.businessType ?? existing?.businessType ?? "",
        phone: input.phone ?? existing?.phone ?? "",
        address: input.address ?? existing?.address ?? "",
        currency: input.currency ?? existing?.currency ?? "THB",
        timezone: input.timezone ?? existing?.timezone ?? "Asia/Bangkok",
        logo: input.logo ?? existing?.logo ?? "",
        archivedAt: input.archivedAt ?? existing?.archivedAt,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const revision = (localRevision ?? 0) + 1;
      profiles.put(profile);
      if (!existing) metadata.put({ key: "activeProfileId", value: id });
      metadata.put({ key: "localRevision:" + id, value: revision });
      saved = { profile, localRevision: revision, syncState: "local_only" };
    };

    const loadBusinessId = (existing, localRevision) => {
      if (existing) {
        commit(existing, localRevision, existing.businessId);
        return;
      }
      const businessRequest = metadata.get("businessId");
      businessRequest.onsuccess = () => commit(null, localRevision, businessRequest.result?.value);
      businessRequest.onerror = () => fail(businessRequest.error ?? new Error("Could not read local business metadata."));
    };

    const loadRevision = (existing) => {
      const key = "localRevision:" + (existing?.id ?? input.id ?? "");
      if (!existing && !input.id) {
        loadBusinessId(null, 0);
        return;
      }
      const revisionRequest = metadata.get(key);
      revisionRequest.onsuccess = () => loadBusinessId(existing, revisionRequest.result?.value ?? 0);
      revisionRequest.onerror = () => fail(revisionRequest.error ?? new Error("Could not read local revision metadata."));
    };

    if (input.id) {
      const existingRequest = profiles.get(input.id);
      existingRequest.onsuccess = () => loadRevision(existingRequest.result ?? null);
      existingRequest.onerror = () => fail(existingRequest.error ?? new Error("Could not read the local profile."));
    } else {
      // No ID always means create a new business. Never overwrite the most recently updated profile.
      loadRevision(null);
    }

    transaction.oncomplete = () => {
      if (saved) resolve(saved);
      else reject(new Error("Local save ended without a result."));
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save to local storage."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local save was cancelled; your changes were not saved."));
  });
}
