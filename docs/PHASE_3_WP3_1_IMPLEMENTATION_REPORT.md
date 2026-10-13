# WP3.1 Implementation Report (Draft)

**Branch:** `feat/wp3-1-inventory-domain-model`  
**Base:** `main` at `d008ea10f69cf3ff91f316dc5508f898ccec7bf3`  
**Status:** Partial implementation; review and migration evidence gates remain open.  
**Hosted resources:** None provisioned. No billing, production secrets, deployment, or merge performed.

## Changed files

- `docs/PHASE_3_WP3_1_IMPLEMENTATION_PLAN.md` — source-to-change map and invariants.
- `src/inventory-domain.js` — exact decimal quantity primitives, movement validation, explicit lot allocation, and carry-over suitability confirmation.
- `tests/inventory-domain.test.mjs` — six focused Node tests.
- `src/business-data-store.js` — additive IndexedDB v2→v3 schema upgrade with `stockMovements`, `finishedLots`, and `inventoryCommands` stores/indexes; existing store definitions are retained.
- `package.json` — include inventory module in explicit syntax checks.
- `supabase/migrations/20261013000000_phase3_inventory_foundation.sql` — owner-scoped inventory command, stock movement, and finished-lot tables; RLS, client read-only grants, and append-only stock-movement trigger.
- `supabase/tests/database/phase3_inventory.test.sql` — pgTAP coverage for RLS/grants, valid output/lot linkage, append-only behavior, zero-quantity rejection, finished-unit integrality, and cross-owner reads.
- `docs/PHASE_3_WP3_1_IMPLEMENTATION_REPORT.md` — this report.

## Domain contract implemented

- Quantity values are decimal strings, parsed into scaled `BigInt` values at six fractional places, matching the selected `numeric(24,6)` limit. Excess precision, malformed values, overflow, zero posted quantities, and negative results are rejected.
- The unit allowlist remains `g`, `kg`, `ml`, `l`, `each`; no conversion is performed. Fractional ingredient `each` is supported; finished-product `each` must be integral.
- Stock movement input is positive and uses explicit `in`/`out` direction. Fixed movement kinds validate direction. Corrections/reversals require a related event ID.
- Lot allocations must name unique lots, use compatible units, and sum exactly to the requested quantity.
- Carry-over requires explicit operator suitability confirmation; the helper creates no stock event.
- The IndexedDB migration is additive: existing Phase 2 stores/indexes are guarded and not recreated or repurposed.

## Verification evidence

- **Focused isolated Node harness:** 6/6 tests passed for arithmetic, boundary rejection, units, movement validation, allocation equality, and carry-over confirmation.
- **Repository `npm test`, `npm run check`, `npm run build`, `npm run check:pages-preview`: NOT RUN.** A local checkout could not be obtained in this execution environment because DNS resolution for `github.com` failed. The isolated harness is not a substitute for running the checked-in repository tests.
- **Populated IndexedDB v2→v3 migration test: NOT RUN / not yet implemented.** No claim is made that migration preservation has been demonstrated.
- **Supabase SQL/RLS foundation and pgTAP tests: NOT IMPLEMENTED / NOT RUN.** No hosted or local Supabase resources were provisioned.
- **End-to-end owner isolation, remote idempotency, conflict preservation, and atomic aggregate posting: NOT RUN.** The new inventory command store is a data-model seam only; the Phase 2 sync engine does not yet sync inventory events, and no production posting workflow is implemented.

## Required before WP3.1 can be considered complete

1. Add populated-v2 IndexedDB migration tests covering all existing stores, indexes, outbox, sync metadata, conflicts, migration ledger, and legacy-source preservation; include failure/reopen/idempotency.
2. Run the new Supabase migration and pgTAP tests locally; fix any SQL/test failures.
3. Add populated-v2 migration tests covering existing stores, indexes, outbox/sync/conflicts/ledger and legacy-source preservation, including failure/reopen/retry.
4. Run the actual repository's complete test/typecheck/build/preview checks and the relevant local Supabase suite.
5. Review migration failure behavior and quantity compatibility with all Phase 2 recipe-line fixtures before merge.
6. Update this report with real check output. Do not merge this PR until these gates pass or the owner explicitly changes the acceptance scope.

This report intentionally records partial status rather than implying that the whole WP3.1 acceptance checklist is complete.
