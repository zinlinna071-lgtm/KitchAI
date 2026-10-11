import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.spike.reset());
  await page.evaluate(() => window.spike.signInAs("owner-1"));
});

test("IndexedDB profile survives reload and invalid names leave it unchanged", async ({ page }) => {
  const created = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-1", ownerId: "owner-1", name: "  KitchAI Test Kitchen  " }),
  );
  await page.reload();
  await page.evaluate(() => window.spike.signInAs("owner-1"));

  const persisted = await page.evaluate((id) => window.spike.readProfile(id), created.id);
  expect(persisted.name).toBe("KitchAI Test Kitchen");
  expect(persisted.revision).toBe(1);

  const invalidResult = await page.evaluate(async (id) => {
    try {
      await window.spike.updateProfile(id, "   ");
      return "accepted";
    } catch (error) {
      return error.message;
    }
  }, created.id);
  expect(invalidResult).toBe("Name must contain 1 to 80 characters");
  expect((await page.evaluate((id) => window.spike.readProfile(id), created.id)).name)
    .toBe("KitchAI Test Kitchen");
});

test("offline edits remain locally readable and visibly pending", async ({ page, context }) => {
  await context.setOffline(true);
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-2", ownerId: "owner-1", name: "Offline Kitchen" }),
  );
  const updated = await page.evaluate((id) => window.spike.updateProfile(id, "Updated Offline Kitchen"), profile.id);
  const operation = (await page.evaluate(() => window.spike.listOutbox())).at(-1);
  const result = await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId);

  expect(result.status).toBe("offline");
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Updated Offline Kitchen");
  expect(updated.revision).toBe(2);
  expect((await page.evaluate((id) => window.spike.listOutbox(), profile.id)).some((item) => item.state === "pending"))
    .toBe(true);
  await expect(page.locator("#sync-summary")).toContainText("pending");
});

test("transient failure retries safely and replaying an operation is idempotent", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-3", ownerId: "owner-1", name: "Retry Kitchen" }),
  );
  const operation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  await page.evaluate(() => window.spike.remote.failNext());

  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("transient-failure");
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name).toBe("Retry Kitchen");
  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("accepted");
  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("synced");

  expect(await page.evaluate(() => window.spike.remote.logicalWrites)).toBe(1);
  expect((await page.evaluate(() => window.spike.listOutbox()))[0].state).toBe("synced");
});

test("retry attempts are bounded and failures preserve the local profile", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-4", ownerId: "owner-1", name: "Bounded Retry Kitchen" }),
  );
  const operation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  await page.evaluate(() => window.spike.remote.failNext(3));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
      .toBe("transient-failure");
  }
  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("retry-exhausted");
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Bounded Retry Kitchen");
  expect((await page.evaluate(() => window.spike.listOutbox()))[0].attempts).toBe(3);
});

test("stale remote edits preserve base, local, and remote versions until explicit resolution", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-5", ownerId: "owner-1", name: "Shared Kitchen" }),
  );
  const createOperation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  await page.evaluate((id) => window.spike.syncOperation(id), createOperation.operationId);
  const remoteCandidate = await page.evaluate((id) => window.spike.remote.compete(id, "Remote Kitchen"), profile.id);
  const localCandidate = await page.evaluate((id) => window.spike.updateProfile(id, "Local Kitchen"), profile.id);
  const updateOperation = (await page.evaluate(() => window.spike.listOutbox()))
    .find((operation) => operation.operationId !== createOperation.operationId);
  const result = await page.evaluate((id) => window.spike.syncOperation(id), updateOperation.operationId);

  expect(result.status).toBe("conflict");
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name).toBe("Local Kitchen");
  let conflicts = await page.evaluate(() => window.spike.listConflicts());
  expect(conflicts[0]).toMatchObject({
    status: "unresolved",
    baseRevision: 1,
    baseCandidate: { name: "Shared Kitchen" },
    localCandidate: { name: "Local Kitchen", revision: localCandidate.revision },
    remoteCandidate: { name: "Remote Kitchen", revision: remoteCandidate.revision },
  });
  expect((await page.evaluate(() => window.spike.listOutbox())).find((item) => item.operationId === updateOperation.operationId).state)
    .toBe("conflict");

  await page.evaluate((id) => window.spike.resolveConflict(id, "local"), result.conflictId);
  conflicts = await page.evaluate(() => window.spike.listConflicts());
  expect(conflicts[0]).toMatchObject({
    status: "resolved",
    resolution: "local",
    localCandidate: { name: "Local Kitchen" },
    remoteCandidate: { name: "Remote Kitchen" },
  });
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name).toBe("Local Kitchen");
});

test("fake owner rejection is simulation only", async ({ page }) => {
  await page.evaluate(() => window.spike.createProfile({
    id: "profile-6",
    ownerId: "owner-1",
    name: "Owner Fixture Kitchen",
  }));
  const operation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  const result = await page.evaluate(async (id) => {
    const [candidate] = await window.spike.listOutbox();
    return window.spike.remote.push({ ...candidate, ownerId: id });
  }, "different-owner");

  expect(result.status).toBe("owner-mismatch");
  expect(await page.evaluate(() => window.spike.remote.logicalWrites)).toBe(0);
  expect(operation.ownerId).toBe("owner-1");
});

test("pending outbox work survives a page reload and remains retryable", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-reload", ownerId: "owner-1", name: "Reload Recovery Kitchen" }),
  );
  const beforeReload = (await page.evaluate(() => window.spike.listOutbox()))[0];
  expect(beforeReload.state).toBe("pending");

  await page.reload();
  await page.evaluate(() => window.spike.signInAs("owner-1"));
  const afterReload = (await page.evaluate(() => window.spike.listOutbox()))
    .find((operation) => operation.operationId === beforeReload.operationId);
  expect(afterReload).toMatchObject({
    operationId: beforeReload.operationId,
    profileId: profile.id,
    ownerId: "owner-1",
    state: "pending",
    attempts: 0,
  });
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Reload Recovery Kitchen");

  expect((await page.evaluate((id) => window.spike.syncOperation(id), afterReload.operationId)).status)
    .toBe("accepted");
  expect((await page.evaluate(() => window.spike.listOutbox()))
    .find((operation) => operation.operationId === beforeReload.operationId).state).toBe("synced");
});

test("explicit remote conflict resolution keeps the remote candidate and preserves snapshots", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "profile-remote-resolution", ownerId: "owner-1", name: "Base Resolution Kitchen" }),
  );
  const createOperation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  await page.evaluate((id) => window.spike.syncOperation(id), createOperation.operationId);
  const remote = await page.evaluate((id) => window.spike.remote.compete(id, "Authoritative Remote Kitchen"), profile.id);
  await page.evaluate((id) => window.spike.updateProfile(id, "Unselected Local Kitchen"), profile.id);
  const updateOperation = (await page.evaluate(() => window.spike.listOutbox()))
    .find((operation) => operation.operationId !== createOperation.operationId);
  const conflict = await page.evaluate((id) => window.spike.syncOperation(id), updateOperation.operationId);
  expect(conflict.status).toBe("conflict");

  const resolution = await page.evaluate((id) => window.spike.resolveConflict(id, "remote"), conflict.conflictId);
  expect(resolution).toMatchObject({
    status: "resolved",
    resolution: "remote",
    baseCandidate: { name: "Base Resolution Kitchen" },
    localCandidate: { name: "Unselected Local Kitchen" },
    remoteCandidate: { name: "Authoritative Remote Kitchen", revision: remote.revision },
  });
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Authoritative Remote Kitchen");
  expect((await page.evaluate(() => window.spike.listOutbox()))
    .find((operation) => operation.operationId === updateOperation.operationId))
    .toMatchObject({ state: "conflict", candidate: { name: "Unselected Local Kitchen" } });
  expect((await page.evaluate(() => window.spike.listConflicts()))
    .find((item) => item.id === conflict.conflictId).status).toBe("resolved");
});


test("sign-out locks workspace, preserves unsynced work, and isolates owner queues", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "shared-profile-id", ownerId: "owner-1", name: "Owner One Kitchen" }),
  );
  const ownerOneOperation = (await page.evaluate(() => window.spike.listOutbox()))[0];

  await page.evaluate(() => window.spike.signOut());
  expect(await page.evaluate(() => window.spike.workspaceStatus())).toMatchObject({ locked: true, ownerId: null });
  expect(await page.locator("#sync-summary").textContent()).toContain("unsynced local data preserved");
  await expect(page.evaluate((id) => window.spike.readProfile(id), profile.id)).rejects.toThrow("Workspace is locked");
  await expect(page.evaluate((id) => window.spike.syncOperation(id), ownerOneOperation.operationId))
    .rejects.toThrow("Workspace is locked");

  await page.evaluate(() => window.spike.signInAs("owner-2"));
  expect(await page.evaluate((id) => window.spike.readProfile(id), profile.id)).toBeNull();
  expect(await page.evaluate(() => window.spike.listOutbox())).toEqual([]);
  await expect(page.evaluate((id) => window.spike.syncOperation(id), ownerOneOperation.operationId))
    .rejects.toThrow("does not exist in the active workspace");

  await page.evaluate(() => window.spike.createProfile({
    id: "shared-profile-id", ownerId: "owner-2", name: "Owner Two Kitchen",
  }));
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Owner Two Kitchen");

  await page.evaluate(() => window.spike.signOut());
  await page.evaluate(() => window.spike.signInAs("owner-1"));
  expect((await page.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
    .toBe("Owner One Kitchen");
  expect((await page.evaluate(() => window.spike.listOutbox())).some((item) =>
    item.operationId === ownerOneOperation.operationId && item.ownerId === "owner-1")).toBe(true);
});

test("IndexedDB write failures leave profile and outbox unchanged", async ({ page }) => {
  await page.evaluate(() => window.spike.simulateStorageFailure());
  const failure = await page.evaluate(async () => {
    try {
      await window.spike.createProfile({
        id: "storage-failure-profile", ownerId: "owner-1", name: "Storage Failure Kitchen",
      });
      return "unexpected-success";
    } catch (error) {
      return error.message;
    }
  });
  expect(failure).toBe("Simulated IndexedDB write failure");
  expect(await page.evaluate(() => window.spike.readProfile("storage-failure-profile"))).toBeNull();
  expect(await page.evaluate(() => window.spike.listOutbox())).toEqual([]);
});

test("lost acknowledgement retries the same operation without duplicate remote writes", async ({ page }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "lost-ack-profile", ownerId: "owner-1", name: "Lost Ack Kitchen" }),
  );
  const operation = (await page.evaluate(() => window.spike.listOutbox()))[0];
  await page.evaluate(() => window.spike.remote.loseNextAcknowledgement());

  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("acknowledgement-lost");
  expect((await page.evaluate(() => window.spike.listOutbox()))[0]).toMatchObject({
    operationId: operation.operationId,
    state: "pending",
    attempts: 0,
  });
  expect((await page.evaluate((id) => window.spike.remote.readProfile(id), profile.id)).name)
    .toBe("Lost Ack Kitchen");

  expect((await page.evaluate((id) => window.spike.syncOperation(id), operation.operationId)).status)
    .toBe("duplicate");
  expect(await page.evaluate(() => window.spike.remote.logicalWrites)).toBe(1);
  expect((await page.evaluate(() => window.spike.listOutbox()))[0].state).toBe("synced");
});

test("workspace export and restore preserve profile and pending queue in a fresh browser context", async ({ page, browser }) => {
  const profile = await page.evaluate(() =>
    window.spike.createProfile({ id: "backup-profile", ownerId: "owner-1", name: "Backup Kitchen" }),
  );
  const backup = await page.evaluate(() => window.spike.exportWorkspace());

  const restoredContext = await browser.newContext();
  try {
    const restoredPage = await restoredContext.newPage();
    await restoredPage.goto("/");
    await restoredPage.evaluate(() => window.spike.signInAs("owner-1"));
    expect(await restoredPage.evaluate((data) => window.spike.restoreWorkspace(data), backup))
      .toMatchObject({ restored: 1, queued: 1, conflicts: 0 });
    expect((await restoredPage.evaluate((id) => window.spike.readProfile(id), profile.id)).name)
      .toBe("Backup Kitchen");
    expect((await restoredPage.evaluate(() => window.spike.listOutbox()))[0]).toMatchObject({
      ownerId: "owner-1",
      profileId: "backup-profile",
      state: "pending",
    });
    await expect(restoredPage.evaluate((data) => window.spike.restoreWorkspace(data), backup))
      .rejects.toThrow();
  } finally {
    await restoredContext.close();
  }
});

test("workspace restore rejects a backup belonging to another owner", async ({ page }) => {
  const backup = JSON.stringify({
    formatVersion: 1,
    ownerId: "owner-2",
    profiles: [],
    outbox: [],
    conflicts: [],
  });
  await expect(page.evaluate((data) => window.spike.restoreWorkspace(data), backup))
    .rejects.toThrow("Backup owner or format does not match the active workspace");
});
