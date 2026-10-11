# Local–Cloud Sync Contract (WP1.1 Proposal)

**Status:** Proposed provider-neutral contract; pending owner acceptance.  
**Scope:** Phase 1 Business Profile vertical slice only.  
**Related docs:** [Phase 1 plan](./PHASE_1_PLAN.md), [architecture options](./ARCHITECTURE_OPTIONS.md), [decision log](./DECISIONS.md), [spike report](../.spikes/wp1-1-local-sync/REPORT.md).

This document defines observable behavior that any selected backend/local-store implementation must satisfy. It does not select a cloud provider, authorize provisioning, or claim that provider-specific security has been tested.

## 1. Core invariants

1. **Local-first:** A valid user edit is saved locally before it is reported as safely stored. The UI distinguishes local-only/pending changes from cloud-confirmed changes.
2. **No silent loss:** A network failure, timeout, authentication expiry, rejected write, app reload, or conflict must not silently erase the local record, pending operation, or competing conflict snapshot.
3. **Server-authoritative identity:** The server derives or validates the authenticated owner scope. It never trusts a client-supplied `ownerId` as proof of ownership.
4. **Explicit concurrency:** A write states the revision it was based on. A stale revision is a conflict, not permission to overwrite the latest remote value.
5. **Idempotent retry:** Retrying the same logical operation must not apply it twice. Each queued operation has a stable unique operation ID reused on retries.
6. **Conflict preservation:** Preserve the base, local candidate, and current remote candidate until a deliberate resolution succeeds. Do not use silent last-write-wins.
7. **Visible failure:** The user can tell whether data is local-only, syncing, synced, needs sign-in, failed/retryable, or awaiting conflict review.
8. **No implied backup:** Local persistence or a pending outbox is not described as cloud backup.

## 2. Record and operation contract

### Business Profile domain record (proposed)

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

This schema is a proposal under O-002. Keep sync bookkeeping outside the domain record:

```ts
type PendingOperation = {
  operationId: string;          // stable idempotency key
  recordId: string;
  operation: "create" | "update";
  baseRevision: number | null;  // null only for create
  payload: unknown;             // validated domain fields, not trusted identity
  createdAt: string;
  attemptCount: number;
  state: "pending" | "in_flight" | "retryable_error" | "conflict";
};
```

The final type and storage shape may vary, but behavior must remain equivalent. Do not add delete support to the first slice unless its lifecycle and tombstone semantics are explicitly designed and tested.

## 3. Write and sync behavior

1. Validate the user's input at the application boundary.
2. Persist the local record and a durable pending operation in one local transaction where the chosen storage permits it. If persistence fails, show an actionable error and do not claim the edit was saved.
3. Return control to the UI with a truthful state such as **Saved on this device · waiting to sync**.
4. When online and authenticated, send the operation ID, record ID, expected base revision, and validated editable fields. Do not send client-controlled ownership as an authorization assertion.
5. The trusted backend checks authentication, owner/business access, schema validation, and revision precondition before accepting the write.
6. On success, store the authoritative remote revision/timestamp, mark the operation complete, and retain enough metadata to recover safely if the client crashes between remote success and local acknowledgement.
7. On timeout or transient server/network failure, keep the operation durable and retry with bounded exponential backoff plus jitter. Do not create a new operation ID for a retry of the same logical write.
8. On authentication expiry, keep local data and queued changes; pause cloud writes and request sign-in. Account switching must not send one account's queued operations under another account.
9. On permanent validation/authorization denial, stop automatic retry loops, preserve the local data, and show a clear error. Never bypass a denial by changing owner scope.
10. On a revision mismatch, create a durable conflict entry and stop automatic retries for that operation until reviewed.

## 4. Conflict object and resolution

A conflict must retain at minimum:

- stable conflict ID and source operation ID;
- record ID and owner/business scope;
- base revision and base snapshot;
- local candidate snapshot;
- current remote snapshot and revision;
- detected timestamp and review state;
- resolution actor, timestamp, selected result, and resulting revision when resolved.

Resolution flow:

1. Show base, local, and remote values clearly, including changed fields.
2. Require an authenticated authorized user to explicitly choose **Keep local** or **Use remote** for the first slice. Field-level merge is out of scope unless separately approved.
3. **Keep local:** create a new operation based on the current remote revision; do not replay the stale operation unchanged.
4. **Use remote:** update the local working copy only after the conflict and choice are durably recorded.
5. Preserve the original snapshots and an append-only resolution record. If resolution fails, leave the conflict recoverable and visible.
6. If remote state changes again during resolution, detect the new revision mismatch and return to review; do not force the old choice over the new remote version.

Exact review UI and audit-retention period remain under O-003.

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

Provider-native allow/deny tests must run only after provider, isolated non-production environment, test identities, policy boundary, and cost/no-billing scope are approved. The existing fake-remote spike is not evidence of real provider authorization.

## 7. Out of scope for this contract

- Full account-management UI, team roles, and multi-business administration.
- Menu, inventory, purchasing, sales, finance, and AI workflows.
- Automatic field-level conflict merge.
- Delete/restore semantics until tombstones, authorization, and offline deletion behavior are specified.
- Provider-specific SDK, schema migrations, deployment, or provisioning decisions.

## 8. WP1.1 gate checklist

- [ ] Owner accepts or revises the Business Profile fields/validation (O-002).
- [ ] Owner accepts or revises the conflict review and resolution expectations (O-003).
- [ ] Owner decides local-data retention/locking/encryption and account-switch/sign-out behavior (O-004).
- [ ] Owner chooses provider/hosting/region and approves a no-billing test scope or explicit spend boundary (O-001, O-005).
- [ ] Provider-specific server-side authorization tests and export/restore plan are prepared and evidenced.
- [ ] Decision log and status are updated with actual decisions and evidence.

Until these gates are met, WP1.1 remains **In progress** and WP1.2 remains **Not started**. Do not create a cloud project, enable billing, add provider SDKs, or start application scaffolding on the strength of this proposal alone.
