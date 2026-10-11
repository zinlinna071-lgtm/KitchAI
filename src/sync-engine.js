/**
 * Deterministic sync orchestration. Persistence and transport are injected so
 * this module can be tested without hosted services or credentials.
 *
 * @typedef {{operationId:string,ownerId:string,recordId:string,operation:"create"|"update",baseRevision:number|null,payload:unknown,createdAt:string,attemptCount:number,state:string,nextAttemptAt?:number}} PendingOperation
 * @typedef {{operationId:string,ownerId:string,recordId:string,baseRevision:number|null,baseSnapshot:unknown,localSnapshot:unknown,remoteSnapshot:unknown,remoteRevision:number,detectedAt:string,state:"unresolved"|"resolved",resolution?:unknown}} SyncConflict
 */

/** @param {number} attemptCount @param {{baseDelayMs?:number,maxDelayMs?:number,random?:()=>number}=} options */
export function retryDelayMs(attemptCount, options = {}) {
  const base = options.baseDelayMs ?? 1000;
  const cap = options.maxDelayMs ?? 5 * 60 * 1000;
  const random = options.random ?? Math.random;
  const exponent = Math.max(0, Math.min(30, attemptCount - 1));
  const ceiling = Math.min(cap, base * (2 ** exponent));
  const jitter = 0.5 + Math.min(1, Math.max(0, random()));
  return Math.floor(Math.min(cap, ceiling * jitter));
}

/**
 * Process due operations for exactly one authenticated owner. The injected store
 * must persist every transition before resolving; send must use operationId as
 * the idempotency key and must never treat ownerId in a payload as authority.
 * @param {{
 *  ownerId:string,
 *  store:{
 *   listOperations:(ownerId:string)=>Promise<PendingOperation[]>,
 *   markInFlight:(operationId:string,ownerId:string)=>Promise<void>,
 *   acknowledge:(operationId:string,ownerId:string,profile:unknown)=>Promise<void>,
 *   preserveConflict:(operation:PendingOperation,remoteProfile:any)=>Promise<void>,
 *   pauseForAuth:(operationId:string,ownerId:string)=>Promise<void>,
 *   markPermanentFailure:(operationId:string,ownerId:string,message:string)=>Promise<void>,
 *   scheduleRetry:(operationId:string,ownerId:string,attemptCount:number,nextAttemptAt:number,message:string)=>Promise<void>
 *  },
 *  send:(operation:PendingOperation)=>Promise<{status:"accepted",profile:unknown}|{status:"conflict",remoteProfile:any}|{status:"auth_required"}|{status:"permanent_error",message:string}>,
 *  now?:()=>number, random?:()=>number, baseDelayMs?:number,maxDelayMs?:number
 * }} input
 */
export async function syncPendingOperations(input) {
  if (!input.ownerId || typeof input.ownerId !== "string") throw new TypeError("An active owner is required.");
  const now = input.now ?? Date.now;
  const summary = { synced: 0, conflicts: 0, pausedForAuth: 0, failed: 0, retried: 0, skipped: 0 };
  const operations = await input.store.listOperations(input.ownerId);

  for (const operation of operations) {
    // Defense in depth: never send an operation from a different owner partition.
    if (operation.ownerId !== input.ownerId || !["pending", "retryable_error"].includes(operation.state)) {
      summary.skipped++;
      continue;
    }
    if (operation.nextAttemptAt !== undefined && operation.nextAttemptAt > now()) {
      summary.skipped++;
      continue;
    }

    await input.store.markInFlight(operation.operationId, input.ownerId);
    try {
      const result = await input.send(operation);
      if (result.status === "accepted") {
        await input.store.acknowledge(operation.operationId, input.ownerId, result.profile);
        summary.synced++;
      } else if (result.status === "conflict") {
        await input.store.preserveConflict(operation, result.remoteProfile);
        summary.conflicts++;
      } else if (result.status === "auth_required") {
        await input.store.pauseForAuth(operation.operationId, input.ownerId);
        summary.pausedForAuth++;
      } else if (result.status === "permanent_error") {
        await input.store.markPermanentFailure(operation.operationId, input.ownerId, result.message);
        summary.failed++;
      } else {
        throw new Error("Sync transport returned an unsupported result.");
      }
    } catch (error) {
      const attempts = operation.attemptCount + 1;
      const delay = retryDelayMs(attempts, {
        baseDelayMs: input.baseDelayMs,
        maxDelayMs: input.maxDelayMs,
        random: input.random,
      });
      const message = error instanceof Error ? error.message : "Temporary sync failure.";
      await input.store.scheduleRetry(
        operation.operationId,
        input.ownerId,
        attempts,
        now() + delay,
        message,
      );
      summary.retried++;
    }
  }
  return summary;
}

/**
 * Resolution always writes against the currently observed remote revision.
 * The repository is responsible for retaining the original conflict record.
 * @param {{ownerId:string,conflict:SyncConflict,choice:"keep_local"|"use_remote",store:{keepLocalAndResolve:(conflict:SyncConflict,ownerId:string,operation:any)=>Promise<void>,applyRemoteAndResolve:(conflict:SyncConflict,ownerId:string)=>Promise<void>},operationId?:string,now?:()=>number}} input
 */
export async function resolveSyncConflict(input) {
  const { ownerId, conflict, choice } = input;
  if (!ownerId || conflict.ownerId !== ownerId) throw new Error("Conflict belongs to a different owner.");
  if (conflict.state !== "unresolved") throw new Error("Conflict has already been resolved.");
  if (choice === "use_remote") {
    await input.store.applyRemoteAndResolve(conflict, ownerId);
    return;
  }
  if (choice !== "keep_local") throw new TypeError("Choose keep_local or use_remote.");
  if (!Number.isInteger(conflict.remoteRevision) || conflict.remoteRevision < 1) {
    throw new Error("Conflict is missing the current remote revision.");
  }
  await input.store.keepLocalAndResolve(conflict, ownerId, {
    operationId: input.operationId ?? crypto.randomUUID(),
    ownerId,
    recordId: conflict.recordId,
    operation: "update",
    baseRevision: conflict.remoteRevision,
    payload: conflict.localSnapshot,
    createdAt: new Date((input.now ?? Date.now)()).toISOString(),
  });
}
