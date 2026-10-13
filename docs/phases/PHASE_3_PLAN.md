# Phase 3 Plan — Purchasing, Inventory & Production

**Status:** PROPOSED — NOT APPROVED FOR IMPLEMENTATION  
**Change type:** Documentation and planning only  
**Target branch:** `docs/phase-3-production-inventory-plan`  
**Prerequisites:** Phase 2 menu items, ingredients, recipes, recipe lines, and existing offline/sync foundation  
**Implementation status:** Not started. No application code, schema, migrations, or hosted resources are changed by this plan.

**WP3.1 review handoff:** [CODING_AI_PHASE3_WP3_1_REVIEW_PROMPT.md](../CODING_AI_PHASE3_WP3_1_REVIEW_PROMPT.md) remains a read-only historical review prompt. After owner acceptance of T3-01–T3-08, the bounded next step is [CODING_AI_PHASE3_WP3_1_IMPLEMENTATION_PROMPT.md](../CODING_AI_PHASE3_WP3_1_IMPLEMENTATION_PROMPT.md).

**Technical gate reconciliation:** [PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md](../PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md) maps source files, recommended technical candidates, remaining owner-review gates, and minimum acceptance tests. The [Technical Decision Brief](../PHASE_3_TECHNICAL_DECISION_BRIEF.md) records the owner's acceptance of T3-01–T3-08 on 2026-10-13.

**Repository review findings:** [PHASE_3_WP3_1_REPOSITORY_REVIEW.md](../PHASE_3_WP3_1_REPOSITORY_REVIEW.md) records the source-grounded review. The follow-up [technical-gate reconciliation](../PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md) maps existing source files, candidate technical designs, and acceptance tests. Both are documentation-only; no tests were run for these reviews and WP3.1 is not complete.

**Contract clarification draft:** The domain contract now includes §0.1 proposed clarifications PC-1–PC-8 for ledger authority, local/remote atomic posting, movement/correction semantics, lot allocation, v2 migration safety, event retry/conflict handling, scope/time validation, and cost-input boundaries. These proposals have now been reconciled with the owner-selected D3-01–D3-11 policy directions recorded in [DECISIONS.md](../DECISIONS.md). The selected technical gates are reconciled into the domain contract and decision log. WP3.1 may proceed through its bounded prompt, subject to compatibility review and required tests; later WPs remain out of scope.

**Owner decision aid:** [PHASE_3_OWNER_DECISION_BRIEF.md](../PHASE_3_OWNER_DECISION_BRIEF.md) lays out options, trade-offs, and suggested discussion defaults for D3-01–D3-11. The [decision-gate matrix](../PHASE_3_DECISION_GATE_MATRIX.md) maps each choice to affected WPs, acceptance/test evidence, and safe deferral boundaries. The owner has selected the recommended/default directions; see [DECISIONS.md](../DECISIONS.md). These documents remain planning aids and do not authorize implementation.

## 1. Goal

Build an auditable inventory workflow for a small food business that buys ingredients, produces food either after a customer request or ahead in batches, sells finished items over time, and handles leftovers according to whether they remain safe and suitable to keep.

Phase 3 must make the quantities and movement history understandable without claiming that inventory alone is a complete accounting or sales system.

## 2. Business workflow to support

1. **Purchase ingredients:** record supplier (optional where no supplier record is available), item, quantity, unit, price/cost, purchase status, and receipt. Drafting or cancelling a purchase must not change on-hand stock; receiving it changes stock exactly once.
2. **Track ingredient stock:** show on-hand quantity and an auditable movement history. Support opening stock, receipts, production consumption, waste, and reasoned adjustments.
3. **Produce food:** create a production batch for either `make-to-order` (prepared for a customer request) or `make-ahead` (prepared before a confirmed sale). Link the batch to a Phase 2 menu item/recipe where applicable. Record planned and actual output, actual ingredient consumption, time/date, and operator/source where supported. Recipe quantities are a planning baseline, not proof of actual consumption.
4. **Create finished-product stock:** completed production transfers value/quantity from ingredient stock into finished-product stock. Do not deduct the same ingredients again when a finished item is sold or disposed of.
5. **Handle unsold finished food:** explicitly record carry-over only after operator confirmation of suitability, owner/personal consumption, giveaway, and waste/spoilage/discard. All sale capture—including regular and discounted sales—is deferred to Phase 4 under selected D3-07. Carry-over does not change stock quantity; each non-sale disposition reduces finished-product stock exactly once. Owner consumption and giveaways are not sales revenue.
6. **Reconcile stock:** compare recorded stock with a physical count, show the variance, require a reason for the adjustment, and preserve the original movement history.
7. **Work offline safely:** queue local operations, retry idempotently, preserve conflicts for review, and never silently overwrite or double-apply stock changes.

## 3. Proposed work packages

### WP3.1 — Inventory Domain Rules & Data Model
Define ingredient and finished-product stock boundaries, movement types, units, quantity precision, identifiers, audit fields, validation, and invariants. Reuse Phase 2 ingredient/menu/recipe entities; avoid duplicating recipe data. No silent hard deletes.

**Acceptance evidence:** reviewed data dictionary and state-transition rules; tests for valid/invalid quantities, unit compatibility, ownership, and prohibited transitions.

### WP3.2 — Suppliers, Purchasing & Receiving
Define supplier records as needed, purchase drafts, purchase lines, receiving, partial receiving policy, cancellation, and idempotent stock receipt. A draft purchase does not affect stock; only a valid receipt does.

**Acceptance evidence:** tests showing draft/cancelled purchases do not change stock, receipt changes stock once, duplicate retry does not duplicate receipt, and invalid unit/item combinations are rejected.

### WP3.3 — Production Batches & Ingredient Consumption
Support both make-to-order and make-ahead batches. Link a batch to a menu item/recipe when available; record planned yield and actual output/consumption; create traceable ingredient-out and finished-product-in movements. Record variance rather than assuming recipe theoretical quantities always equal actual use. Sales-triggered automatic deduction remains deferred to Phase 4.

**Acceptance evidence:** batch examples, quantity-conservation tests, block-on-insufficient-stock behavior, duplicate-submit/idempotency tests, and regression tests for Phase 2 recipes.

### WP3.4 — Finished Goods, Leftovers & Disposition
Track on-hand quantities of produced items separately from ingredients. Record batch/date and quantities carried over, consumed by owner, given away, or discarded. Sale/discount capture is deferred to Phase 4. Carry-over must preserve the existing batch identity and must not create a second production event or duplicate stock.

Food-safety/shelf-life suitability must be entered or confirmed by the operator under an explicitly configured rule; the app must not automatically declare food safe based only on age.

**Acceptance evidence:** stock reconciliation examples; non-sale disposition categories are distinct; carry-over is not counted as new production or waste; owner consumption/giveaways have no sales revenue; sale capture does not reduce stock in Phase 3 and remains deferred to Phase 4.

### WP3.5 — Stock History, Physical Counts & Corrections
Provide an auditable movement ledger and physical-count reconciliation. Corrections append a reasoned movement instead of silently rewriting historical quantities. Define whether a correction requires confirmation and how concurrent corrections are handled.

**Acceptance evidence:** ledger can explain the current balance; adjustment preserves prior history; repeated submission cannot double-adjust; conflict is reviewable.

### WP3.6 — Offline, Sync, Conflict & Recovery Safety
Extend existing sync mechanics for new Phase 3 entities. Define entity dependencies and idempotency keys; preserve base/local/remote conflict information; isolate work by owner; recover interrupted operations; do not silently merge competing stock movements.

**Acceptance evidence:** offline create/update, reconnect/reload, retry after lost acknowledgement, duplicate operation, stale revision/conflict, owner isolation, and interrupted operation tests pass against local/emulated services. These tests do not prove hosted or real cross-device behavior.

### WP3.7 — Integration, Regression & Phase Exit
Run database, unit, browser, accessibility/regression, migration, and production-build checks appropriate to changed code. Document manual checks, deferred checks, known limitations, and owner acceptance separately from automated results.

**Acceptance evidence:** reproducible test results, reviewed diff, updated status/registry/decision log, and an explicit Phase 3 exit record. No completion claim without evidence.

## 4. Out of scope for Phase 3

- Full customer/order lifecycle, payment integration, refunds, and complete sales reporting (Phase 4).
- Sales-triggered automatic stock deduction; integrate only when the Phase 4 sale lifecycle is defined.
- Full accounting, cashflow, profit-and-loss reporting, and financial analytics (Phase 5).
- AI forecasting/recommendations (Phase 6+).
- Hosted cloud provisioning, paid plans, billing activation, production secrets, and production deployment.
- Automatically determining food safety from dates without an owner-approved rule and appropriate data.

## 5. Cross-cutting invariants

- Allowed measurement units remain `g`, `kg`, `ml`, `l`, and `each`; no implicit conversions unless an explicit conversion rule is reviewed and approved.
- Every stock change must have a source, timestamp, quantity, unit, and traceable reason/reference.
- Purchase receipt, production completion, and disposition must be idempotent; a retry must not double-apply stock movements.
- Ingredient consumption happens at production, not again at sale. Finished stock is reduced on disposition/sale.
- Carry-over does not create a new production batch or duplicate cost.
- Sales revenue is the actual amount received; owner consumption and giveaways are not sales.
- Conflicting stock changes must be preserved for review, never silently overwritten.
- No hard-delete path for posted purchases, completed production, or posted movements; use reversals/corrections.
- IndexedDB is not a backup. Local/emulated tests do not prove hosted authorization, real cross-device sync, backup/restore readiness, or production readiness.
- No hosted provisioning, billing, secrets, or deployment without explicit separate owner approval.

## 6. Open owner decisions (do not infer approval)

| ID | Selected owner policy direction | Remaining technical boundary | Status |
|---|---|---|---|
| D3-01 | Defer official valuation/COGS/profit to Phase 5; preserve traceable purchase-cost inputs | Costing method and allocation rules belong to Phase 5 | Selected |
| D3-02 | Preserve precision; reject invalid quantities; no silent rounding/conversion | Numeric representation, limits, and fractional `each` need a testable proposal | Selected — technical gate |
| D3-03 | Block production completion on insufficient stock; no negative stock/override in first release | Local and remote checks must be atomic and concurrency-safe | Selected |
| D3-04 | Allow partial receipts; only actual received quantities affect stock | Cancellation of unreceived remainder must preserve earlier receipts | Selected |
| D3-05 | Record actual use/output and compare with recipe baseline | Unknown quantities must be labeled estimated/theoretical | Selected |
| D3-06 | Require operator confirmation for carry-over suitability; no age-only safety inference | Configured expiry warnings/rules require separate review | Selected |
| D3-07 | Defer all sale capture to Phase 4 | No Phase 3 sale ledger/UI or inferred revenue | Selected |
| D3-08 | Distinguish owner consumption, giveaway, waste, and correction | Reasons required for waste and stock corrections | Selected |
| D3-09 | Show count variance; require reason/confirmation; append linked correction event | Draft/second-person approval remains out of first-release scope unless revisited | Selected |
| D3-10 | Supplier optional; record actual receipt quantity/unit, unit price/currency/time; defer tax/shipping allocation | Do not claim landed cost/official valuation | Selected |
| D3-11 | Stable event IDs; idempotent retry; preserve distinct conflicts for explicit review | Exact resolution UX and remote aggregate command remain technical gates | Selected |

## 6.1 Selected owner policy directions (recorded 2026-10-13)

The owner selected the recommended/default directions for D3-01–D3-11. The table below is a readable summary; `docs/DECISIONS.md` is authoritative. Technical design recommendations remain separate and are not approved merely by these policy selections.

| ID | Recommended default | Why |
|---|---|---|
| D3-01 | Defer official inventory valuation/COGS and profit calculations to Phase 5; preserve actual purchase-cost inputs and batch consumption references now | Avoids presenting an unreviewed costing method as accounting truth |
| D3-02 | Preserve numeric precision, prohibit silent rounding/conversion, and define unit-specific limits in tests before implementation | Prevents hidden quantity drift |
| D3-03 | Block production completion when recorded local stock is insufficient; do not add negative stock or an override path in the first release | Safest, auditable behavior until a deliberate override workflow is specified |
| D3-04 | Allow partial receipts; only actually received quantities affect stock; cancelled/unreceived quantities do not | Matches real deliveries and prevents false stock |
| D3-05 | Record actual ingredient use and actual output; compare with recipe baseline and show variance | Real production can differ from the recipe |
| D3-06 | Require operator confirmation for carry-over suitability; configure any shelf-life prompts only after a separate reviewed rule | App cannot infer food safety from age alone |
| D3-07 | Defer all sale capture, including discounted sales, to Phase 4; Phase 3 handles only non-sale dispositions | Avoids a temporary sales ledger and ambiguous revenue capture |
| D3-08 | Always distinguish owner consumption, giveaway, and waste; require a reason for waste/adjustment, allow optional notes for owner consumption/giveaway | Keeps reporting useful without making routine entries cumbersome |
| D3-09 | Show count variance, require reason, and append a correction movement; require explicit confirmation before posting | Protects audit history |
| D3-10 | Supplier is optional; capture received quantity, unit, unit price, currency, and receipt date; decide taxes/shipping before including them in valuation | Supports informal purchases while preserving usable cost inputs |
| D3-11 | Preserve conflicting movement snapshots and require explicit manual review; never automatically add/merge conflicting stock changes | Prevents silent quantity corruption |

The owner selected the recommended/default directions for D3-01–D3-11 on 2026-10-13; the authoritative record is `docs/DECISIONS.md`. These business-policy selections do not approve the independent technical proposals. Review [PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md](../PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md) before preparing a runtime implementation prompt.

## 7. Phase 2 boundary and owner smoke-test note

The owner reported manually trying online/offline behavior, data entry, value correctness, and persistence, and said the observed behavior was good. This is useful owner smoke-test feedback only. It does not replace documented evidence for hosted sync, real two-device behavior, backup/export/restore, food-safety validation, or production readiness. Phase 3 must retain all Phase 2 known limitations and deferred checks in the exit review.

## 8. Implementation gate

This document is a proposed plan, not authorization to start implementation. Before the first coding WP:
1. Preserve the recorded owner selections and confirm Phase 2 exit/known limitations are understood.
2. Review or amend the independent technical recommendations in the WP3.1 technical-gate reconciliation.
3. Specify quantity precision/range/fractional `each` and relevant time semantics with testable rules.
4. Reconcile the domain contract, repository mapping, WP acceptance criteria, and test matrix.
5. Only then prepare a bounded implementation prompt for an explicitly approved WP. No coding or PR merge is authorized by this planning document.
