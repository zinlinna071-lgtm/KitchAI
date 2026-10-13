# Phase 3 Domain Contract — Purchasing, Inventory & Production

**Status:** Proposed logical contract for owner review; not an application schema or implementation authorization.  
**Parent plan:** [PHASE_3_PLAN.md](./PHASE_3_PLAN.md)  
**Compatibility:** Preserve Phase 1 owner partitioning, local-first persistence, outbox/idempotency, explicit conflict review, and Phase 2 ingredient/menu/recipe behavior.

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

Record purchase price/cost inputs and references accurately, including currency and actual received quantity where available. Do not claim that a complete inventory valuation, cost of goods sold, profit, tax, or accounting ledger exists in Phase 3. The costing method (FIFO vs weighted average, treatment of yield variance and waste, and allocation of packaging/energy/labor) requires a separate reviewed decision before financial reporting relies on it. D3-01 remains open; Phase 5 owns full financial reporting.

## 7. Offline, sync, and recovery

- Follow existing repository patterns for owner-partitioned local persistence, outbox, retries, idempotency, and conflict snapshots.
- New entity relationships must define dependency ordering for sync.
- A parent operation and all stock movements that represent one atomic business action must not be partially applied without a recoverable state.
- Migration tests must prove Phase 1 profile data, Phase 2 entities, queued operations, and conflict snapshots survive upgrades.
- Tests against local/emulated services do not prove hosted auth/RLS, real cross-device sync, backup/restore readiness, or production readiness.
- IndexedDB is not a backup. Do not add hosted resources, production secrets, billing, or deployment without separate explicit approval.

## 8. Decisions still open

| ID | Topic | Contract treatment until resolved |
|---|---|---|
| D3-01 | Costing method and cost allocation | Store traceable cost inputs; do not present official inventory valuation/profit |
| D3-02 | Precision, rounding, fractional count | Preserve values; no silent rounding or conversion |
| D3-03 | Insufficient ingredients / negative stock | Do not silently permit negative stock; stop and report the unresolved rule |
| D3-04 | Partial receipt and cancellation | Only actual receipt may affect stock; edge behavior must be defined before coding |
| D3-05 | Recipe baseline vs actual use | Preserve actual use and variance; do not overwrite with theoretical quantity |
| D3-06 | Shelf life / carry-over eligibility | Operator confirmation; no automatic food-safety claim |
| D3-07 | Minimal sale/discount capture in Phase 3 | No full order/payment system; define smallest auditable disposition boundary |
| D3-08 | Required reasons for consumption/giveaway/waste | Keep categories distinct; reason requirements still need review |
| D3-09 | Physical-count confirmation and correction permissions | Show variance and require reason; final permission/confirmation flow open |
| D3-10 | Supplier fields, currency, tax/shipping cost | Supplier optional; exact required fields open |
| D3-11 | Sync conflict resolution UX | Preserve snapshots and require explicit review; no silent merge |

## 9. Acceptance gate for this contract

- This contract is reconciled with the current implementation and Phase 2 domain contract.
- The implementation agent documents the actual repository architecture, database/store owners, migration approach, test scripts, and proposed mapping from logical concepts to code before changing runtime files.
- All open decisions remain visible and are either resolved by the owner or explicitly deferred with a safe, bounded implementation consequence.
- No schema migration, application code, hosted resource, or production rollout is implied by this document.
