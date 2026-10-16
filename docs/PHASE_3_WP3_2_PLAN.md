# Phase 3 WP3.2 — Atomic Inventory Command Contract & Idempotent Posting

**Status:** Planning proposal only; no WP3.2 runtime code is implemented.  
**Prerequisite:** WP3.1 foundation merged; confirm post-merge main Supabase regression before implementation.  
**Planning rule:** this document proposes a bounded next work package. It does not silently resolve the owner decisions listed below and does not authorize hosted infrastructure, billing, secrets, or production deployment.

## Goal

Create a trusted database-side command boundary for inventory ledger writes so one logical inventory command either commits all of its related records or commits none. A retry with the same command ID and same canonical payload must not duplicate stock movements, finished lots, or lot allocations.

## Proposed scope

1. **Command contract**
   - Define a versioned, validated command envelope with stable command ID, authenticated owner/business scope, command type, and canonical payload.
   - The database derives owner identity from the authenticated session; client-supplied owner IDs are never authorization.
   - Reusing a command ID with the same canonical payload returns the original durable outcome. Reusing it with a different payload is rejected as an idempotency-key misuse.
   - Do not treat JavaScript floating-point values as exact inventory quantities; use the WP3.1 decimal-string contract and the guarded recipe adapter only where explicitly applicable.

2. **Atomic server boundary**
   - Implement a narrowly scoped RPC/function using an explicit, reviewed privilege model and fixed search path.
   - In one transaction, validate and write the command result and all permitted stock movement, finished-lot, and lot-allocation rows.
   - Preserve append-only movement history and existing lot/output/allocation constraints.
   - Keep direct client writes to inventory ledger tables denied. A client must not bypass the trusted command boundary.
   - Ensure failures roll back the command result and every related ledger row.

3. **Retry and integrity behavior**
   - Test exact replay of the same command and payload.
   - Reject same ID/different payload.
   - Reject unauthenticated and cross-owner commands.
   - Reject invalid units, invalid stock class, mismatched production-output/lot linkage, and incorrect finished-lot allocation sums without partial writes.
   - Test concurrent or interleaved duplicate requests if the local Supabase test harness can exercise them deterministically; document any concurrency guarantee that cannot be tested locally.

4. **Compatibility and migration**
   - Use additive migrations only; preserve Phase 1/2 behavior and existing IndexedDB v2→v3 data.
   - Keep existing recipe-line numeric values unchanged. Do not silently convert or rewrite legacy recipe quantities.
   - Keep the RPC transport injectable/testable and local-Supabase-only; do not enable inventory sync in the Phase 2 sync engine as a side effect.

## Explicit non-goals

- Production-batch workflow that consumes recipe ingredients and creates finished lots.
- Inventory UI, purchasing/receiving UI, sales/order workflow, revenue recognition, costing, or accounting.
- FIFO assumptions, automatic unit conversion, automatic carry-over safety decisions, or silent negative-stock behavior.
- Inventory sync/conflict resolution across devices.
- Hosted Supabase provisioning, paid plan/billing activation, production secrets, or deployment.

## Blocking owner decisions before implementation

1. **Negative stock:** when a proposed outflow exceeds available stock, should posting be rejected, or should the ledger allow a negative balance with a visible warning? This affects transaction invariants and recovery.
2. **Production recipe basis:** when production posting is later implemented, should ingredient consumption use the recipe version/quantities captured when the batch is started, or the current active recipe at posting time? The safe default is to snapshot the exact recipe inputs at batch start, but this remains an owner decision and is not implemented here.
3. **Correction policy:** confirm whether a posted command is corrected only by a linked reversal/correction command rather than editing/deleting historical rows. The existing append-only ledger points toward reversal/correction; confirm before exposing UI.

No answer is assumed by this plan. WP3.2 implementation should remain blocked on these decisions, while tests and contract refinement can be reviewed.

## Acceptance criteria

- [ ] Authenticated owner/business scope is derived and enforced by the database.
- [ ] Inventory tables remain inaccessible for direct client insert/update/delete; only the approved RPC can post.
- [ ] Same command ID + same canonical payload returns the durable original result and produces no duplicate ledger rows.
- [ ] Same command ID + different payload is rejected and does not mutate state.
- [ ] Movement, lot, allocation, and command-result writes are transactionally atomic; any invalid row rolls back the entire command.
- [ ] RLS/cross-owner/unauthenticated tests pass using local Supabase Auth/Postgres.
- [ ] Negative tests cover invalid quantity/unit/stock class, lot linkage, allocation exact sum, and idempotency mismatch.
- [ ] Retry/concurrency behavior is tested or its local-test limitation is documented explicitly.
- [ ] Existing Phase 1/2 sync, data migrations, recipe data, build, and browser regression tests remain green.
- [ ] Final-head CI is green; full diff and security/privilege model are reviewed.
- [ ] No hosted resource, billing, secret, or production deployment is introduced.

## Proposed downstream sequence (not yet approved)

- **WP3.3 — Production Batch Posting:** snapshot the selected recipe inputs; atomically consume ingredient stock and create finished lots with traceable links.
- **WP3.4 — Finished-Stock Dispositions & Carry-over:** sale, owner consumption, giveaway, waste, discounting, and safe carry-over as distinct outcomes with quantity/time/reason/price where applicable; personal use and giveaways are not revenue.
- **WP3.5 — Local-first Inventory Commands & Sync/Conflict Review:** durable local command queue, stable IDs, retry/recovery, owner partitioning, and explicit conflict preservation after trusted remote semantics are proven.
- **WP3.6 — Inventory UI & Operational Integration:** bounded screens and operator workflows once command and domain contracts are accepted.
- **WP3.7 — Phase 3 Integration & Exit Review:** migrations, end-to-end regression, data recovery, known limitations, and owner acceptance.

This sequence is a planning proposal only. Reorder it if dependency review shows that local-first command capture should precede the remote RPC; do not implement inventory sync before the trusted atomic contract and conflict behavior are verified.


## Current-state reconciliation — 2026-10-16

This planning document is preserved for design history; its original base commit and implementation status are historical. The current repository status is summarized in [`PHASE_3_CURRENT_STATUS.md`](./PHASE_3_CURRENT_STATUS.md) and [`WP_REGISTRY.md`](./WP_REGISTRY.md). The atomic inventory command foundation is merged via PR #41; the production workflow is implemented through PRs #43, #45, #46, and #49. Do not treat this proposal as authorization to reimplement those features or override the current runtime/domain contracts. Phase 3 completion remains conditional on the current exit review and deferred manual acceptance gates.
