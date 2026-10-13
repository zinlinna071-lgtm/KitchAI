# WP3.1 Implementation Report (Draft)

**Branch:** `feat/wp3-1-inventory-domain-model`  
**Base:** `main` at `d008ea10f69cf3ff91f316dc5508f898ccec7bf3`  
**Status:** Partial implementation; verification and review gates remain open.  
**Hosted resources:** None provisioned. No billing, production secrets, deployment, or merge performed.

## Implemented in this draft

- `src/inventory-domain.js` — exact six-decimal decimal-string/BigInt quantity primitives, stock movement validation, explicit lot allocation validation, and operator-confirmed carry-over.
- `tests/inventory-domain.test.mjs` — six focused Node tests.
- `src/business-data-store.js` — additive IndexedDB v2→v3 schema upgrade with `stockMovements`, `finishedLots`, and `inventoryCommands`; Phase 2 stores and indexes are retained.
- `.spikes/wp1-1-local-sync/tests/app-shell.smoke.spec.js` — populated v2 database test covering existing catalog records, recipe-line number compatibility, outbox, sync metadata, migration ledger, conflicts, additive stores/indexes, legacy-source preservation, failed mapping then retry, and reload idempotency. First CI attempt exposed a test harness closed-connection bug; a fix is committed and the rerun is pending.
- `supabase/migrations/20261013000000_phase3_inventory_foundation.sql` — owner-scoped inventory tables, composite owner/business candidate key for foreign keys, RLS, read-only stock/lot access, no direct client access to the idempotency command table, append-only stock movements, and immutable finished-lot/output consistency validation.
- `supabase/tests/database/phase3_inventory.test.sql` — pgTAP checks for RLS/grants, output/lot linkage, lot/output quantity integrity, immutable movements/lots, zero-quantity rejection, finished-unit integrality, and cross-owner reads.
- `package.json`, `docs/PHASE_3_WP3_1_IMPLEMENTATION_PLAN.md`, `docs/STATUS.md`, and `docs/WP_REGISTRY.md` track scope, checks, and remaining gates.

## Domain invariants

- Quantity values are decimal strings parsed as scaled `BigInt` at six fractional places, matching the selected `numeric(24,6)` range. Excess precision, malformed values, overflow, zero posted quantities, and negative results are rejected.
- Allowed units remain `g`, `kg`, `ml`, `l`, and `each`; no implicit unit conversion is performed. Fractional ingredient `each` is supported; finished-product `each` must be integral.
- Stock movements have positive quantities and explicit `in`/`out` direction. Corrections/reversals must reference a related event.
- Lot allocations name unique lots, use compatible units, and sum exactly to the requested quantity.
- Carry-over requires explicit operator suitability confirmation. The helper does not itself create a stock event.
- Inventory command rows are a future idempotency seam only; no trusted aggregate posting RPC or inventory sync implementation exists yet.

## Verification evidence

- Focused isolated Node harness previously passed 6/6 domain checks.
- On the latest earlier commit, repository syntax/typecheck/unit tests/build passed in the baseline workflow and the static preview workflow passed. The app-shell browser workflow then exposed a bug in the newly added migration test (it read from a closed IndexedDB connection); the test was fixed and the new current-head workflows are pending.
- Latest run links: [App shell run 38418960294](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38418960294), [baseline run 38418960451](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38418960451), [static preview run 38418960332](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38418960332), [local Supabase authorization run 38418960535](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38418960535), and [local Supabase vertical slice run 38418960364](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38418960364).
- Earlier Supabase attempt failed before tests ran because Docker Hub returned `toomanyrequests: Data limit exceeded`. SQL/pgTAP results therefore remain unknown until a successful run.
- No local checkout was available in the model execution container because GitHub DNS resolution failed; CI is the repository-level verification source.

## Remaining gates before WP3.1 can be considered complete

1. Confirm the new populated-v2 migration/retry/reopen Playwright test passes on current-head CI and fix any real migration regressions it reveals.
2. Run the Supabase migration and pgTAP suite successfully; review and fix any SQL or test failures.
3. Review Phase 2 recipe-line quantity compatibility and the full diff.
4. Update this report with final current-head workflow evidence. Do not merge this PR until these gates pass or the owner explicitly changes the acceptance scope.

This is a partial WP3.1 foundation, not a finished inventory workflow. It does not implement inventory UI, production posting, inventory sync, remote idempotency, or integrated conflict preservation.
