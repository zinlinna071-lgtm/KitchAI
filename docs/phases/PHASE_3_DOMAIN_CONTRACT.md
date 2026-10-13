# Phase 3 Domain Contract — Purchasing, Inventory & Production

**Status:** Proposed logical contract for owner review; not an application schema or implementation authorization.  
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

## 0.1 Proposed technical clarifications from the WP3.1 repository review — PENDING RECONCILIATION

**Decision status:** The owner selected the recommended policy directions for D3-01–D3-11 on 2026-10-13; see `docs/DECISIONS.md`. The technical proposals in this section are still proposals that must be reconciled with the selected policies, source code, migration behavior, and test plan. They are not automatically approved architecture. They do not authorize runtime code, schema, migration, SQL, hosted resources, or production changes.

### PC-1 — Canonical stock truth and balance projections (proposed)
- **Proposal:** Treat the append-only stock-movement ledger as the canonical explanation of stock changes. Any current on-hand balance is a derived projection/cache that can be rebuilt from valid posted movements and reconciled against the ledger.
- **Why:** Prevent a cached quantity and movement history from becoming competing sources of truth.
- **Gate:** Owner/architecture review must accept or replace this proposal before schema design. Define how opening balances, reversals, corrections, and legacy/migrated records enter the ledger.

### PC-2 — Production posting atomicity at each boundary (required invariant; implementation design pending)
- **Local boundary:** A single production-completion command must commit its completed batch state, ingredient-consumption movements, finished-output movement/lot, and durable outbox operation(s) together in one IndexedDB transaction, or commit none of them. A partially written local batch must be recoverable and must not appear completed.
- **Remote boundary:** If those records sync as one business action, the server must apply the aggregate idempotently in one server-side transaction/RPC or equivalent atomic command. Dependency ordering across separate upserts alone is not remote atomicity.
- **Gate:** The exact aggregate payload, RPC/API boundary, retries, acknowledgements, and rollback/recovery semantics must be designed and tested before production sync implementation. This proposal does not authorize a hosted migration.

### PC-3 — Movement quantity and correction representation (unresolved)
- Choose one consistent representation: signed quantity, or explicit direction plus positive quantity. Reject zero-effect posted movements; retain the established unit allowlist and do not introduce conversions.
- Corrections/reversals must be new, stable-ID, auditable events linked to the original event where applicable; never edit or delete a posted movement to conceal history.
- Precision, rounding, fractional `each`, and safe comparison rules remain D3-02 and are not decided by this clarification.

### PC-4 — Finished-lot allocation for disposition (policy pending)
- Every disposition that reduces finished stock must identify the finished lot(s) it consumes. If a disposition spans multiple lots, explicit allocations must sum exactly to the disposition quantity; each allocation must be positive and in a compatible unit.
- Until an allocation policy is reviewed, the UI/command must require explicit lot selection rather than silently infer a lot from age, FIFO, or safety.
- Carry-over records reference the existing lot and do not create stock or a duplicate production event. Age alone must never produce a food-safety determination; operator confirmation and separately reviewed business rules remain necessary.

### PC-5 — Versioned IndexedDB migration safety (required gate)
- Before adding Phase 3 stores/indexes or changing records, map each proposed change to the existing `kitchai-business-data` schema version 2 and its existing stores, outbox, sync metadata, conflicts, metadata, and migration ledger.
- Use a versioned upgrade path with tests seeded from a populated v2 database, including existing entities, queued operations, sync acknowledgements/metadata, conflict snapshots, migration-ledger entries, and representative legacy-source data.
- Upgrade failure must not silently delete or overwrite source data. Verify upgrade, rollback/failure behavior where supported, and idempotent restart. Do not create a second inventory database or bump unrelated databases by default.

### PC-6 — Event identity, retries, and conflicts (required invariant)
- Replaying the same stable operation/event ID is a retry and must not apply a movement twice. A different event ID representing a competing quantity change is not a retry and must not be merged silently.
- Preserve base/local/remote or equivalent conflicting event snapshots for explicit review. Any resolution must be a new auditable action with clear effect on the ledger and outbox.
- Dependency ordering is useful for delivery but is not a substitute for aggregate atomicity, idempotency, or conflict handling.

### PC-7 — Scope and time semantics (implementation gate)
- Validate every referenced ingredient, menu item, supplier, purchase, production batch, finished lot, movement, disposition, and count against the same owner/business scope before committing locally and again at the server authorization boundary.
- Define effective business date/time, creation timestamp, timezone handling, and ordering of concurrent events before relying on daily summaries or lot selection. Do not infer a business-day boundary from the device's current timezone without an explicit rule.

### PC-8 — Cost inputs are not valuation (reinforcement)
- Purchase prices and other approved cost inputs may be retained with their currency and source references. Under selected D3-01, Phase 3 must not present official inventory valuation, COGS, or profit; those require the separate Phase 5 costing/accounting contract.

**Exit gate for these clarifications:** Record the owner’s decisions or explicitly deferred safe behaviors in `docs/DECISIONS.md`; update this contract and the test matrix accordingly. WP3.1 remains **Review required / blocked from implementation** until that review and the repository-to-code mapping are complete.

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
A purchase records intent to acquire ingredients. Each line identifies ingredient, ordered quantity/unit, recorded unit price and currency where supported. A draft or cancelled purchase does not change on-hand stock. A receipt records the actual received quantity and any discrepancy. Repeating the same receipt operation must not add stock twice. Partial receipt and cancellation rules remain subject to D3-04.

### 2.4 Stock movement
An immutable, business-scoped event explaining a quantity change. Each posted movement needs a stable ID, movement type, item ID/type, signed quantity or explicitly defined direction, unit, effective timestamp, creation timestamp, source/reference ID, and reason/metadata appropriate to its type. Posted movements are not edited or hard-deleted; corrections are new linked movements.

Proposed movement types:
- Ingredient: opening balance, purchase receipt, production consumption, waste, adjustment/correction.
- Finished product: production output, regular sale, discounted sale, owner consumption, giveaway, waste/spoilage, adjustment/correction.
- Carry-over: a traceable day/batch disposition record but **not** a stock-in/stock-out movement if the same finished quantity remains on hand.

The chosen physical representation (signed quantity vs direction plus positive quantity) must be consistent across all movement types and tested. Do not encode the same business action as two independent stock effects.

### 2.5 Production batch
A traceable record of one production run. Required logical data: stable ID, business ID, menu-item/recipe reference when available, mode (`make-to-order` or `make-ahead`), status, start/completion timestamps, planned output, actual output, actual ingredient consumption lines, and references to resulting movements. Store the recipe reference/snapshot necessary to explain the run without assuming recipe edits retroactively change past production.

A recipe is a planning baseline. Record actual quantities consumed and actual output where practical; retain variances rather than silently replacing actuals with theoretical recipe values. Do not create stock movements for a draft batch. Completion must be a single idempotent logical operation: ingredient consumption and finished output either both post or neither posts.

### 2.6 Finished-product lot/batch balance
Finished items must be traceable to the production batch and production date/time. Do not merge different production batches in a way that loses traceability needed for carry-over and shelf-life handling. Balance may be calculated from movements or maintained as a cache, but any cache must be rebuildable/verified against the canonical ledger. The canonical source of truth must be explicitly documented before implementation.

### 2.7 Disposition record
A record that explains what happened to finished items after production. Types:
- `sold_regular`: stock decreases; actual amount received is recorded if captured in this Phase 3 boundary.
- `sold_discounted`: stock decreases; actual discounted price/amount received is recorded, not inferred from list price.
- `owner_consumption`: stock decreases; no sales revenue.
- `giveaway`: stock decreases; no sales revenue.
- `waste_spoilage`: stock decreases; record reason where known.
- `carry_over`: the quantity remains on hand and is linked to the relevant batch/day; do not count as new production or waste.

Full customer, order, payment, refund, and sales-reporting behavior remains Phase 4. Phase 3 must not create a second sale workflow; the exact minimal capture boundary is D3-07 and remains open.

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
8. Discounted sale: actual received amount is distinct from list price.
9. Waste/spoilage: stock decreases and is distinguishable from sale, consumption, giveaway, and carry-over.
10. Reconciliation: corrections are additive, reasoned events; historical movements remain reviewable.
11. Offline sync: each logical operation has a stable idempotency key; a lost acknowledgement/retry cannot double-apply a movement.
12. Conflict: preserve competing state for review. Never silently auto-merge conflicting quantity changes or invent a resolution.
13. Insufficient stock: behavior is unresolved under D3-03. Do not silently permit negative stock or introduce an override policy without an explicit reviewed rule.
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

The owner selected the recommended defaults for D3-01–D3-11 on 2026-10-13. The decision log is authoritative. This section records the policy direction; it does not replace the technical contract clarifications required before implementation.

| ID | Topic | Selected policy direction / remaining gate |
|---|---|---|
| D3-01 | Costing method and cost allocation | Selected: store traceable cost inputs; official valuation, COGS, and profit are Phase 5 scope |
| D3-02 | Precision, rounding, fractional count | Selected: preserve precision; reject invalid quantities; no silent rounding/conversion. Numeric representation, limits, and fractional `each` policy remain a technical gate |
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
- All open decisions remain visible and are either resolved by the owner or explicitly deferred with a safe, bounded implementation consequence.
- No schema migration, application code, hosted resource, or production rollout is implied by this document.
