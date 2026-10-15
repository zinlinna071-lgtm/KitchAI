# WP3.6 — Initial Test-Gap Matrix

**Status:** Phase A reconnaissance completed; the first combined database integration test has now been exercised by the existing local-Supabase CI workflows on PR #59. Remaining gaps below are not all closed by this one test.

**Repository baseline inspected:** `main` at `2c0e476e7d16594c9b797965e437159919427dcd` (PR #57 merge), 2026-10-15.

## Verified implementation evidence (2026-10-15)

- Added `supabase/tests/database/phase3_cross_workflow.test.sql` on PR [#59](https://github.com/zinlinna071-lgtm/KitchAI/pull/59), using synthetic fixtures and a transaction rollback.
- The test composes accepted ingredient receipt (10,000 g) → production consumption (2,500 g) and 4-unit finished lot → giveaway of one finished unit with lot allocation → reviewed physical count correction (7,500 g to 7,400 g).
- The PR-head SHA `7b8ec3a999a23b14ba26c8a3ba9bc4640e62790d` ran both existing local-Supabase workflows successfully: [WP1.6 run 38658086812](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38658086812) and [WP1.4 run 38658086810](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38658086810). Their database test steps execute `supabase test db`, which includes the new SQL test under `supabase/tests/database/`.
- This is evidence for the combined server-side database path only. It does not prove UI/store orchestration, lost-acknowledgement fault injection across every command, real-device/mobile acceptance, or all Phase 3 exit criteria. Do not mark Phase 3 complete from this evidence alone.

## Purpose and method

This matrix records visible existing coverage and candidate gaps for WP3.6. The Coding AI must verify each entry against the latest checkout, complete the matrix before code edits, and correct any finding that differs from current source. No local checkout or test runner was available in this reconnaissance step; no tests are claimed to have run.

## Initial matrix

| Invariant / workflow | Existing evidence found in repository | Initial gap assessment | Candidate next test / action |
|---|---|---|---|
| Purchase draft and partial receiving | `tests/purchase-domain.test.mjs`: validated draft, stable receipt command, partial receipt reservation, over-receipt rejection, pending vs confirmed quantities | Domain rules are covered; full receipt-to-authoritative-ledger workflow is not demonstrated by this unit file | Trace current receipt UI/store/RPC and add an integration assertion only if the current DB/browser suite lacks receipt acceptance and final balance checks |
| Inventory command idempotency and atomicity | `supabase/tests/database/phase3_inventory_commands.test.sql`: accepted receipt, replay/no duplicate movement, payload mismatch rejection, negative-stock rejection, multi-row rollback, production rollback/posting and retries | Strong command-level DB coverage visible; confirm receipt retry is explicitly covered and record exact test names | Verify exact SQL assertions and identify only uncovered command-type retry cases |
| Production recipe snapshot and actual usage | `tests/production-batch-store.test.mjs`: immutable recipe snapshot, explicit actual-usage decision per line, quantity/unit validation, stable IDs and atomic command shape; DB command tests cover production posting/retry and rollback | Domain and DB posting are covered separately; composition with a preceding accepted receipt and following disposition is not shown | Add to the combined vertical slice if fixtures can safely compose existing supported APIs |
| Finished-lot traceability and dispositions | `tests/finished-stock-domain.test.mjs`: lot balance, allocation checks, sale/discounted sale, owner consumption, giveaway, waste, carry-forward; DB command tests include carry-forward replay and finished-lot allocation | Domain disposition coverage is broad; a single end-to-end run proving resulting authoritative lot balance and later stock count is not shown | Reuse supported non-revenue disposition (e.g. giveaway or waste with required reason) in composed E2E; assert DB ledger/lot rows |
| Stock-count snapshot/version consistency | `supabase/tests/database/phase3_inventory_item_versions.test.sql`: server snapshot, internal token protection, monotonic version, retry, rollback, cross-owner rejection; `phase3_atomic_stock_count_posting.test.sql`: anonymous rejection, immutable audit, retry, stale rejection, atomic subset rollback, zero-variance audit | DB-level safety cases appear well represented; verify test execution in CI and cross-workflow composition | Preserve the existing stale-count and atomic-subset tests; add composition coverage only for uncovered interaction |
| Stock-count browser experience | `tests/stock-count-ui.browser.spec.js`: accessible controls, empty-draft posting disabled, no page errors on initial state, 360px no-overflow smoke; PR #57 adds authenticated local-Supabase stock-count E2E | Authenticated count E2E is separate from purchasing/production/disposition; mobile assertions appear limited to the empty state | Extend authenticated E2E only where it can assert a supported workflow; keep mobile overflow/no-console-error checks |
| Cross-workflow authoritative final state | Relevant purchase, production, finished-stock and count unit/DB suites exist separately | **Likely principal WP3.6 gap:** no combined purchase receipt → production posting → finished-stock disposition → stock count test identified in inspected filenames/suite descriptions | Build one local-Supabase integration/E2E path using synthetic fixtures; assert final authoritative ingredient and finished-lot balances plus append-only movement/audit records |
| Lost acknowledgement / uncertain outcome | Store/domain tests include pending/rejected states in some flows; PR #57 tests a server-confirmed count posting | A cross-workflow test for lost acknowledgement and same-command retry was not established by this static review | Inspect each store's retry protocol; add fault-injection test only if local test seams already exist, otherwise document as blocked rather than inventing a new mechanism |
| Cross-owner and anonymous access | SQL tests explicitly cover anonymous count posting rejection, cross-owner inventory snapshot/command rejection and trusted count audit protections | Strong cases are visible for key RPCs; verify every used RPC has appropriate server-side authorization | Add a negative test only for an actual uncovered endpoint in the composed path |
| Required workflow gates | `.github/workflows/app-shell.yml`, `pages-preview.yml`, `supabase-local.yml`, `wp3-5e-browser.yml` exist; each has path filters | A documentation-only PR does not touch the configured app/test paths, so no CI run on PR #58 is expected from these workflows | For implementation PR, inspect exact trigger filters and ensure the changed paths cause the appropriate required workflows to run |
| Manual device/accessibility checks | Existing plans distinguish automated smoke checks from manual acceptance | Not verified by CI and not performed during this review | Record as deferred until a human actually tests a device/screen reader; do not mark passed |

## Recommended implementation order

1. Coding AI checks out the latest `main`, reads the current status/registry/decision log and WP3.5 plan, and reconciles this matrix with current source.
2. Confirm which integration-test harness can start local Supabase, create a synthetic authenticated owner/business, and query authoritative state.
3. Add the combined vertical slice first, without expanding product behavior.
4. Add only demonstrated missing retry/uncertain-acknowledgement/authorization/concurrency tests.
5. Run the relevant workflows on the latest PR head and record exact run URLs, head SHA, test counts, and any tests that did not execute.
6. Update `docs/STATUS.md` and `docs/WP_REGISTRY.md` with evidence; keep the PR draft and do not merge.

## Boundaries

- Synthetic disposable data and local Supabase/emulators only.
- No hosted provisioning, billing, production secrets, paid services, or deployment.
- No direct edits to `main`; no merge without owner review and all required CI passing.
- Do not claim test results based on static file inspection.

## Source inspection refresh — 2026-10-15 (owner accepted the plan)

The following source-level checks were performed against `main` at `2c0e476e7d16594c9b797965e437159919427dcd` after reviewing the actual file tree and relevant test/workflow files. This remains static inspection, not test execution.

- **Purchasing:** `tests/purchase-domain.test.mjs` verifies draft validation, stable receipt-command construction, partial-receipt reservations, over-receipt rejection, and pending-versus-confirmed projection. `src/purchase-store.js` persists a receipt before delivery and calls the shared inventory command RPC; no combined browser scenario was found that starts from the purchase UI and later proves the final count result.
- **Production:** `tests/production-batch-store.test.mjs` covers recipe snapshots, actual-usage decisions, supported output quantities, and inventory-command construction. `supabase/tests/database/phase3_inventory_commands.test.sql` covers server-side production command behavior, but that is not evidence that a preceding UI-created purchase receipt funds a production batch in the same end-to-end scenario.
- **Finished stock:** `tests/finished-stock-domain.test.mjs` covers lot projections and disposition command construction. `src/finished-stock-workflow-store.js` persists immutable inventory commands for server delivery. Existing domain/SQL coverage does not itself prove the composed receipt → production → disposition → count path.
- **Stock count:** `supabase/tests/database/phase3_inventory_item_versions.test.sql` and `supabase/tests/database/phase3_atomic_stock_count_posting.test.sql` cover server snapshots, versions, retry, stale rejection, append-only audit and atomic posting. The authenticated local-Supabase browser scenarios live in `.spikes/wp1-1-local-sync/tests/local-supabase.integration.spec.js` and are run by `.github/workflows/wp1-6-local-supabase.yml`. They validate a count-posting path independently, not the full purchasing/production/disposition composition.
- **Browser smoke distinction:** `tests/stock-count-ui.browser.spec.js` checks the no-workspace/disabled-control state, page errors, and a 360px viewport. It should not be described as an authenticated posting test. `.github/workflows/wp3-5e-browser.yml` is the narrow stock-count UI smoke workflow.
- **Workflow triggers:** `.github/workflows/supabase-local.yml` runs local Supabase database tests and the two-session count-concurrency script for matching paths; `.github/workflows/wp1-6-local-supabase.yml` runs database tests, concurrency regression, build and the authenticated local-Supabase browser suite. New integration test paths must be included by the workflow path filters or they may not execute on a PR.

**Updated assessment:** the principal candidate gap remains a single synthetic local-Supabase test that composes receipt → production posting → at least one supported finished-stock disposition → physical count and asserts authoritative balances plus immutable ledger/audit history. Before implementation, the Coding AI must verify whether any scenario elsewhere in the latest checkout already covers this exact composition.

**Execution limitation:** this review environment could inspect GitHub source, but a local checkout could not be created because outbound DNS access to `github.com` was unavailable. No tests were executed here and no test result is inferred from source inspection.



## Latest verification refresh — 2026-10-15 (PR #59 head)

- Updated PR [#59](https://github.com/zinlinna071-lgtm/KitchAI/pull/59) at head `031bf2798c29c55315898c2b3760959816d0a0aa` with two WP3.6.2 assertions in the combined SQL scenario: exact same-command replay after a simulated lost acknowledgement returns the accepted result, and reusing that command ID with a changed payload is rejected.
- [WP1.6 Local Supabase Vertical Slice run 38659411117](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411117) passed on that exact PR head. Its completed steps include database authorization/idempotency tests, two-session stock-count concurrency regression, app build, and authenticated local-Supabase browser coverage for Auth/offline sync/import/conflicts.
- [WP1.4 Local Supabase Authorization run 38659411120](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411120) failed before database tests started because the Supabase Postgres image pull was rate-limited: `toomanyrequests: Data limit exceeded`. The DB test and concurrency steps were skipped. Treat this as an infrastructure-blocked run, not a test assertion failure; rerun when image pulls are available or use an approved caching/registry approach. Do not add credentials or paid resources without approval.
- Existing authenticated stock-count browser E2E from PR [#57](https://github.com/zinlinna071-lgtm/KitchAI/pull/57) passed on its own head `cd5e60a2ba50b0786500b58f1eab50f90f8b5cfe`; see [baseline run 38654092924](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38654092924) and the corresponding PR-head local-Supabase workflow runs. This is prior-head evidence, not a new stock-count browser run on PR #59.
- **WP3.6.3 remains partial:** `tests/stock-count-ui.browser.spec.js` checks the no-workspace/disabled controls, initial page errors, and 360px overflow only in the empty state. The authenticated count E2E exercises session → server snapshot → review → post on its own earlier head, but the combined purchase/production/disposition/count scenario is database-level, not an authenticated cross-workflow browser scenario. Real-device install, offline navigation on device, screen reader, contrast, and manual recovery checks remain deferred.
- **Current assessment:** WP3.6.1 combined server-side DB path is exercised; WP3.6.2 has added count-command replay/payload-mismatch coverage, while other command-specific uncertain-acknowledgement fault injection is not claimed. WP3.6.3 is partial. WP3.6.4 exit recommendation remains **conditional / not ready to close** until required gates are green on the final relevant head and remaining evidence/limitations are recorded. PRs #58 and #59 remain Draft/unmerged.


## WP3.6.3 focused follow-up — Draft PR #60

- Opened [Draft PR #60](https://github.com/zinlinna071-lgtm/KitchAI/pull/60) at head `e9c0560287d58065a385be22ddf727f5bff5f99b`. The authenticated local-Supabase stock-count E2E now sets a 360 × 800 viewport and asserts no horizontal overflow after the full server-confirmed posting workflow, with no uncaught page errors.
- This is a test-only follow-up to the gap identified above. CI evidence is pending; do not count it as passed until the required workflow completes on PR #60's exact head.
