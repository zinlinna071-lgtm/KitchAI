# Phase 3 Domain Contract — Purchasing, Inventory & Production

**Status:** Logical contract reconciled with owner-selected D3-01–D3-11 and T3-01–T3-08 directions; implementation still requires bounded WP3.1 review and passing tests. This is not authorization for hosted provisioning or production deployment.  
**Parent plan:** [PHASE_3_PLAN.md](./PHASE_3_PLAN.md)  
**Compatibility:** Preserve Phase 1 owner partitioning, local-first persistence, outbox/idempotency, explicit conflict review, and Phase 2 ingredient/menu/recipe behavior.

## 0. Repository-grounded implementation baseline (reviewed 2026-10-13)

The current application files on the PR branch are unchanged from the PR's base application-code commit; the branch changes documentation only. The following current implementation facts were checked to ground the logical contract:

- `src/business-data-store.js` uses IndexedDB database `kitchai-business-data`, schema version 2. It owns the consolidated Phase 2 entity stores `ingredients`, `menuItems`, `recipes`, and `recipeLines`, plus `operations`, `syncMetadata`, `metadata`, `migrationLedger`, and `conflicts`. Entity records use compound `ownerId/businessId/id` keys and scope indexes.
- The consolidated business-data store includes a migration ledger for moving records from legacy Phase 2 databases. Phase 3 must preserve the migration ledger and legacy-data migration behavior; do not create another unrelated inventory database by default.
- `src/phase2-sync-engine.js` currently maps only Phase 2 entity types: `ingredient`, `menuItem`, `recipe`, and `recipeLine`. New purchasing/stock/production types are not automatically synced by this engine; extending entity mappings, dependency ordering, conflict handling, and transport/server schema must be a bounded implementation task with tests.
- `src/recipe-store.js` uses the exact unit allowlist `g`, `kg`, `ml`, `l`, and `each`, with no conversion. Phase 3 must reuse this policy rather than invent a parallel unit vocabulary.
- `src/sync-store.js` separately owns the Phase 1 profile sync database `kitchai-sync` v2, while `src/local-store.js` owns `kitchai-local` v1. Database versions are independent. Do not bump or repurpose those databases unless the existing code owner and migration rationale specifically require it.
- `package.json` provides `npm test`, `npm run check` (syntax/type/tests/build), `npm run build`, and `npm run check:pages-preview`. Implementation must use the current scripts and add focused tests using repository conventions.
- The local sync architecture is transport-injected and currently tested without hosted credentials. Phase 3 local/emulated tests must not be described as proof of hosted authorization or real cross-device sync.

**Implementation direction for review, not an approved schema:** prefer extending the consolidated business-data store and existing owner-scoped outbox/sync patterns over creating independent stores or a second sync engine. The exact store/index additions, migration version, remote SQL/API mapping, and transaction boundary must be documented and tested before code is changed.

## 0.1 Owner-selected technical contract — 2026-10-13

The owner accepted T3-01–T3-08 in [DECISIONS.md](../DECISIONS.md). The technical baseline below is selected for WP3.1 implementation planning. It remains subject to repository compatibility checks and tests; any material deviation must stop for owner review. See the [Technical Gate Reconciliation](../PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md) for source mapping and the [WP3.1 implementation prompt](../CODING_AI_PHASE3_WP3_1_IMPLEMENTATION_PROMPT.md) for bounded execution instructions.

### PC-1 — Canonical stock truth
- The append-only stock-movement ledger is the canonical explanation of stock changes. On-hand balances are derived/rebuildable projections, not a competing source of truth.
- Define opening-stock events, event ordering, linked reversals/corrections, and a visible reconciliation failure state. Do not erase or rewrite posted history.

### PC-2 — Atomic production posting
- Local completion must commit the production batch, ingredient-consumption movements, finished-lot/output movement, lot allocations, and durable outbox operation(s) together in one IndexedDB transaction, or commit none.
- Remote application of the same business action must use one trusted server-side transaction/RPC or equivalent atomic aggregate command. Ordered independent upserts are not atomic posting.
- The stable aggregate operation ID must make retries idempotent, including lost acknowledgements. Insufficient stock, scope violations, or any validation error must leave the aggregate unapplied.

### PC-3 — Movement representation and correction
- A posted movement has a defined kind/direction and a strictly positive exact quantity in an allowed unit. Reject zero, negative, malformed, overflow, and incompatible-unit values.
- Corrections/reversals are new stable-ID events linked to the original event where applicable. Never edit/delete posted movements to conceal history.
- Preserve the existing unit allowlist `g`, `kg`, `ml`, `l`, `each`; do not introduce conversions.

### PC-4 — Finished-lot allocation
- Every finished-stock reduction identifies its lot or explicit lot allocations. Every allocation is positive and compatible; allocation quantities must sum exactly to the disposition quantity.
- Do not silently select FIFO/oldest lot. Carry-over references the same lot and creates no new stock or production event.
- Carry-over requires operator confirmation of suitability. The app must not infer food safety from age/timestamps; any expiry rule requires a separately reviewed policy.

### PC-5 — Exact quantity arithmetic
- Domain/API quantity values use exact decimal strings; internal calculations use exact scaled-integer arithmetic with six fractional decimal places. Reject more than six fractional places; never silently round. Proposed remote numeric storage is PostgreSQL `numeric(24,6)`.
- Fractional `each` is allowed for ingredient quantities; finished-product stock measured in `each` must be whole-number.
- Before migration, verify compatibility with existing Phase 2 recipe-line values and all relevant validation paths. Test bounds, overflow, arithmetic, exact allocation sums, and round-trip persistence. Do not silently reinterpret or round legacy recipe data.

### PC-6 — UTC timestamps and deferred business-day rules
- `createdAt`/`recordedAt` and `effectiveAt` use ISO 8601 UTC timestamps.
- Authoritative business-day/timezone summaries and automatic expiry rules are deferred until a business timezone/rule is explicitly reviewed. Display formatting must not change stored instants.

### PC-7 — Additive migration and event identity
- Extend the existing `kitchai-business-data` database through a versioned additive v2→v3 upgrade; do not create a parallel inventory database or bump unrelated Phase 1 databases.
- Preserve every v2 store, record, index, operation/outbox entry, sync metadata, conflict snapshot, metadata record, migration-ledger entry, and legacy source record.
- Test from a populated v2 fixture, including success, upgrade failure, reopen/restart, and idempotent retry. Migration failure must not silently delete/overwrite source data.
- Same stable event/operation ID means retry and applies once. Distinct IDs are distinct events; competing stock changes must remain durably preserved for explicit review and never be silently auto-merged.

### PC-8 — Scope, remote trust, and costing boundary
- Validate every referenced record against the same owner/business scope locally and again at the trusted server boundary. The server derives owner scope from authenticated identity; never trust a client-supplied owner ID as authority.
- Remote aggregate commands enforce stock preconditions and idempotency in one transaction. Local/emulated test results do not prove hosted authorization or real cross-device behavior.
- Preserve traceable purchase-cost inputs, but Phase 3 must not present official inventory valuation, COGS, or profit; those remain Phase 5.
- No hosted provisioning, billing activation, production secrets, or deployment is authorized by these directions.

**WP3.1 exit gate:** implement only after mapping the selected contract to current source/schema/tests. Required evidence includes populated-v2 migration preservation; exact-quantity boundary tests; local aggregate atomicity; remote aggregate transaction/idempotency and owner-isolation tests; conflict preservation; and full repository checks. Do not proceed to WP3.2–WP3.7 in the same implementation task.

## 1. Purpose and boundary

Define the minimum domain rules needed to buy ingredients, record stock, produce food, hold finished products, and account for the final disposition of unsold items. The contract is technology-neutral. Implementation must inspect the actual repository, IndexedDB schema versions, migrations, sync engine, and tests before proposing storage changes.

Phase 3 does not implement the full Phase 4 customer/order/payment lifecycle, full Phase 5 accounting, or automatic food-safety decisions.

## 2. Domain concepts

The following are logical concepts, not mandated physical table names. An implementation may map them to existing repository conventions after review.

### 2.1 Ingredient
A reusable raw-material record that refers to the existing Phase 2 ingredient entity. Stock operations must use the stable ingredient ID, not its mutable display name. Archived ingredients remain referentially available to historical records.

### 2.2 Supplier
Optional business-scoped source of a purchase. Ad hoc purchases must remain possible without a supplier record. Supplier archival must not erase purchase history.

### 2.3 Purchase and purchase line
A purchase records intent to acquire ingredients. Each line identifies ingredient, ordered quantity/unit, recorded unit price and currency where supported. A draft or cancelled purchase does not change on-hand stock. A receipt records the actual received quantity and any discrepancy. Repeating the same receipt operation must not add stock twice. Partial receipts are allowed; cancelling an unreceived remainder must not reverse already received quantities.

### 2.4 Stock movement
An immutable, business-scoped event explaining a quantity change. Each posted movement needs a stable ID, movement type, item ID/type, signed quantity or explicitly defined direction, unit, effective timestamp, creation timestamp, source/reference ID, and reason/metadata appropriate to its type. Posted movements are not edited or hard-deleted; corrections are new linked movements.

Proposed movement types:
- Ingredient: opening balance, purchase receipt, production consumption, waste, adjustment/correction.
- Finished product: production output, owner consumption, giveaway, waste/spoilage, adjustment/correction. Sale/discount movements are deferred to Phase 4 under selected D3-07.
- Carry-over: a traceable day/batch disposition record but **not** a stock-in/stock-out movement if the same finished quantity remains on hand.

The chosen physical representation (signed quantity vs direction plus positive quantity) must be consistent across all movement types and tested. Do not encode the same business action as two independent stock effects.

### 2.5 Production batch
A traceable record of one production run. Required logical data: stable ID, business ID, menu-item/recipe reference when available, mode (`make-to-order` or `make-ahead`), status, start/completion timestamps, planned output, actual output, actual ingredient consumption lines, and references to resulting movements. Store the recipe reference/snapshot necessary to explain the run without assuming recipe edits retroactively change past production.

A recipe is a planning baseline. Record actual quantities consumed and actual output where practical; retain variances rather than silently replacing actuals with theoretical recipe values. Do not create stock movements for a draft batch. Completion must be a single idempotent logical operation: ingredient consumption and finished output either both post or neither posts.

### 2.6 Finished-product lot/batch balance
Finished items must be traceable to the production batch and production date/time. Do not merge different production batches in a way that loses traceability needed for carry-over and shelf-life handling. Balance may be calculated from movements or maintained as a cache, but any cache must be rebuildable/verified against the canonical ledger. The canonical source of truth must be explicitly documented before implementation.

### 2.7 Disposition record
A record that explains what happened to finished items after production. Types:
- `owner_consumption`: stock decreases; no sales revenue.
- `giveaway`: stock decreases; no sales revenue.
- `waste_spoilage`: stock decreases; a reason is required.
- `correction`: stock changes through an append-only linked event; a reason is required.
- `carry_over`: the quantity remains on hand and is linked to the existing lot/batch; do not count as new production or waste.
- Regular/discounted sale: **not captured in Phase 3**; sale-related stock reduction and revenue capture belong to Phase 4.

All sale capture, including discounted sales, is deferred to Phase 4 under selected D3-07. Phase 3 must not create a temporary sale ledger, sale UI, or inferred revenue.

### 2.8 Physical count and adjustment
A physical count captures observed quantity at a time and the relevant item/batch/unit. A variance must be visible before posting a correction. A posted correction is an auditable movement linked to the count and includes a reason. It must not silently rewrite historical movements or hide the prior balance.

## 3. Relationships and ownership

- Every new logical record belongs to the current business/owner partition and has a stable opaque ID.
- References among purchase lines, ingredient movements, production batches, consumption lines, output movements, finished lots, dispositions, and counts must remain within the same business scope.
- Ingredient and menu item references use existing Phase 2 stable IDs. Do not duplicate or fork those catalogs.
- Archiving a supplier or ingredient does not delete historical references.
- No posted purchase receipt, completed batch, disposition, or movement may be hard-deleted.
- Client-supplied owner IDs are not authorization evidence. Preserve the existing local owner partition and server-side ownership boundary where remote support exists.

## 4. Quantity and unit rules

- Preserve the Phase 2 allowlist: `g`, `kg`, `ml`, `l`, `each`.
- No automatic conversion between units is allowed until conversion, precision, rounding, ingredient-specific conversion, and display rules are explicitly reviewed and tested.
- Do not assume density to convert mass and volume.
- Quantities must be finite and positive at input; direction/sign is represented consistently by the movement model.
- Do not silently round stored quantities or use binary-float equality for business comparisons.
- Fractional `each` handling and unit-specific precision remain open under D3-02.

## 5. State and idempotency invariants

1. Draft/cancelled purchase: no stock effect.
2. Receipt: stock effect only for actual received quantity; duplicate retry has no second effect.
3. Draft production: no stock effect.
4. Completed production: actual ingredient consumption and finished output are committed atomically as one logical operation.
5. Posted disposition: finished stock changes once. Repeated client submission/retry cannot repeat the effect.
6. Carry-over: stock quantity remains unchanged; no new batch or duplicate production cost.
7. Owner consumption/giveaway: no sales revenue.
8. Sale/discount capture: deferred to Phase 4; Phase 3 must not infer revenue.
9. Waste/spoilage: stock decreases and is distinguishable from sale, consumption, giveaway, and carry-over.
10. Reconciliation: corrections are additive, reasoned events; historical movements remain reviewable.
11. Offline sync: each logical operation has a stable idempotency key; a lost acknowledgement/retry cannot double-apply a movement.
12. Conflict: preserve competing state for review. Never silently auto-merge conflicting quantity changes or invent a resolution.
13. Insufficient stock: production completion is blocked when stock is insufficient; the first release has no negative-stock or override path. Local checks do not replace server-side concurrency checks.
14. Food safety: KitchAI must not assume that food is safe to carry over based only on elapsed time. Carry-over requires an operator confirmation under the applicable business procedure/rule.

## 6. Cost data vs costing/accounting

Record purchase price/cost inputs and references accurately, including currency and actual received quantity where available. Do not claim that a complete inventory valuation, cost of goods sold, profit, tax, or accounting ledger exists in Phase 3. Under the selected D3-01 direction, official inventory valuation, COGS, and profit are deferred to Phase 5; costing method, yield-variance/waste treatment, and packaging/energy/labor allocation must be reviewed there before financial reporting relies on them.

## 7. Offline, sync, and recovery

- Follow existing repository patterns for owner-partitioned local persistence, outbox, retries, idempotency, and conflict snapshots.
- New entity relationships must define dependency ordering for sync.
- A parent operation and all stock movements that represent one atomic business action must not be partially applied without a recoverable state.
- Migration tests must prove Phase 1 profile data, Phase 2 entities, queued operations, and conflict snapshots survive upgrades.
- Tests against local/emulated services do not prove hosted auth/RLS, real cross-device sync, backup/restore readiness, or production readiness.
- IndexedDB is not a backup. Do not add hosted resources, production secrets, billing, or deployment without separate explicit approval.

## 8. Owner-selected policy directions and remaining technical gates

The owner selected D3-01–D3-11 and accepted T3-01–T3-08 on 2026-10-13. The decision log is authoritative. The selected technical contract is in §0.1; compatibility and test evidence are required before later WPs depend on it.

| ID | Topic | Selected policy direction / remaining gate |
|---|---|---|
| D3-01 | Costing method and cost allocation | Selected: store traceable cost inputs; official valuation, COGS, and profit are Phase 5 scope |
| D3-02 | Precision, rounding, fractional count | Selected: preserve precision; reject invalid quantities; no silent rounding/conversion. T3-05 selects exact decimal strings/scaled-integer arithmetic at six fractional places; fractional ingredient `each`, integral finished-stock `each`; test compatibility before migration |
| D3-03 | Insufficient ingredients / negative stock | Selected: block production completion when stock is insufficient; no negative stock or override in first release |
| D3-04 | Partial receipt and cancellation | Selected: allow partial receipts; only actual received quantities post; unreceived remainder stays explicit until received/cancelled |
| D3-05 | Recipe baseline vs actual use | Selected: record actual use/output and compare with recipe baseline; label unknown/theoretical values honestly |
| D3-06 | Shelf life / carry-over eligibility | Selected: operator confirms lot suitability; age alone never proves safety. Configured expiry warnings remain separately reviewed |
| D3-07 | Sale/discount capture in Phase 3 | Selected: defer all sale capture to Phase 4; Phase 3 must not infer revenue or build a temporary sales ledger |
| D3-08 | Consumption/giveaway/waste categories | Selected: distinct categories; require reason for waste and stock corrections; owner consumption/giveaway are not revenue |
| D3-09 | Physical-count confirmation and correction permissions | Selected: show expected/count/variance, require reason and confirmation, append a linked correction event |
| D3-10 | Supplier fields, currency, tax/shipping cost | Selected: supplier optional; capture received qty/unit, unit price/currency, receipt timestamp; defer tax/shipping allocation |
| D3-11 | Sync conflict resolution UX | Selected: stable event IDs, same-ID idempotency, preserve distinct conflicting events for review; never auto-merge stock changes |

## 9. Acceptance gate for this contract

- This contract is reconciled with the current implementation and Phase 2 domain contract.
- The implementation agent documents the actual repository architecture, database/store owners, migration approach, test scripts, and proposed mapping from logical concepts to code before changing runtime files.
- Selected owner policy directions and independent technical gates remain visible. No implementation begins while required technical choices are ambiguous or the owner-review gates are unresolved.
- No schema migration, application code, hosted resource, or production rollout is implied by this document.
