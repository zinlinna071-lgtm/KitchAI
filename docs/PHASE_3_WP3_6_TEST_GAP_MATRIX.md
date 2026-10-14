# WP3.6 — Initial Test-Gap Matrix

**Status:** Phase A reconnaissance draft; static repository inspection only. This is not test-execution evidence and does not authorize implementation beyond the approved WP3.6 scope.

**Repository baseline inspected:** `main` at `2c0e476e7d16594c9b797965e437159919427dcd` (PR #57 merge), 2026-10-15.

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
