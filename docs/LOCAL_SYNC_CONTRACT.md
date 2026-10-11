# Local–Cloud Sync Contract (WP1.1)

**Status:** Contract aligned to owner-approved Phase 1 planning defaults. The isolated WP1.1 spike's local sync/recovery evidence passed 14 Chromium tests; this is not production implementation or provider-authorization evidence.  
**Scope:** Phase 1 Business Profile vertical slice only.  
**Related docs:** [Phase 1 plan](./PHASE_1_PLAN.md), [architecture options](./ARCHITECTURE_OPTIONS.md), [decision log](./DECISIONS.md), [spike report](../.spikes/wp1-1-local-sync/REPORT.md).

**Architecture direction:** Supabase + PostgreSQL is the selected target architecture, with a KitchAI-owned explicit local-first sync layer. This selection does not authorize cloud provisioning, billing activation, hosted testing, or production deployment. Use local/emulator-only verification until the test environment and cost boundary are explicitly approved.

## 1. Core invariants

1. **Local-first:** A valid user edit is saved locally before it is reported as safely stored. The UI distinguishes local-only/pending changes from cloud-confirmed changes.
2. **No silent loss:** A network failure, timeout, authentication expiry, rejected write, app reload, or conflict must not silently erase the local record, pending operation, or competing conflict snapshot.
3. **Server-authoritative identity:** The trusted backend derives or validates the authenticated owner scope. It never trusts a client-supplied `ownerId` as proof of ownership.
4. **Explicit concurrency:** A write states the revision it was based on. A stale revision is a conflict, not permission to overwrite the latest remote value.
5. **Idempotent retry:** Retrying the same logical operation must not apply it twice. Each queued operation has a stable unique operation ID reused on retries.
6. **Conflict preservation:** Preserve the base, local candidate, and current remote candidate until a deliberate resolution succeeds. Do not use silent last-write-wins.
7. **Visible failure:** The user can tell whether data is local-only, syncing, synced, needs sign-in, failed/retryable, or awaiting conflict review.
8. **No implied backup:** Local persistence or a pending outbox is not described as cloud backup.
9. **Account isolation:** Partition local records, conflicts, and pending operations by owner. On sign-out, stop sync and lock the local workspace without silently purging unsynced data. Never send a prior owner's queued operation under a different session.
10. **Storage honesty:** Browser storage is not guaranteed encrypted and local persistence is not a backup. Do not claim either property without implemented, verified support.

## 2. Business Profile and operation contract

The owner-approved minimal record is:

```ts
type BusinessProfile = {
  id: string;          // stable UUID
  ownerId: string;     // server-authoritative owner scope
  businessId: string;  // stable business scope
  name: string;        // trimmed, required, 1–80 characters
  createdAt: string;   // UTC, immutable after creation
  updatedAt: string;   // UTC
  revision: number;    // server-controlled monotonic concurrency token
};
```

The server must derive or validate `ownerId` from the authenticated identity; a client must not set it as an authorization assertion. The server controls `revision`, and `createdAt` is immutable. Keep local sync bookkeeping outside the domain record:

```ts
type PendingOperation = {
  operationId: string;          // stable idempotency key
  recordId: string;
  operation: "create" | "update";
  baseRevision: number | null;  // null only for create
  payload: unknown;             // validated editable fields, not trusted identity
  createdAt: string;
  attemptCount: number;
  state: "pending" | "in_flight" | "retryable_error" | "conflict";
};
```

The final storage representation may vary, but observable behavior must remain equivalent. Delete support is out of scope for the first slice until lifecycle and tombstone semantics are designed and tested.

## 3. Write and sync behavior

1. Validate user input at the application boundary; trim the name and reject empty names or names longer than 80 characters.
2. Persist the local record and durable pending operation in one local transaction where the selected storage permits it. If persistence fails, show an actionable error and do not claim the edit was saved.
3. Return control to the UI with a truthful state such as **Saved on this device · waiting to sync**.
4. When online and authenticated, send the operation ID, record ID, expected base revision, and validated editable fields. Do not send client-controlled ownership as an authorization assertion.
5. The trusted backend checks authentication, owner/business access, schema validation, and revision precondition before accepting the write.
6. On success, store the authoritative remote revision/timestamp, mark the operation complete, and retain enough metadata to recover safely if the client crashes between remote success and local acknowledgement.
7. On timeout or transient server/network failure, keep the operation durable and retry with bounded exponential backoff plus jitter. Do not create a new operation ID for a retry of the same logical write.
8. On authentication expiry, keep local data and queued changes; pause cloud writes and request sign-in. Account switching must not send one account's queued operations under another account.
9. On permanent validation/authorization denial, stop automatic retry loops, preserve local data, and show a clear error. Never bypass a denial by changing owner scope.
10. On revision mismatch, create a durable conflict entry and stop automatic retries for that operation until reviewed.

## 4. Conflict object and resolution

A conflict must retain at minimum:

- stable conflict ID and source operation ID;
- record ID and owner/business scope;
- base revision and base snapshot;
- local candidate snapshot;
- current remote snapshot and revision;
- detected timestamp and review state;
- resolution actor, timestamp, selected result, and resulting revision when resolved.

The owner-approved first-slice resolution choices are **Keep local** and **Use remote**. Field-level merge is out of scope.

1. Show base, local, and remote values clearly, including changed fields.
2. Require an authenticated authorized owner to explicitly choose **Keep local** or **Use remote**.
3. **Keep local:** create a new operation based on the current remote revision; do not replay the stale operation unchanged.
4. **Use remote:** update the local working copy only after the conflict and choice are durably recorded.
5. Preserve the original snapshots and an append-only resolution record. If resolution fails, leave the conflict recoverable and visible.
6. If remote state changes again during resolution, detect the new revision mismatch and return to review; do not force the old choice over the new remote version.

The exact visual layout and retention period for audit records are not yet specified. Preserve resolution history append-only for the Phase 1 workflow; do not silently erase it. Any retention or deletion policy must be documented before real business data is used.

## 5. Retry, ordering, and crash recovery

- Process a record's operations in order unless a proven-safe coalescing rule is specified and tested.
- A transient failure does not delete or reset the operation ID, payload, base revision, or creation timestamp.
- After app restart, reconstruct pending work from durable storage; do not rely on in-memory queues.
- If the server accepted an operation but the client did not receive the response, replaying the same operation ID returns the original outcome or an equivalent deduplicated success.
- Retry only transient failures (connectivity, timeout, rate limit, temporary server failure). Use server retry hints when available.
- A stale revision is a conflict, not a transient error; stop automatic retries pending review.
- Storage quota errors, corrupt local data, migration failures, and unavailable browser storage must be visible and must not be reported as successful persistence.

## 6. Minimum acceptance matrix

| Scenario | Expected result |
|---|---|
| Valid edit while online | Durable local save; accepted remote write; local state eventually marked synced |
| Valid edit while offline | Durable local save and pending operation; UI indicates not yet synced |
| Reload with pending operation | Record and queue survive; sync resumes when possible |
| Network timeout after server may have accepted | Same operation ID is retried; no duplicate logical write |
| Temporary server failure | Operation remains durable and retries with bounded backoff |
| Authentication expires | Local data remains; cloud writes pause until re-authenticated |
| Owner A attempts to access Owner B's record | Backend denies read/write; client-side hiding alone is insufficient |
| Two edits based on the same revision | One may be accepted; stale competing edit is retained as a reviewable conflict |
| Conflict resolution write fails | Original snapshots and unresolved conflict remain recoverable |
| Remote changes during conflict review | Revision mismatch is detected; no blind overwrite |
| Local persistence fails | UI does not claim the edit was saved; actionable error is shown |
| Account switch with pending work | Old account's operations cannot be submitted under the new account |
| Sign-out with pending work | Sync stops and workspace locks; unsynced data is retained and not exposed to another owner |
| Invalid Business Profile name | Empty/whitespace-only or over-80-character name is rejected before enqueue |

Provider-native allow/deny tests must run only after a hosted test environment and cost boundary are explicitly approved. Until then, test local sync mechanics and use the Supabase local development stack/emulator without hosted provisioning or billing. The existing fake-remote spike is not evidence of real provider authorization.

## 7. Out of scope for this contract

- Full account-management UI, team roles, and multi-business administration.
- Menu, inventory, purchasing, sales, finance, and AI workflows.
- Automatic field-level conflict merge.
- Delete/restore semantics until tombstones, authorization, and offline deletion behavior are specified.
- Production provisioning, billing activation, domain purchase, or public deployment.

## 8. WP1.1 gate checklist

- [x] Owner selected Supabase/PostgreSQL as the target architecture and approved the local-first sync direction; no provisioning/billing approval is implied.
- [x] Owner accepted the minimal Business Profile fields and name validation.
- [x] Owner accepted conflict preservation and explicit **Keep local** / **Use remote** resolution.
- [x] Owner accepted owner-partitioned local data, sync stop and workspace lock on sign-out, and preservation of unsynced data.
- [x] Owner directed local/emulator-first testing and deferred deployment, region/domain, backup/export and spend details until before hosted deployment.
- [x] Re-ran the isolated browser suite: 14/14 Chromium tests passed on GitHub Actions run [38175356346](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38175356346); dependency audit reported 0 vulnerabilities and `npm ls --depth=0` passed.
- [x] Verified local owner partitioning, sign-out lock with preserved unsynced data, and prevention of prior-owner queue submission under another test session.
- [x] Verified same-operation-ID recovery after simulated lost acknowledgement; retry produced no duplicate logical remote write.
- [x] Verified export/restore into a fresh browser context for the same owner, rejection of a different-owner backup, and a simulated write failure that leaves no partial profile/outbox write.
- [x] Reviewed and recorded the limits: these are disposable local-spike tests; session switching and remote are simulated; real browser quota/eviction and production restore-over-existing-data are not tested.
- [x] Provider-native authorization/security validation is explicitly deferred until an isolated hosted test environment and cost boundary are approved; no provider authorization claim is made.

**WP1.1 local evidence gate: met for the requirements/architecture spike.** Provider-native authorization remains a separate blocked prerequisite for WP1.4 and the Phase 1 production vertical slice. WP1.2 may begin as a separate bounded work package; do not create a cloud project, enable billing, add provider credentials, or deploy without separate approval.
