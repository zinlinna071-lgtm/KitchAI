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

The implementation is partial. The populated-v2 migration test and local Supabase database/authorization suites have run on the implementation code commit; the current post-test-fix workflow evidence is recorded in the implementation report. A documentation-only follow-up will trigger CI again. This plan is not evidence that WP3.1 is complete.
