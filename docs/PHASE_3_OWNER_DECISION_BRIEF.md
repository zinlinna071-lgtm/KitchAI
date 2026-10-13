# Phase 3 Owner Decision Brief — D3-01 to D3-11

**Status: Owner selections recorded on 2026-10-13.**  
**Scope:** This brief retains the option comparisons for Phase 3 (Purchasing, Inventory & Production). The owner selected the recommended checklist defaults for D3-01–D3-11; see [DECISIONS.md](./DECISIONS.md) for the authoritative decision log. These selections do not authorize application code, database/schema changes, hosted resources, billing, or deployment.

Related documents: [Phase 3 plan](./phases/PHASE_3_PLAN.md), [domain contract](./phases/PHASE_3_DOMAIN_CONTRACT.md), [WP3.1 repository review](./PHASE_3_WP3_1_REPOSITORY_REVIEW.md), [decision log](./DECISIONS.md), [decision-gate matrix](./PHASE_3_DECISION_GATE_MATRIX.md).

## Recorded owner selections

The owner chose the recommended/default options in the decision checklist on 2026-10-13. The authoritative status, rationale, and boundaries for all eleven selections are recorded in [DECISIONS.md](./DECISIONS.md). In short: defer official costing to Phase 5; preserve precision/no silent rounding; block insufficient-stock completion; allow partial receiving; capture actual production use/output; require operator carry-over suitability confirmation; defer all sale capture to Phase 4; distinguish consumption/giveaway/waste; use append-only physical-count corrections; keep suppliers optional and defer tax/shipping allocation; and preserve conflicting stock events for explicit review.

## Decision summary

| ID | Question | Suggested default for discussion | Main trade-off |
|---|---|---|---|
| D3-01 | Inventory costing method | Defer official valuation/COGS/profit to Phase 5; retain traceable purchase cost inputs only | Simpler Phase 3, but no official inventory value/profit claim |
| D3-02 | Quantity precision and rounding | Preserve entered/calculated precision within an explicitly documented safe numeric representation; reject invalid quantities; never silently round or convert | More validation work; avoids hidden quantity loss |
| D3-03 | Production with insufficient ingredient stock | Block completion when available stock is insufficient; no negative stock or override in first release | May require recording a purchase/count correction first |
| D3-04 | Partial receiving/cancellation | Allow partial receipt; only actually received quantities change stock; keep unreceived balance explicit | Requires partial/open/cancelled status rules |
| D3-05 | Recipe baseline vs actual use/output | Record actual ingredient use and actual output; show variance from recipe baseline | More entry effort, better operational traceability |
| D3-06 | Carry-over/shelf-life | Require operator to confirm suitability under separately reviewed rules; app never infers safety from age alone | Human confirmation remains necessary |
| D3-07 | Discounted sale in Phase 3 | Minimal finished-stock disposition: quantity, actual amount received, currency, timestamp, lot allocation; full order/payment remains Phase 4 | Avoids duplicate sales systems; limited sales reporting only |
| D3-08 | Owner consumption, giveaway, waste | Separate disposition categories; require reason for waste and stock corrections | Slightly more recording, clearer loss tracking |
| D3-09 | Physical count corrections | Show expected vs counted variance; require reason and explicit confirmation; append a correction event | Prevents silent overwrites; adds a confirmation step |
| D3-10 | Supplier and purchase-cost fields | Supplier optional; record received quantity/unit, unit price/currency, receipt date/time; tax/shipping treatment explicitly deferred unless needed | Useful cost history without prematurely deciding accounting |
| D3-11 | Conflicting stock movements | Stable event IDs; same ID is idempotent retry; distinct conflicting events are preserved for explicit review and never auto-merged | Conflict resolution may require manual intervention |

## Detailed decision cards

### D3-01 — Inventory costing
- **Option A:** Defer official valuation, COGS, and profit to Phase 5; preserve purchase-cost inputs with currency/source references.
- **Option B:** Choose a costing method in Phase 3 after comparing weighted average and FIFO, including corrections, returns, and lot behavior.
- **Suggested:** A. It protects the Phase 3 inventory scope from prematurely presenting financial figures as authoritative.
- **Recorded owner selection (2026-10-13):** A or B. If B, select method and define correction/return treatment before implementation.

### D3-02 — Quantity precision
- **Option A:** Preserve precision, define a documented numeric representation and per-unit validation; reject invalid values and never silently round/convert.
- **Option B:** Define explicit per-unit decimal limits and rounding rules now.
- **Suggested:** A as the no-hidden-loss principle, while leaving actual precision limits to a tested technical proposal. This does not settle fractional `each`, maximum precision, or numeric storage type.
- **Recorded selection:** Option A. Before coding, implementation review must still propose and test numeric representation, per-unit limits, and fractional `each` behavior.

### D3-03 — Insufficient stock during production
- **Option A:** Block production completion if ingredient stock is insufficient; no negative stock.
- **Option B:** Permit an explicit, reasoned override with audit trail.
- **Suggested:** A for the first release, unless real operating practice requires emergency overrides.
- **Recorded selection:** Option A; block completion on insufficient stock. No override in the first release.

### D3-04 — Partial receiving/cancellation
- **Option A:** Allow multiple partial receipts; each idempotent receipt posts only the actual quantity received; unreceived quantity stays open until received or cancelled.
- **Option B:** Require one complete receipt or cancellation.
- **Suggested:** A, because real purchases can arrive in separate quantities.
- **Recorded selection:** Option A; partial receipts are allowed, and cancellation of the remainder must not reverse quantities already received.

### D3-05 — Actual production consumption
- **Option A:** Record actual ingredient consumption and actual output, compare to recipe baseline, preserve variance.
- **Option B:** Deduct only theoretical recipe quantities.
- **Suggested:** A. If actual use is unknown, the UI must make that limitation explicit rather than represent theoretical quantity as measured fact.
- **Recorded selection:** Option A; record actual use/output and variance. Any unknown/theoretical quantity must be labeled as such, not as measured actual.

### D3-06 — Carry-over and shelf-life
- **Option A:** Operator confirms whether the specific finished lot is suitable to carry over, using separately reviewed business rules; the app does not infer food safety from age alone.
- **Option B:** App enforces product-specific shelf-life rules after those rules are reviewed and explicitly configured.
- **Suggested:** A as the minimum safe behavior; B can be a later, reviewed enhancement and still must not claim to replace food-safety judgment.
- **Recorded selection:** Option A; operator confirmation is required. Configured expiry warnings remain a separate reviewed enhancement.

### D3-07 — Discounted sale boundary
- **Option A:** Phase 3 records only a finished-stock disposition with quantity, actual amount received/currency, timestamp, and lot allocation; full order/payment/customer workflow remains Phase 4.
- **Option B:** Defer all sale capture to Phase 4, allowing only non-sale stock dispositions in Phase 3.
- **Suggested:** A only if recording actual discounted sales is needed to correctly explain finished-stock reductions before Phase 4; otherwise B avoids a temporary sales interface.
- **Recorded selection:** Option B; defer all sale capture, including discounted sales, to Phase 4. Phase 3 must not create a temporary sales ledger.

### D3-08 — Consumption, giveaway, waste
- **Option A:** Separate owner consumption, giveaway, waste/spoilage, and other corrections; require a reason for waste and corrections.
- **Option B:** Use a generic “other adjustment” with free-text reason.
- **Suggested:** A so reporting can distinguish personal use, giving food away, and actual waste.
- **Recorded selection:** Option A; keep disposition categories distinct and require reasons for waste and stock corrections.

### D3-09 — Physical counts
- **Option A:** Display expected quantity, counted quantity, and variance; require reason and explicit confirmation; append a correction linked to the count.
- **Option B:** Let a count directly overwrite the current balance.
- **Suggested:** A. Direct overwrite is inconsistent with auditable stock history.
- **Recorded selection:** Option A; append-only correction with reason and explicit confirmation. Draft/second-person approval is not included unless separately revisited.

### D3-10 — Supplier and cost capture
- **Option A:** Supplier optional; record actual received quantity/unit, unit price/currency and receipt timestamp; defer tax/shipping allocation.
- **Option B:** Require supplier and fully allocated landed cost fields.
- **Suggested:** A for small-business flexibility and to avoid making supplier data a blocker for ad hoc purchases.
- **Recorded selection:** Option A; supplier optional and tax/shipping allocation deferred.

### D3-11 — Movement sync conflicts
- **Option A:** Stable event/operation IDs; duplicate ID is idempotent; distinct conflicting events preserve snapshots and require explicit review. Never silently add or merge quantities.
- **Option B:** Automatically merge distinct stock events using a deterministic rule.
- **Suggested:** A. Stock events are consequential and automatic merging can double-count or conceal incompatible intent.
- **Recorded selection:** Option A; conflicting stock events must be preserved for explicit review, never auto-merged. The exact resolution operation and remote atomic command remain technical gates.

## Technical gates independent of the business choices

The following are not substitutes for the owner decisions above:
1. Decide whether the append-only movement ledger is the canonical stock explanation or document an alternative; derived balances must be reconcilable.
2. Define local atomic production posting and separately define an idempotent remote aggregate transaction/RPC; ordered independent upserts are insufficient.
3. Define movement representation and correction/reversal links.
4. Require explicit finished-lot allocation until a reviewed allocation policy exists; allocation totals must equal disposition quantity.
5. Test an upgrade from a populated existing `kitchai-business-data` v2 database, preserving entities, operations/outbox, sync metadata, conflicts, migration ledger, and legacy source data.
6. Validate owner/business scope at local and server boundaries; define timestamp, timezone, and business-day semantics.
7. Map all proposed store/index/API changes to current repository code and tests before implementation.

## How to record the owner's selections

For each ID, record one of: **Selected**, **Deferred**, or **Rejected**, plus a short rationale and date in `docs/DECISIONS.md`. A deferred decision must name a safe interim behavior and the feature/reporting limitations it creates. Do not mark any row resolved based on this brief alone.

## Current gate

WP3.1 remains **Review required / blocked from implementation**. Owner selections are recorded in the decision log; the next step is to reconcile the domain contract, repository mapping, and test matrix against those selections and the independent technical gates. No application code or database schema is changed by this brief.
