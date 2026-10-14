# WP3.1 Implementation Report

**Merged implementation:** PR #38 at `2decd7bb6fa6d1836d1b66bc96e0a5fbe6e57a78`; PR #39 at `723f73f774be4377b462cc1e68f0a269f489cfcf`.  
**Status:** Inventory foundation and adapter are merged; post-merge main Supabase verification remains pending/retrying after a Docker image-pull rate limit.  
**Hosted resources:** None provisioned. No billing, production secrets, or deployment performed.

## Implemented in this draft

- `src/inventory-domain.js` — exact six-decimal decimal-string/BigInt quantity primitives, stock movement validation, explicit lot allocation validation, operator-confirmed carry-over, and `sale` as a finished-stock outflow separate from sale pricing/revenue.
- `tests/inventory-domain.test.mjs` — six focused Node tests.
- `src/business-data-store.js` — additive IndexedDB v2→v3 schema upgrade with `stockMovements`, `finishedLots`, `inventoryCommands`, and `stockMovementLotAllocations`; Phase 2 stores and indexes are retained.
- `.spikes/wp1-1-local-sync/tests/app-shell.smoke.spec.js` — populated v2 database test covering existing catalog records, recipe-line number compatibility, outbox, sync metadata, migration ledger, conflicts, additive stores/indexes, legacy-source preservation, failed mapping then retry, and reload idempotency. First CI attempt exposed a test harness closed-connection bug; a fix is committed and the rerun is pending.
- `supabase/migrations/20261013000000_phase3_inventory_foundation.sql` — owner-scoped inventory tables reusing the existing Phase 2 composite owner/business key, RLS, read-only stock/lot access, no direct client access to the idempotency command table, append-only stock movements, immutable finished-lot/output consistency validation, production movement stock-class checks, and corrected PL/pgSQL dollar quoting for the finished-lot trigger, and persisted finished-lot allocations with deferred exact-sum checks.
- `supabase/tests/database/phase3_inventory.test.sql` — pgTAP checks for RLS/grants, output/lot linkage, lot/output quantity integrity, immutable movements/lots, zero-quantity rejection, production stock-class rules, sale-to-lot allocation and exact-sum enforcement, finished-unit integrality, and cross-owner reads.
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
- Current code-head [app-shell run 38420258964](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420258964) passed, including the populated-v2 migration/retry/reopen/idempotency test and the domain tests. [Baseline run 38420259073](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259073) and [static preview run 38420259044](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259044) also passed.
- [Local Supabase authorization run 38420259349](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259349) and [local vertical-slice run 38420259000](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259000) failed while starting the isolated Supabase Docker stack; the database migration/pgTAP step did not run. Logs from prior attempts explicitly reported Docker Hub `toomanyrequests: Data limit exceeded`. SQL/pgTAP results remain unknown, not passed.
- No local checkout was available in the model execution container because GitHub DNS resolution failed; CI is the repository-level verification source.

## Remaining gates before WP3.1 can be considered complete

1. Confirm the new populated-v2 migration/retry/reopen Playwright test passes on current-head CI and fix any real migration regressions it reveals.
2. Run the Supabase migration and pgTAP suite successfully; review and fix any SQL or test failures. Latest hardening runs are [authorization run 38422447921](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38422447921) and [vertical-slice run 38422447974](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38422447974); at the last check both were still starting the isolated Supabase stack.
3. Review Phase 2 recipe-line quantity compatibility and the full diff.
4. Update this report with final current-head workflow evidence. Do not merge this PR until these gates pass or the owner explicitly changes the acceptance scope.

This is a partial WP3.1 foundation, not a finished inventory workflow. It does not implement inventory UI, production posting, inventory sync, remote idempotency, or integrated conflict preservation.

## Latest review pass — 2026-10-13

- The domain ledger now models `sale` as a finished-stock outflow; sale pricing and revenue remain separate. Owner consumption, giveaway, and waste remain distinct non-sale dispositions.
- Persisted `stockMovementLotAllocations` / `stock_movement_lot_allocations` now records explicit named-lot deductions. Deferred database checks require a finished-stock outflow to be allocated across lots with a total exactly equal to the movement quantity. Allocation rows must match the finished item and unit and are owner-scoped/read-only to clients.
- The populated-v2 browser migration test now also asserts the new local lot-allocation store.
- Current code-head [App Shell run 38424410503](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38424410503), [Baseline run 38424410559](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38424410559), and [Static preview run 38424410630](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38424410630) passed before the final lot-allocation unit-guard/test-only commits; the newest commit's checks are running separately.
- The newest local Supabase runs [authorization 38424410602](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38424410602) and [vertical slice 38424410547](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38424410547) are running/pending on the earlier code head; a current-head run is required to establish SQL/pgTAP results after the final allocation changes.
- WP3.1 remains incomplete. No UI, production-posting RPC, remote idempotency implementation, inventory sync, or integrated conflict-preservation flow is included.


## Verification refresh — 2026-10-13, inventory allocation and v3 migration test fix

- Fixed the legacy Phase 2 migration integration test to expect the current shared IndexedDB schema version **3** (and updated its comment from v1→v2 to v1→v3). The test still seeds v1 data and exercises the runtime's additive migration.
- On implementation commit `a868a04f452951d444bc403d8f3b561e6bfd2b0b`, [Application Shell run 38426418210](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38426418210), [Baseline run 38426418289](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38426418289), and [Static Preview run 38426418207](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38426418207) passed.
- [Local Supabase Authorization run 38426418362](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38426418362) passed. [Local Vertical Slice run 38426418224](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38426418224) passed, including database migration/pgTAP and all 8 browser integration tests. The database test step reported **102 tests passing**.
- Recipe-line compatibility review: existing Phase 2 recipe quantities remain JavaScript numbers in the local store and PostgreSQL `numeric` remotely. The v2→v3 upgrade preserves them unchanged. There is intentionally no recipe-to-inventory conversion or production-consumption posting in WP3.1; a strict adapter and precision/range tests are required before those future workflows.
- This is still a partial WP3.1 foundation. Inventory UI, production posting, inventory sync, trusted remote idempotency, and integrated inventory conflict preservation are not implemented. PR #38 remains Draft and must not be merged.


## Current-head verification — 2026-10-13

The exact-sum guard now has a negative pgTAP case: a finished-stock sale of 3 each allocated to only 2 each must fail when deferred constraints are forced immediate. The fixture is accounted for in the owner-scope RLS count; the entire test transaction rolls back.

All five CI workflows passed on code commit `ae07e57827601e6929f1a28abdda9a40f1f79cf9`:
- [Baseline checks](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38434123234)
- [Application Shell](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38434122835)
- [Static Preview](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38434122588)
- [Local Supabase Authorization](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38434122639): all pgTAP groups passed (40, 37, and 26 tests).
- [Local Supabase Vertical Slice](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38434122993): database suites passed and all 8 Playwright browser integration tests passed.

This confirms the current test suite, not full WP3.1 completion. Inventory UI, production posting workflow, inventory sync, trusted remote idempotency RPC, and integrated inventory conflict preservation are still not implemented. PR #38 remains Draft/unmerged.


## Recipe quantity adapter follow-up

Added `src/recipe-quantity-adapter.js` and `tests/recipe-quantity-adapter.test.mjs`. The adapter refuses unsupported precision/range and common floating-point artifacts rather than silently rounding Phase 2 recipe quantities. Added its syntax check to `npm run check`. Automated verification for this follow-up is pending CI; do not claim these new tests passed until the workflow reports success. The adapter is a guarded boundary only and is not yet connected to production posting.


## Adapter verification refresh — 2026-10-13

- CI first exposed a JSDoc/TypeScript error because the adapter's destructured options parameter made the required `unit` appear optional. The adapter signature now requires the options object and unit.
- Added a guard rejecting legacy JavaScript-number quantities above `Number.MAX_SAFE_INTEGER` and a regression case for `9007199254740992`; unsupported precision continues to fail rather than round.
- On head `8f4db941e91115fe4ea20b10f4bad3fe6546ef6d`, [Application Shell run 38455305594](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455305594) completed successfully, including syntax/type/unit-test/build and browser smoke tests. [Local Supabase Vertical Slice run 38455305557](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455305557) was still running at the time of this update; SQL/pgTAP results for this head are not yet confirmed here.
- This adapter only guards the future recipe-to-inventory boundary. It does not implement production posting, atomic inventory commands, inventory sync, UI, or integrated conflict preservation. WP3.1 remains partial until current-head checks finish and the complete diff is reviewed.

## Final review and current-head verification refresh — 2026-10-14

Reviewed the complete PR #39 diff (eight changed files) against the parent inventory-foundation PR #38. The recipe quantity adapter and its focused tests are internally consistent with the inventory domain contract; the adapter rejects unsupported precision and does not round or convert units. Existing Phase 2 recipe-line values remain unchanged in the v2→v3 migration. This adapter is deliberately not integrated into production posting.

On commit `4ebfca8a7d63955894b0e1f22c777ddfed7d0c87`, current-head CI passed:
- [Application Shell](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455887104): syntax/type checks, Node tests, build, and 17 browser smoke tests passed.
- [Local Supabase Vertical Slice](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455887046): all 103 pgTAP tests passed across the three database files, production build passed, and all 8 Playwright local-Supabase integration tests passed.

The docs-only review refresh that follows does not change application code; fresh CI on the final documentation commit is still required before treating these checks as final-head evidence.

**Acceptance decision:** the four review gates on the current implementation commit are satisfied: current-head application CI passed; SQL migration/pgTAP and browser integration passed; the complete PR #39 diff and Phase 2 quantity compatibility were reviewed; and the implementation report/registry have been refreshed. **WP3.1 itself remains partial and is not marked complete** because the product acceptance scope still lacks inventory UI, production posting, trusted remote idempotency, inventory sync, and integrated inventory conflict preservation. PR #39 and parent PR #38 remain Draft and unmerged.



## Merge and current verification status — 2026-10-14

PR #38 and PR #39 were merged with owner authorization. PR #38's final head passed all five workflows. PR #39's final head passed Application Shell and Local Supabase Vertical Slice, including database tests and all 8 Playwright integration tests. On the resulting main head, Baseline [run 38523934998](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38523934998) and Application Shell [run 38523934985](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38523934985) passed. The post-merge Local Supabase authorization workflow initially failed while pulling the database image with Docker `toomanyrequests: Data limit exceeded`, before pgTAP started; a retry is in progress. The latest main-head vertical-slice workflow has not completed. Thus the post-merge SQL status remains pending, not failed on an assertion and not yet confirmed passing.

The merged foundation does not itself implement a complete inventory workflow. The strict recipe quantity adapter is not connected to production posting; inventory UI, atomic trusted posting RPC, production consumption, inventory sync, and integrated conflict preservation remain future work. See [WP3.2 plan](./PHASE_3_WP3_2_PLAN.md).
