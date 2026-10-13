# Phase 3 Plan — Purchasing, Inventory & Production

**Status:** PROPOSED — NOT APPROVED FOR IMPLEMENTATION  
**Change type:** Documentation and planning only  
**Target branch:** `docs/phase-3-production-inventory-plan`  
**Prerequisites:** Phase 2 menu items, ingredients, recipes, recipe lines, and existing offline/sync foundation  
**Implementation status:** Not started. No application code, schema, migrations, or hosted resources are changed by this plan.

**WP3.1 review handoff:** [CODING_AI_PHASE3_WP3_1_REVIEW_PROMPT.md](../CODING_AI_PHASE3_WP3_1_REVIEW_PROMPT.md) is a read-only repository/domain-contract review prompt. It does not authorize implementation and requires the Coding AI to stop after reporting findings.

**Repository review findings:** [PHASE_3_WP3_1_REPOSITORY_REVIEW.md](../PHASE_3_WP3_1_REPOSITORY_REVIEW.md) records a source-grounded read-only review. Verdict: contract clarifications are required before a runtime implementation prompt; no tests were run and WP3.1 is not complete.

**Contract clarification draft:** The domain contract now includes §0.1 proposed clarifications PC-1–PC-8 for ledger authority, local/remote atomic posting, movement/correction semantics, lot allocation, v2 migration safety, event retry/conflict handling, scope/time validation, and cost-input boundaries. These proposals are **pending owner review**, not approvals. D3-01–D3-11 remain OPEN; implementation remains blocked.

**Owner decision aid:** [PHASE_3_OWNER_DECISION_BRIEF.md](../PHASE_3_OWNER_DECISION_BRIEF.md) lays out options, trade-offs, and suggested discussion defaults for D3-01–D3-11. It does not resolve or approve any decision.

## 1. Goal

Build an auditable inventory workflow for a small food business that buys ingredients, produces food either after a customer request or ahead in batches, sells finished items over time, and handles leftovers according to whether they remain safe and suitable to keep.

Phase 3 must make the quantities and movement history understandable without claiming that inventory alone is a complete accounting or sales system.

## 2. Business workflow to support

1. **Purchase ingredients:** record supplier (optional where no supplier record is available), item, quantity, unit, price/cost, purchase status, and receipt. Drafting or cancelling a purchase must not change on-hand stock; receiving it changes stock exactly once.
2. **Track ingredient stock:** show on-hand quantity and an auditable movement history. Support opening stock, receipts, production consumption, waste, and reasoned adjustments.
3. **Produce food:** create a production batch for either `make-to-order` (prepared for a customer request) or `make-ahead` (prepared before a confirmed sale). Link the batch to a Phase 2 menu item/recipe where applicable. Record planned and actual output, actual ingredient consumption, time/date, and operator/source where supported. Recipe quantities are a planning baseline, not proof of actual consumption.
4. **Create finished-product stock:** completed production transfers value/quantity from ingredient stock into finished-product stock. Do not deduct the same ingredients again when a finished item is sold or disposed of.
5. **Handle unsold finished food:** at the end of a selling period, explicitly classify each quantity as:
   - carry over for later sale, only when the food is confirmed safe and suitable to keep;
   - discounted sale, recording the actual price received for the quantity;
   - owner/personal consumption;
   - giveaway / provided free to another person;
   - waste/spoilage/discard.
   Each outcome must reduce finished-product stock exactly once. Carry-over is not waste; personal consumption and giveaways are not sales revenue; discarded items are losses; discounted sales use actual revenue rather than list price.
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

**Acceptance evidence:** batch examples, quantity-conservation tests, validation for insufficient stock (policy decision still open), duplicate-submit/idempotency tests, and regression tests for Phase 2 recipes.

### WP3.4 — Finished Goods, Leftovers & Disposition
Track on-hand quantities of produced items separately from ingredients. Record batch/date and quantities carried over, discounted, consumed by owner, given away, or discarded. Record actual price for any discounted-sale entry supported in Phase 3, without attempting to implement a complete customer/order/payment system. Carry-over must preserve the existing batch identity and must not create a second production cost.

Food-safety/shelf-life suitability must be entered or confirmed by the operator under an explicitly configured rule; the app must not automatically declare food safe based only on age.

**Acceptance evidence:** end-of-day reconciliation examples; all disposition categories are distinct; carry-over is not counted as new production or waste; owner consumption/giveaways have no sales revenue; discarded and discounted quantities use correct stock and revenue treatment.

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

| ID | Decision needed | Suggested default for review | Status |
|---|---|---|---|
| D3-01 | Costing method for ingredient/finished stock | Start with a transparent documented method; compare weighted average vs FIFO before choosing | OPEN |
| D3-02 | Stock quantity precision and rounding | Keep unit-specific precision and never round silently | OPEN |
| D3-03 | What to do when production needs more ingredients than on hand | Block completion or require an explicit, audited override; choose after UX/risk review | OPEN |
| D3-04 | Partial receiving and purchase cancellation behavior | Allow partial receipt; never change stock for unreceived quantity | OPEN |
| D3-05 | Planned recipe quantity vs actual ingredient usage | Record actual usage and variance; recipe remains a baseline | OPEN |
| D3-06 | Finished-food carry-over and shelf-life rules | Operator confirms suitability; configurable rules only after review | OPEN |
| D3-07 | Phase 3 discounted-sale capture boundary | Capture minimal disposition quantity and actual price only; full sales/order workflow remains Phase 4 | OPEN |
| D3-08 | Owner consumption, giveaway, and waste reasons | Separate required disposition types; define reason fields and reports | OPEN |
| D3-09 | Physical count adjustments and correction permissions | Append-only adjustment history with reason and explicit confirmation | OPEN |
| D3-10 | Supplier data required fields and purchase-cost handling | Keep supplier optional for ad hoc purchases; define required price/tax/shipping fields after review | OPEN |
| D3-11 | Phase 3 sync/conflict UX for stock movement conflicts | Preserve both versions and require explicit review; never auto-add conflicting movements | OPEN |

## 6.1 Recommended defaults for owner review (not approvals)

To avoid repeatedly reopening routine choices while protecting material business decisions, the following defaults are recommended. They remain recommendations until the owner decision log explicitly changes their status.

| ID | Recommended default | Why |
|---|---|---|
| D3-01 | Defer official inventory valuation/COGS and profit calculations to Phase 5; preserve actual purchase-cost inputs and batch consumption references now | Avoids presenting an unreviewed costing method as accounting truth |
| D3-02 | Preserve numeric precision, prohibit silent rounding/conversion, and define unit-specific limits in tests before UI release | Prevents hidden quantity drift |
| D3-03 | Block production completion when recorded local stock is insufficient; do not add negative stock or an override path in the first release | Safest, auditable behavior until a deliberate override workflow is specified |
| D3-04 | Allow partial receipts; only actually received quantities affect stock; cancelled/unreceived quantities do not | Matches real deliveries and prevents false stock |
| D3-05 | Record actual ingredient use and actual output; compare with recipe baseline and show variance | Real production can differ from the recipe |
| D3-06 | Require operator confirmation for carry-over suitability; configure any shelf-life prompts only after a separate reviewed rule | App cannot infer food safety from age alone |
| D3-07 | In Phase 3, record a minimal finished-stock disposition for regular/discounted sale and actual amount received; keep customer/order/payment lifecycle in Phase 4 | Allows stock to reconcile without duplicating the full sales system |
| D3-08 | Always distinguish owner consumption, giveaway, and waste; require a reason for waste/adjustment, allow optional notes for owner consumption/giveaway | Keeps reporting useful without making routine entries cumbersome |
| D3-09 | Show count variance, require reason, and append a correction movement; require explicit confirmation before posting | Protects audit history |
| D3-10 | Supplier is optional; capture received quantity, unit, unit price, currency, and receipt date; decide taxes/shipping before including them in valuation | Supports informal purchases while preserving usable cost inputs |
| D3-11 | Preserve conflicting movement snapshots and require explicit manual review; never automatically add/merge conflicting stock changes | Prevents silent quantity corruption |

If these defaults are accepted or explicitly deferred, update `docs/DECISIONS.md` before the corresponding implementation WP. Do not treat this table as owner approval.

## 7. Phase 2 boundary and owner smoke-test note

The owner reported manually trying online/offline behavior, data entry, value correctness, and persistence, and said the observed behavior was good. This is useful owner smoke-test feedback only. It does not replace documented evidence for hosted sync, real two-device behavior, backup/export/restore, food-safety validation, or production readiness. Phase 3 must retain all Phase 2 known limitations and deferred checks in the exit review.

## 8. Implementation gate

This document is a proposed plan, not authorization to start implementation. Before the first coding WP:
1. Review this scope and resolve or explicitly defer material decisions.
2. Confirm the Phase 2 exit record and known limitations are understood.
3. Update the decision log and WP registry with owner-reviewed status.
4. Only then prepare a bounded coding prompt for the first approved WP.
