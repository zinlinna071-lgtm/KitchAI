# Phase 3 WP3.3 — Production Workflow Plan

**Status:** Planning proposal; not implementation approval.
**Planning base originally inspected:** `main` at `723f73f774be4377b462cc1e68f0a269f489cfcf`.
**Current dependency status (2026-10-14):** WP3.2 trusted atomic inventory commands were merged with owner authorization in [PR #41](https://github.com/zinlinna071-lgtm/KitchAI/pull/41), merge commit `81fafdd9ce69a72c909acb839177df95e2f83561`. Both PR-head database/authorization and vertical-slice workflows passed on final code commit `cbdf001278b4794dc1183ad4942a915425bc2c4f`; post-merge `main` workflows are running. Do not begin WP3.3 implementation until those post-merge checks pass.
**Owner-confirmed rules:** recipe snapshot at batch start; reject negative stock; append-only ledger with linked reversal/correction. See PR #41's `docs/PHASE_3_WP3_2_OWNER_DECISIONS.md`.

## Goal

Deliver a small, auditable production workflow that converts a started recipe batch into ingredient-consumption movements and a finished-product lot, using the exact recipe snapshot captured at batch start. The workflow must remain safe during retries and must never invent precise quantities for ingredients recorded only as “to taste” or estimates.

## In scope

- Start a production batch from an active menu item/recipe and capture an immutable recipe/version snapshot.
- Preserve stable recipe-line identity and ordering separately.
- Record planned yield, actual output quantity, unit, start/completion times, and operator-entered actual ingredient usage.
- Distinguish exact recipe quantities, verified ingredient-specific kitchen-unit conversions, and to-taste/estimated quantities.
- Require actual measured usage or an explicitly accepted estimate policy for stock-affecting consumption; never silently turn “to taste” into exact grams/millilitres.
- Complete a batch by submitting ingredient outflows, finished output movement, finished lot, and all required identifiers in one trusted atomic inventory command.
- Reject insufficient ingredient stock and roll back the entire posting; do not create partial consumption or output.
- Make completion idempotent and recoverable after network interruption.
- Keep the batch snapshot stable if the recipe is edited after batch start.
- Support a clear draft/started/completed/failed-to-post/cancelled lifecycle, with failed posting remaining retryable and not being represented as completed.
- Preserve traceability from batch to recipe snapshot, stock movements, finished lot, and eventual sale/owner consumption/giveaway/waste disposition.

## Out of scope

- Shared-consumable pool costing, allocation of gas/oil/salt/MSG across menus, and full cost-of-goods reporting.
- Supplier/purchasing UI or changes to WP3.2's inventory ledger contract.
- AI recipe generation or automated ingredient estimation.
- Automatic FIFO lot selection unless explicitly designed and owner-approved; the UI must require explicit lot allocations for finished-stock reductions.
- Multi-user production roles, team management, hosted provisioning, paid infrastructure, deployment, or production secrets.
- Revenue recognition or sales pricing logic inside the inventory ledger.

## Proposed work packages

### WP3.3.1 — Recipe snapshot and quantity contract

- Define a versioned snapshot structure containing recipe/menu identity, stable line IDs, ingredient IDs, raw operator instructions, quantity mode, quantity/unit, conversion provenance where applicable, and snapshot timestamp.
- Capture snapshot atomically when the batch starts; subsequent recipe edits only affect future batches.
- Keep presentation position independent from line identity.
- Preserve exact decimal quantities without floating-point rounding. Reject unsupported precision/range rather than silently rounding.
- For “to taste” or estimated quantities, preserve the text and estimate state; do not claim exact stock or cost values without measured usage or a reviewed policy.

**Acceptance:** tests prove snapshot immutability across recipe edits, stable line identity/order behavior, strict decimal validation, and truthful handling of unknown/estimated quantities.

### WP3.3.2 — Batch lifecycle and actual usage

- Define legal state transitions and required fields for start, completion, cancellation, and failed posting/retry.
- Record actual ingredient usage separately from recipe targets.
- Require a clear operator action when actual use differs from the target or an estimated quantity remains unmeasured.
- Prevent edits to the snapshot after start; use explicit batch events for corrections.
- Prevent completion without a valid snapshot, valid output quantity/unit, and all required actual-usage decisions.

**Acceptance:** transition tests reject invalid state changes and incomplete batches; offline reload preserves in-progress batch state without duplicate batches.

### WP3.3.3 — Atomic production posting

- Build the command from the immutable snapshot plus actual usage.
- In one trusted server transaction, post ingredient consumption, finished output, and the corresponding finished lot; ensure the stock movements and lot share stable batch/event IDs.
- Use a stable command ID for retries; same ID and same payload returns the original result, while a different payload is rejected.
- Insufficient ingredient stock rejects the whole command; no ingredient outflow, output movement, lot, or completed status is left behind.
- Keep offline drafts local until online posting is possible; do not claim a batch is cloud-posted while it is only queued locally.
- Add tests for duplicate submission, interrupted retry, insufficient stock, changed recipe after start, malformed payload, cross-owner access, and atomic rollback.

**Acceptance:** database tests prove atomicity and idempotency; browser tests cover the batch workflow online/offline and after reload; build/type/syntax checks pass.

### WP3.3.4 — Finished output traceability and handoff

- Display produced quantity and remaining lot quantity derived from the ledger.
- Ensure all finished-stock reductions use explicit lot allocations whose total exactly matches the movement.
- Represent sold, discounted sale, owner consumption, giveaway, waste/discard, and carry-forward as distinct business outcomes connected to the relevant finished stock. Personal consumption and giveaway are not sales revenue.
- Carry-forward is an inventory-handling decision, not a new production output. Only carry safe/suitable items forward; record disposition quantity and date/time, and reason/price when relevant.
- Do not build shared ingredient costing in this WP; leave a clear integration boundary for its later phase.

**Acceptance:** tests verify exact lot balances and that sale, owner consumption, giveaway, waste, and carry-forward are not conflated. Any pricing/revenue remains in the sales domain.

## Required implementation sequence

1. Confirm post-merge `main` CI for WP3.2 merge commit `81fafdd9ce69a72c909acb839177df95e2f83561` passes, and retain the SQL contract/security review notes. PR #41 is already merged with owner authorization.
2. Confirm the exact recipe and menu data contract currently present in `main`; do not assume a recipe version field exists without inspection.
3. Implement WP3.3.1 and its tests first.
4. Implement WP3.3.2 lifecycle and local persistence.
5. Implement WP3.3.3 atomic posting against the approved WP3.2 RPC contract.
6. Implement WP3.3.4 traceability and focused end-to-end tests.
7. Review migration safety, authorization, offline/retry semantics, and complete CI before marking WP3.3 done.

## Current-main data-contract review (2026-10-14)

The current Phase 2 implementation was inspected before planning implementation:

- `src/recipe-store.js` stores recipe identity, menu-item ID, name, instructions, yield, status, and timestamps. It has no durable recipe revision/version field.
- Recipe lines already have stable record IDs, plus recipe ID, ingredient ID, JavaScript-number quantity, unit, position, optional note, and timestamps. Position is sortable presentation metadata; it must not be used as line identity.
- Recipe and recipe-line changes are persisted in separate IndexedDB transactions and enqueued as separate sync operations. The current line contract has no quantity mode for “to taste”, verified conversion provenance, or actual batch usage.
- `src/recipe-quantity-adapter.js` intentionally rejects quantities that cannot be represented as plain decimal values with at most six fractional digits; WP3.3 must retain that no-silent-rounding behavior.

**Implementation consequence:** do not label `updatedAt` as a recipe version or rely on it alone as a concurrency token. WP3.3.1 must define an immutable, content-bearing batch snapshot with a stable snapshot ID/hash or explicit revision record, preserving the exact line IDs and captured values. Snapshot creation must read recipe plus lines as one consistent operation and persist the snapshot/batch atomically in local storage. The implementation must also define how cloud sync/conflict handling protects a started batch from later recipe edits, and add quantity modes without breaking existing Phase 2 records. These are required design tasks, not already-implemented behavior.

## Risks and unresolved gates

- The current recipe model may not have a durable version identifier. If so, define a compatible immutable snapshot/version strategy before writing production code.
- Actual usage for “to taste” ingredients is inherently uncertain until measured. The interface must preserve uncertainty rather than create false precision.
- The current inventory RPC bounds movement/lot/allocation array counts (200/200/500) and uses a fixed unit allowlist. Confirm batch size limits and unit semantics before generating multi-ingredient commands.
- WP3.2 now explicitly preserves movement-array order and has a regression test proving a receipt can fund a later outflow within one atomic command.
- Finished stock allocation is explicit; do not silently implement FIFO.
- WP3.2 currently constrains correction/reversal to one exact, single linked reversal. Confirm whether this satisfies future correction workflows before extending it.
- Any schema change requires additive migration and tests against existing Phase 1/2 data.
- No paid services, production deployment, secrets, or merge actions are authorized by this planning document.

## Definition of done

- All required states and stock effects are documented and covered by automated tests.
- Recipe snapshot is immutable after batch start and is the source for production consumption.
- No negative stock, partial posting, duplicate retry effects, or silent quantity rounding.
- Every finished output is traceable to one batch and finished lot; every reduction has exact lot allocation.
- Online/offline/retry states are honest and recoverable.
- Relevant CI passes on the final commit, the diff is reviewed, and remaining limitations are recorded.


## Current-state reconciliation — 2026-10-16

This planning document is preserved for design history; its original base commit and implementation status are historical. The current repository status is summarized in [`PHASE_3_CURRENT_STATUS.md`](./PHASE_3_CURRENT_STATUS.md) and [`WP_REGISTRY.md`](./WP_REGISTRY.md). The atomic inventory command foundation is merged via PR #41; the production workflow is implemented through PRs #43, #45, #46, and #49. Do not treat this proposal as authorization to reimplement those features or override the current runtime/domain contracts. Phase 3 completion remains conditional on the current exit review and deferred manual acceptance gates.
