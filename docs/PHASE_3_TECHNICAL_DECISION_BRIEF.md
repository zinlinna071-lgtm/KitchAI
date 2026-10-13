# Phase 3 Technical Decision Brief — WP3.1 Gates

**Date:** 2026-10-13  
**Status:** For owner review; recommendations are not yet approved  
**Purpose:** Resolve the independent technical gates that remain after D3-01–D3-11 business-policy selections were recorded.

Related: [Decision Log](./DECISIONS.md), [Technical Gate Reconciliation](./PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md), [Domain Contract](./phases/PHASE_3_DOMAIN_CONTRACT.md), [Phase 3 Plan](./phases/PHASE_3_PLAN.md).

## What this brief does not do

This is not a schema, code, or deployment approval. No application code, IndexedDB migration, SQL migration, hosted resource, billing, secret, or production change is authorized by the recommendations below. The owner may accept the whole recommended baseline, amend individual items, or defer an item with a safe boundary.

## Recommended baseline for owner review

| ID | Recommended technical direction | Why this is recommended | Safe boundary / required evidence |
|---|---|---|---|
| T3-01 — Stock source of truth | Use an append-only stock-movement ledger as canonical history. Current balances are derived/rebuildable projections, never a separate competing truth. | Every stock quantity can be explained, audited, and rebuilt; count corrections do not erase history. | Before implementation, define opening-balance events, event ordering, reversal links, and a reconciliation failure state. |
| T3-02 — Movement representation | Use explicit movement direction/kind plus a positive quantity; reject zero-effect posted movements. Corrections/reversals are new linked events. | Prevents ambiguous combinations such as negative “out” quantities and makes validation consistent. | Confirm exact movement kinds and links in the domain contract; no posted event edits/deletes. |
| T3-03 — Atomic production command | One local IndexedDB transaction for batch + ingredient-out + finished-lot/output-in + allocation + outbox; one trusted server-side transaction/RPC for the remote aggregate. | The current sync engine orders individual entity operations but does not make several stock effects atomic. | Same stable operation ID must be idempotent after a lost acknowledgement; insufficient stock or any validation error commits none of the aggregate. |
| T3-04 — Lot allocation | Every finished-stock reduction explicitly names the lot(s); allocation quantities must sum exactly to the disposition. No implicit FIFO or automatic “oldest lot” choice in the first release. | Preserves traceability and avoids silently choosing a lot that an operator may not consider suitable. | Carry-over references the same lot and does not add stock. Operator confirmation—not elapsed time—determines carry-over suitability. |
| T3-05 — Quantity precision proposal | Use exact decimal quantities represented as strings at domain/API boundaries and exact scaled-integer arithmetic internally (six fractional decimal places); use PostgreSQL numeric(24,6) for matching remote storage. Reject more than six fractional digits instead of rounding. Permit fractional each for ingredient quantities to support divisible ingredients; require whole-number each for finished-product stock. | Avoids binary-float balance drift, preserves practical recipe fractions, and keeps finished-item counts integral. | This is a concrete proposal, not an approved limit. Validate compatibility with existing Phase 2 recipe-line numbers; test boundaries, overflow, round trips, repeated calculations, and exact allocation sums before coding. Owner may choose different scales or each rules. |
| T3-06 — Time semantics | Store createdAt/recordedAt and effectiveAt as ISO 8601 UTC timestamps. Defer authoritative business-day/timezone summaries and automatic expiry rules; do not infer food safety from timestamps. | UTC timestamps preserve ordering across devices while avoiding a silent assumption about the business-day boundary. | The UI may format timestamps for display, but daily totals or expiry automation must wait for a reviewed business timezone/rule. Operator carry-over confirmation remains required. |
| T3-07 — IndexedDB upgrade | Add approved Phase 3 stores/indexes via additive kitchai-business-data v2→v3 upgrade. Preserve every v2 store, record, index, outbox operation, sync metadata, conflict, migration-ledger entry, and legacy source record. | Builds on the existing consolidated database and current migration behavior rather than introducing a second inventory database. | Test from a populated v2 fixture, including failure/reopen/idempotent restart; do not bump separate Phase 1 databases. |
| T3-08 — Remote authorization and conflict | Use a trusted server-side aggregate RPC/transaction with server-derived owner scope, stock preconditions, and stable idempotency ID. Preserve distinct conflicting events for explicit review; never auto-merge stock changes. | Client-side validation and ordered upserts cannot protect concurrent cross-device stock updates. | Local Supabase/pgTAP and Playwright must prove atomicity, owner isolation, retry idempotency, conflict preservation, and no partial application. Hosted behavior remains unproven and unauthorized. |

## Explicitly retained boundaries from the owner's selected D3 policies

- Official inventory valuation, COGS, and profit remain Phase 5 scope (D3-01).
- No silent rounding or unit conversion (D3-02).
- Insufficient stock blocks production completion; no negative stock or override in the first release (D3-03).
- Partial receiving is allowed; only actual receipts affect stock (D3-04).
- Actual production use/output is recorded separately from recipe baselines (D3-05).
- Operator confirms carry-over suitability; no age-only safety inference (D3-06).
- All sale capture, including discounted sales, is deferred to Phase 4 (D3-07).
- Owner consumption, giveaway, waste, and correction remain distinct (D3-08).
- Physical count corrections are append-only, reasoned, and explicitly confirmed (D3-09).
- Supplier is optional; tax/shipping allocation is deferred (D3-10).
- Same-ID retries are idempotent; distinct conflicting stock events are preserved for explicit review (D3-11).

## Owner review response format

The owner can reply in one message using any of these forms:

- **Accept all recommended technical directions T3-01–T3-08**, subject to the listed acceptance tests and with T3-05 precision/each limits explicitly treated as the proposed six-decimal rule.
- **Accept all except:** T3-05 (replace with a different quantity rule), T3-06 (specify a business timezone/rule), etc.
- **Defer:** identify the T3 item and the safe behavior that must remain disabled or restricted.

If accepted, the next step is to reconcile the selected technical directions into the domain contract, decision log, WP acceptance criteria, and test matrix. Only after that reconciliation should a separate bounded WP3.1 implementation prompt be prepared. Acceptance of this brief alone does not authorize implementation or PR merge.
