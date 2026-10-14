# Phase 3 WP3.1 — Implementation Plan

**Branch:** `feat/wp3-1-inventory-domain-model`
**Base:** `main` at `d008ea10f69cf3ff91f316dc5508f898ccec7bf3`
**Status:** Implementation in progress; domain foundation and v2→v3 migration are implemented on the feature branch. WP3.1 remains incomplete until final-head CI evidence and full review are recorded.

## Source-to-change map

| Existing source | Verified baseline | Planned WP3.1 treatment |
|---|---|---|
| `src/business-data-store.js` | `kitchai-business-data` IndexedDB v2; scoped Phase 2 stores, durable operations, sync metadata, migration ledger, conflicts, and legacy reconciliation | Add only inventory stores/indexes in an additive v2→v3 upgrade. Preserve all existing stores, keys, indexes, migration-ledger semantics, and legacy source records. |
| `src/recipe-store.js` | Recipe-line quantities are JavaScript numbers; unit allowlist is `g`, `kg`, `ml`, `l`, `each`; no conversions | Do not silently rewrite recipe-line data or claim exact-six-decimal compatibility without a verified migration strategy. Keep existing API behavior unchanged in WP3.1 unless compatibility can be proven. |
| `src/phase2-sync-engine.js` | Explicit Phase 2 entity mappings only; dependency ordering is not an atomic multi-record server transaction | Do not claim inventory records sync automatically. Keep full inventory sync/production posting out of scope unless trusted remote atomicity and tests can be implemented safely. |
| `supabase/migrations/*` and `src/supabase-api.js` | Existing business-profile and Phase 2 owner-scoped patterns; no inventory ledger contract found in source review | Inspect exact SQL/RLS conventions before adding any remote schema. Never treat client-supplied owner IDs as authorization. |
| `package.json` | `npm test`, `npm run typecheck`, `npm run build`, `npm run check` | Add domain modules to explicit syntax checks and add focused automated tests; report only checks actually executed. |

## Invariants

- Stock history is append-only; balances are projections, not independent truth.
- Posted movement quantities are positive, exact decimal strings with six fractional decimal places at most; no implicit unit conversion.
- Preserve the exact unit allowlist `g`, `kg`, `ml`, `l`, `each`.
- Finished-product `each` quantities are whole numbers; fractional `each` may be allowed for ingredient recipe quantities only if represented safely.
- Every finished-stock reduction (including sale, owner consumption, giveaway, and waste) requires explicit positive named-lot allocations whose exact sum equals the movement quantity; no implicit FIFO or safety inference. Sale pricing/revenue is separate from the stock movement.
- Owner/business scope is mandatory. Same stable event ID is an idempotent retry; different IDs remain distinct events.
- Carry-over requires operator confirmation and is not itself a stock movement. Regular/discounted sales are represented as sales records plus a `sale` stock outflow; this inventory ledger does not itself calculate or recognize revenue.
- No hosted provisioning, production deployment, secret changes, or PR merge.

## Phase 2 recipe-quantity compatibility review

Review confirmed that `src/recipe-store.js` validates and stores recipe-line quantities as JavaScript numbers, while the existing Phase 2 SQL column is PostgreSQL `numeric`. The v2→v3 IndexedDB upgrade preserves existing recipe-line records and their numeric quantity values without rewriting them. WP3.1 does not convert recipe lines into the inventory domain's six-decimal string representation and does not implement production consumption/posting. Before those workflows are built, add an explicit, tested adapter that rejects unsupported precision/range rather than rounding or silently reinterpreting existing quantities. No implicit unit conversion is allowed.

## Verification status

The implementation is partial. Current-head CI on code commit `ae07e57827601e6929f1a28abdda9a40f1f79cf9` passed all five gates, including the new negative test that rejects incomplete finished-lot allocations. The implementation report links the exact runs. WP3.1 is not complete; inventory UI, production posting, inventory sync, trusted remote idempotency, and integrated conflict preservation remain out of scope for this foundation.


## Recipe quantity adapter follow-up

Added `src/recipe-quantity-adapter.js` as a strict boundary for future production posting. It accepts only finite positive legacy JavaScript numbers whose canonical decimal string is plain base-10 with at most six fractional digits, then delegates unit/range/finished-`each` validation to the inventory domain. Scientific notation, floating-point artifacts such as `0.1 + 0.2`, excess precision, invalid units, and numeric(24,6) overflow are rejected; there is no rounding or unit conversion. Focused tests cover supported values and rejection cases. This adapter is not yet wired into a production workflow and does not complete WP3.1.

## Final review refresh — 2026-10-14

The strict recipe quantity adapter and its focused tests are now present. Review confirms it refuses unsupported decimal representations rather than silently rounding and leaves existing Phase 2 recipe-line data unchanged. On implementation commit `4ebfca8a7d63955894b0e1f22c777ddfed7d0c87`, application-shell CI passed and the local Supabase vertical slice passed all 103 pgTAP tests and all 8 browser integration tests. WP3.1 remains incomplete because inventory UI, production posting, trusted remote idempotency, inventory sync, and integrated conflict preservation are not implemented. Fresh CI is required after this documentation refresh.

