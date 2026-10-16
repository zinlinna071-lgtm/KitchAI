# Phase 3 WP3.1 — Repository Review Findings

**Review date:** 2026-10-13  
**Review mode:** Read-only review of the Phase 3 proposal and repository source on `docs/phase-3-production-inventory-plan`  
**Verdict:** **NEEDS CONTRACT CLARIFICATIONS BEFORE WP3.1 IMPLEMENTATION PROMPT**  
**Implementation status:** Not started. This report does not authorize runtime changes.

## 1. Scope and evidence inspected

Read the Phase 3 plan and domain contract, Phase 2 domain contract, decision log, status, work-package registry, Coding AI review handoff, and these implementation files:
- `src/business-data-store.js`
- `src/phase2-sync-engine.js`
- `src/recipe-store.js`
- `package.json`

This was a source/document review, not an executed test run. No application tests were run for this report, and no runtime files were changed.

## 2. Repository facts verified

1. **Consolidated business database:** `src/business-data-store.js` opens IndexedDB `kitchai-business-data` at version 2. Current stores are `ingredients`, `menuItems`, `recipes`, `recipeLines`, `operations`, `syncMetadata`, `metadata`, `migrationLedger`, and `conflicts`.
2. **Scoped identity:** business entities use compound `ownerId/businessId/id` keys and scope indexes. Outbox operations use stable `operationId`; sync metadata is keyed by owner, business, entity type, and record ID.
3. **Legacy migration is active behavior:** on open, the business store reconciles records from legacy Phase 2 databases, preserves source records, records migration-ledger snapshots, and queues entity sync operations. Migration collisions abort and preserve data for review. Phase 3 upgrades must not bypass this behavior.
4. **Current sync entity set is bounded:** `src/phase2-sync-engine.js` defines mappings only for `ingredient`, `menuItem`, `recipe`, and `recipeLine`. A new entity is not remotely supported just because a local store or outbox row exists.
5. **Dependency support exists but is not a business transaction:** the business store can record dependencies among entity operations, and the Phase 2 sync engine checks whether dependencies are synced. This orders separate entity operations; it does not prove several stock effects are committed atomically on a remote server.
6. **Unit vocabulary:** `src/recipe-store.js` accepts exactly `g`, `kg`, `ml`, `l`, and `each`; it validates recipe quantities as finite and positive. There is no conversion layer in this file.
7. **Checks available:** `package.json` defines `npm test`, `npm run typecheck`, `npm run build`, `npm run check`, and `npm run check:pages-preview`. The current `check` script's explicit `node --check` list is enumerated; new modules should be included or otherwise covered by typecheck/tests/build as appropriate.
8. **Current PR scope:** comparison against `main` showed the proposed PR changes only `docs/` files; this review added no runtime implementation.

## 3. Findings and required clarifications

### Critical — C1. Define the atomic production-posting boundary across local and remote sync

The domain contract correctly requires ingredient consumption and finished output to succeed together or neither to succeed. The existing Phase 2 sync engine sends individual entity operations with dependency ordering; dependencies alone do not make a multi-record production batch atomic on the server.

**Required clarification:** define production completion as one idempotent business command/aggregate operation at the remote transaction boundary (for example, one server-side transaction/RPC that validates and posts the batch plus all movements), or explicitly defer remote production posting until such a mechanism is designed. On the local side, the batch status, ingredient movements, finished output/lot, and outbox command must be committed in one IndexedDB read-write transaction. A partial remote outcome must be queryable/recoverable by the same idempotency key. Do not assume several ordinary entity upserts satisfy this invariant.

### Critical — C2. Declare the canonical source of stock truth

The contract permits stock to be calculated from movements or kept as a cache, but implementation cannot proceed safely while the canonical source is left unspecified.

**Required clarification:** recommend an append-only stock-movement ledger as the canonical audit source; if on-hand balances are cached for display/performance, define them as rebuildable projections and test ledger-to-projection reconciliation. The owner/implementation review must explicitly accept this design before runtime schema work. Do not allow editable balances to drift independently from movements.

### High — H1. Define movement quantity semantics, correction semantics, and sign validation

The contract allows either signed quantities or direction plus positive quantities. That flexibility is useful for planning but unsafe for implementation if every caller chooses independently.

**Required clarification:** select one representation before implementation and define positive input quantity, inbound/outbound direction, zero rejection, adjustment sign, and reversal links. A correction must be a new event that references the corrected event/count and preserves the original; do not edit a posted movement. Exact precision and fractional `each` remain gated by D3-02.

### High — H2. Define production/finished-lot identity and disposition allocation

The contract requires traceability to production batch and says lots should not be merged if traceability is lost, but it does not yet define how one disposition selects stock when a menu item has multiple batches, or how partial quantities across lots are represented.

**Required clarification:** every finished-stock reduction must reference one or more specific lot/batch allocations, with allocated quantities summing exactly to the disposition quantity. If allocation policy (such as operator selection or automatic oldest-first) is not decided, require explicit lot selection and defer automated allocation. Do not infer food-safety eligibility from a lot's age.

### High — H3. Make migration compatibility an explicit schema gate

The current database is version 2, and `createSchema` creates missing stores/indexes during `onupgradeneeded`; it does not change an already-open v2 database's version. Adding stores/indexes requires a versioned upgrade and careful preservation of legacy migration/outbox/conflict state.

**Required clarification:** any schema proposal must state the target version and upgrade steps, and tests must start from a populated v2 fixture. Verify all existing stores and indexes, records, operations, sync metadata, conflicts, migration-ledger entries, and legacy-source preservation survive upgrade; also test interruption/blocked-upgrade behavior as practical. Do not simply test a fresh empty database.

### High — H4. Clarify how append-only movements participate in sync conflict handling

Existing sync conflicts are organized around entity record snapshots/revisions. Append-only events have different semantics from mutable catalog records; treating two distinct movements as one mutable entity can lose an event, while blindly accepting duplicates can double-apply stock.

**Required clarification:** use globally stable movement/command IDs and server-side idempotency; distinguish duplicate delivery of the same ID from two different valid movements. Conflicting edits to a posted event should be rejected/preserved for review, not merged as quantity arithmetic. Decide how the user sees and resolves aggregate stock conflicts under D3-11 before implementation.

### Medium — M1. Specify cross-record scope and referential validation

The contract states that references must remain within a business scope. Tests and transaction logic need to enforce this for purchase lines, ingredient movements, batch recipe/menu item references, consumption lines, output lots, dispositions, counts, and corrections. A valid UUID alone is not evidence that a referenced record belongs to the active owner/business.

### Medium — M2. Separate timestamps and business dates

The contract mentions effective and creation timestamps but does not yet define timezone/business-day behavior for production, close-of-day carry-over, or correction backdating. Preserve UTC instants for audit; if a local business date is needed, store/derive it under an explicit timezone rule and never silently rewrite historical dates.

### Medium — M3. Keep cost-input recording separate from valuation

Purchase cost fields are proposed but currency, tax, shipping, unit-cost normalization, and treatment of partial receipt are still open under D3-01/D3-10. Store raw traceable inputs only after required fields are defined; do not display official valuation/COGS/profit from unapproved assumptions.

## 4. Suggested contract additions (proposals, not owner decisions)

Before coding, add explicit invariants equivalent to:

1. **Canonical ledger:** posted stock movements are the canonical audit record. Any current-balance table/cache is a rebuildable projection and must reconcile against the ledger.
2. **Local atomic post:** one IndexedDB transaction writes the completed production command, all ingredient-out movements, finished lot/output movement, and its durable outbox command; transaction failure writes none of these.
3. **Remote atomic post:** one idempotent server-side command commits the batch and all related stock effects in one database transaction. Individual dependency-ordered upserts are not an acceptable substitute.
4. **Idempotency identity:** retrying the same command ID returns/reconstructs its original result and does not add any movement twice; distinct command IDs remain distinct events even when their quantities are equal.
5. **Lot allocation:** every finished stock decrease allocates its quantity to explicit lot IDs, and the sum of allocations equals the posted disposition quantity exactly under the selected precision rules.
6. **Correction linkage:** a correction records the source count/movement, actor/context where available, reason, and a new event ID; original posted events remain unchanged.
7. **Scope:** every reference is validated against the active owner/business scope before posting, both locally and at the trusted server boundary.
8. **Upgrade:** schema/store changes are not approved until populated-v2 migration and recovery tests pass without losing legacy source records, queued operations, conflicts, or migration ledger state.

These are contract clarification proposals. C1/C2 and H1–H4 should be reconciled in the domain contract before a runtime implementation prompt is issued.

## 5. Test matrix

| Invariant | Positive case | Negative / edge case | Expected result | Suggested test layer | Decision / dependency |
|---|---|---|---|---|---|
| Existing data survives upgrade | Open populated v2 DB using proposed new version | Existing conflict/outbox/migration entry omitted or collision occurs | Preserve all prior stores and records; fail safely on unresolved collision | IndexedDB integration | Migration proposal required |
| Purchase does not affect stock until receipt | Draft, then receive actual quantity | Cancel draft or retry same receipt ID | Draft/cancel has no movement; duplicate receipt has one stock effect | Unit + IndexedDB integration | D3-04 for partial/cancel edge rules |
| Production is atomic locally | Post batch with two ingredients and output | Force a validation/transaction failure after scheduling writes | Either all batch/movement/outbox writes commit, or none | IndexedDB integration | D3-03, D3-05 |
| Production is atomic remotely | Submit same batch command twice | Lost acknowledgement then retry; server error during posting | One committed batch and one set of movements, or no partial effects | Local Supabase/SQL integration | Remote command/RPC design required |
| Insufficient stock follows explicit rule | Batch quantity is within stock | Batch requires more than recorded stock | Outcome matches owner-approved policy; never silently goes negative | Unit + integration | D3-03 OPEN |
| Actual use/output preserved | Record values different from recipe baseline | Missing/zero/invalid actual value | Store actuals and variance; reject values contrary to validated rules | Unit + IndexedDB integration | D3-05; precision D3-02 |
| Lot allocation balances | Disposition allocated to one or more lots | Allocations do not sum to disposition quantity or reference another business | Reject posting, no stock effect | Unit + IndexedDB integration | D3-02 and lot-selection policy |
| Carry-over does not duplicate stock | Mark existing lot quantity as carry-over | Repeat carry-over action with same command ID | No new stock-in movement or production batch; duplicate command has no effect | Unit + IndexedDB integration | D3-06 OPEN |
| Disposition categories remain distinct | Regular sale, discount, consumption, giveaway, waste | Attempt to record free giveaway as revenue or carry-over as waste | Correct category, quantity effect and revenue semantics; reject invalid combinations | Unit + browser integration | D3-07, D3-08 |
| Correction preserves history | Post count variance with reason | Missing reason or attempt to edit old movement | New linked adjustment only; old event unchanged | Unit + IndexedDB integration | D3-09 OPEN |
| Scope isolation | Reference records in same business | Use a valid ID from another owner/business | Reject before posting locally and at server boundary | IndexedDB + local Supabase/SQL | Server schema/policies required |
| Sync duplicate vs distinct events | Retry same movement command ID | Two different command IDs with equal quantity | Same ID is applied once; distinct valid IDs remain distinct | Unit + local Supabase/SQL | D3-11 and server idempotency |
| Conflict preserves competing state | Submit stale batch/stock state | Concurrent stock-changing commands | Preserve conflict/snapshots; no silent merge or double-application | IndexedDB + local Supabase/SQL + browser | D3-11 OPEN |
| Food safety not inferred | Operator confirms carry-over per procedure | App attempts automatic “safe” result based only on age | Require explicit confirmation; no safety claim from elapsed time alone | Unit + browser | D3-06 OPEN |
| Existing regression suite remains green | Run `npm run check` and `npm run check:pages-preview` | Any prior Phase 1/2 regression fails | Fix before marking WP complete; report exact CI evidence | CI + browser as applicable | All WPs |

## 6. Owner decisions still open

Owner policy selections D3-01–D3-11 were recorded as Selected on 2026-10-13 after the owner chose the recommended checklist defaults. The contract review must preserve those selections; it must not silently expand them into technical architecture approval.

- **D3-01:** costing method/allocation; gates official inventory valuation, COGS, profit and how cost inputs are interpreted.
- **D3-02:** quantity precision, rounding and fractional `each`; gates quantity storage/comparison and exact allocation equality.
- **D3-03:** insufficient stock behavior; gates production posting when recorded stock is inadequate.
- **D3-04:** partial receipt/cancellation; gates purchase/receipt state transitions.
- **D3-05:** theoretical recipe quantities vs actual use/output; gates required actual fields and variance behavior.
- **D3-06:** carry-over/shelf-life confirmation; gates operator flow and any reviewed rule presentation, not automatic safety claims.
- **D3-07:** all sale/discount capture is deferred to Phase 4; Phase 3 must support non-sale dispositions without a temporary sales ledger or inferred revenue.
- **D3-08:** reason requirements for owner consumption, giveaway, waste and adjustments; gates required validation fields.
- **D3-09:** physical-count correction confirmation/permissions; gates posting workflow and authorization.
- **D3-10:** supplier and purchase cost/tax/shipping/currency fields; gates purchase schema and cost input semantics.
- **D3-11:** sync conflict UX/resolution for stock events; gates aggregate conflict model and resolution behavior.

## 7. Implementation gate checklist

- [ ] Owner accepts or amends the canonical stock-ledger proposal and its rebuild/reconciliation rule.
- [ ] Local and remote production-posting atomicity are designed separately and end-to-end idempotency is specified.
- [ ] Movement quantity/sign and correction/reversal semantics are unambiguous.
- [ ] Finished lot allocation and partial disposition behavior are specified.
- [ ] IndexedDB version upgrade and legacy migration preservation plan is documented and testable.
- [ ] New sync operation types, dependency ordering, server SQL/API/RLS, and conflict handling are mapped to the actual repository.
- [x] D3-01–D3-11 owner policy directions are recorded in `docs/DECISIONS.md`.
- [ ] Independent technical recommendations and precision/time rules are reviewed and testable.
- [ ] Test fixtures cover populated v2 migration and existing regression behavior.
- [ ] The owner separately authorizes a bounded runtime implementation prompt.
- [ ] No hosted resources, billing, production secrets, or deployment are assumed.

**Conclusion:** WP3.1 is not yet ready for a runtime coding prompt. The follow-up [Technical Gate Reconciliation](./PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md) now maps source files to candidate designs and acceptance evidence. Owner policy selections are recorded, but technical architecture review and a test-backed quantity/time specification remain outstanding. This report is not evidence that tests were executed and does not mark WP3.1 complete.


## Current-state reconciliation — 2026-10-16

This document was written during the initial Phase 3 planning/repository-review period. Treat its initial recommendations, pending gates, and baseline commit references as historical unless they are confirmed by current code and tests. Inventory foundation, guarded recipe quantity adapter, atomic inventory commands, purchasing/receiving, production lifecycle/posting, finished-stock disposition, and stock counts have since been implemented in merged slices. See [`PHASE_3_CURRENT_STATUS.md`](../PHASE_3_CURRENT_STATUS.md) for current status and [`WP_REGISTRY.md`](../WP_REGISTRY.md) for implementation evidence. The current code, database migrations, current decisions, and latest test contracts take precedence over any outdated proposal here. Phase 3 is not declared complete; manual device/offline/accessibility/recovery acceptance remains deferred, and hosted provisioning/billing/secrets/production deployment are not authorized.
