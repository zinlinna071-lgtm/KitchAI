# Phase 3 — WP3.6 Integration & Exit Review Plan

**Status:** Planning proposal only. This document does not authorize application implementation, hosted resources, billing, secrets, or deployment.
**Base reviewed:** `main` at `2c0e476e7d16594c9b797965e437159919427dcd` (PR #57 merge).
**Parent:** [ROADMAP.md](./ROADMAP.md), Phase 3 — Purchasing & Inventory.
**Evidence sources:** [STATUS.md](./STATUS.md), [WP_REGISTRY.md](./WP_REGISTRY.md), [WP3.5 plan](./PHASE_3_WP3_5_STOCK_COUNTS_PLAN.md).

## 1. Purpose

Verify that the existing Phase 3 purchasing, ingredient inventory, production, finished-stock disposition, and physical stock-count workflows compose safely as one end-to-end local/emulator-only system. This is an integration and acceptance milestone, not permission to add unrelated features or declare Phase 3 complete without evidence.

Existing merged implementation slices include inventory domain/ledger/guarded quantity adapter/atomic commands (PRs #38, #39, #41); purchasing and receiving (PR #50); production lifecycle and posting (PRs #43, #45, #46, #49); finished-stock traceability and dispositions (PRs #47, #48); physical stock counts (PRs #52–#56); and authenticated stock-count browser E2E (PR #57). These merges do not prove every cross-workflow combination or real-device/hosted behavior.

## 2. Proposed work packages

The IDs below are proposals, not pre-approved implementation scope. Preserve historical IDs and do not reuse them.

### WP3.6.1 — Cross-workflow integration test contract

Define deterministic synthetic fixtures and invariants for:
1. Create/sync a synthetic owner business and ingredient.
2. Create a purchase draft and receive stock; include partial receiving if the existing workflow supports it.
3. Assert server-accepted receipt changes ingredient stock exactly once.
4. Start production from an existing recipe, snapshot inputs, record actual usage/output, and post exactly once.
5. Assert ingredient consumption and finished-lot quantity/traceability.
6. Exercise at least two currently supported finished-stock dispositions (for example carry-forward and waste/giveaway/owner consumption); do not model these as revenue.
7. Create a stock-count session, capture a server snapshot, record/review a variance, explicitly select a reviewed line, and post.
8. Assert final authoritative balance and append-only movement/audit history.

Use isolated local Supabase and synthetic disposable data only. Do not assume unit conversion: use the existing guarded adapter only where its semantics are valid; unsupported precision, unit mismatch, or ambiguous conversion must fail closed.

### WP3.6.2 — Reliability, idempotency, and conflict regression

Verify repeated, delayed, offline, or uncertain requests cannot silently double-apply stock changes or overwrite newer state:
- Stable command IDs and same-payload retry for receipt, production posting, disposition, and count posting where supported.
- Duplicate delivery and lost acknowledgement; accepted commands do not apply twice.
- Rejected versus uncertain outcomes remain distinct; never show success without server acknowledgement.
- Stale-count rejection when another stock-changing command commits after the snapshot.
- Atomic multi-line count posting: stale/invalid lines cause no partial accepted mutation.
- Offline draft/reload/reconnect only where supported by the existing workflow.
- Local Supabase authorization rejects anonymous and cross-owner/business operations.
- Existing Phase 1/2 regressions remain green.

Do not invent a blanket offline guarantee for server-posted inventory commands. Document which actions are offline drafts and which require online server confirmation.

### WP3.6.3 — UI acceptance and mobile smoke review

Automated checks should cover authenticated synthetic-data E2E; accessible control names; at least a 360 CSS-pixel viewport without horizontal overflow; no uncaught browser exceptions; clear local-draft/pending/rejected/uncertain/server-confirmed states; posting guarded when prerequisites or trusted state are missing; and bounded failure-artifact retention.

Record real-device installation, offline navigation, screen-reader, contrast, and other manual checks as deferred unless an owner actually performs them. CI smoke tests are not manual accessibility acceptance or production-readiness proof.

### WP3.6.4 — Phase 3 exit review

Produce an evidence-backed pass/conditional/blocked recommendation. Separate exact automated run results and commit SHAs from manual checks; document limitations; distinguish local/emulator evidence from hosted-provider evidence. Inventory valuation, COGS, sales/revenue accounting, supplier catalog sync, barcode flows, cross-device guarantees, backup/recovery, and production deployment remain out of scope or separately gated as appropriate.

## 3. Non-negotiable invariants

1. Inventory changes are append-only ledger events; never directly overwrite a computed balance or edit historical movements.
2. A successful command and its stock/lot/allocation/audit changes are atomic.
3. Repeating an accepted command with the same ID and payload cannot duplicate its effect; reusing an ID with a different payload is rejected.
4. Never silently round or convert quantities. Unsupported precision or units fail closed.
5. Count posting compares server-authoritative item versions and shares the transaction/locking protocol used by other stock writers. Stale counts are rejected for review/recount.
6. Count drafts/review do not mutate stock; only server-confirmed atomic posting does.
7. Keep inventory outflows separate from sales pricing, revenue, COGS, and profit calculations, which are not part of this scope.
8. Never display success while the server outcome is unknown.
9. Enforce owner/business authorization server-side; clients cannot choose authoritative owner IDs.
10. Use only synthetic fixtures.

## 4. Test strategy and gates

Inspect the actual workflow YAML and scripts on the target branch before editing tests. Relevant existing gates include baseline unit/type/build/dependency checks; application-shell and browser smoke tests; static preview checks; local Supabase authorization and pgTAP; local Supabase Playwright vertical slice; stock-count browser suite; and the authenticated stock-count E2E.

Run required workflows on the final PR head, not an earlier commit. Investigate failures; do not silently waive a required gate. Prefer authoritative DB assertions for balances and ledger events; UI text alone is insufficient. Retain at least one full happy-path composition test plus separate retry/idempotency, negative authorization, and concurrency tests.

## 5. Dependencies and exclusions

**Dependencies:** merged Phase 3 workflows, local Supabase setup, Phase 1 identity/ownership, and Phase 2 catalog/recipe data.

**Excluded:** new commercial features, official valuation/COGS/profit, sales/revenue accounting, payments, AI, barcode scanning, hosted provisioning, paid services, production secrets, domain purchase, deployment, and claims of real cross-device or backup/restore readiness.

## 6. Definition of done

- [ ] Review current source, migrations, test helpers, workflow YAML, and PR #57 before implementation.
- [ ] Build a grounded test-gap matrix before code edits.
- [ ] At least one local-Supabase E2E test verifies receipt → production → finished-stock disposition → stock count with authoritative stock/ledger assertions.
- [ ] Retry/idempotency, uncertain acknowledgement, stale-count concurrency, atomic rollback, and authorization negative cases are covered in current tests.
- [ ] Existing Phase 1/2/3 unit, build, database, browser, and preview gates pass on the final head.
- [ ] Failed browser artifacts are bounded and contain no secrets.
- [ ] Documentation records exact SHA, run links/results, test counts, limitations, and deferred manual checks.
- [ ] Full diff is reviewed; no unrelated refactors, schema churn, new runtime dependencies, or feature creep.
- [ ] Phase 3 exit recommendation states pass / conditional / blocked with evidence.
- [ ] Do not merge until required CI passes. No hosted resources, billing, secrets, or deployment without separate explicit authorization.

## 7. Execution sequence and stop conditions

1. Inspect repository status and current source on latest main; use a dedicated feature branch.
2. Read Phase 3 status/registry/stock-count plan/decisions and inspect relevant modules, RPCs, migrations, pgTAP and Playwright tests.
3. Map each invariant to existing tests and identify exact gaps before implementation.
4. Add only missing integration tests and smallest fixes demonstrated necessary.
5. Run tests and all required workflows on the newest PR head; preserve failure evidence.
6. Review the full diff and update status/registry with exact evidence; open a draft PR and stop before merge.

Stop and report instead of guessing if an operation is unsupported, unit semantics are ambiguous, migrations/tests conflict, a required gate cannot run, or any step requires hosted billing/secrets, paid services, real business data, or deployment.


## 8. WP3.6.4 evidence-backed exit review — 2026-10-15

**Recommendation: CONDITIONAL — do not close WP3.6 or declare Phase 3 complete yet.** This is an evidence review of the current draft implementation PRs, not owner acceptance or merge authorization.

| Exit criterion | Evidence observed | Review result |
|---|---|---|
| Composed authoritative DB path | PR #59 test composes receipt → production consumption/output and finished lot → giveaway allocation → stock-count correction, with balance/ledger/audit assertions. [WP1.6 run 38659411117](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411117) passed on `031bf2798c29c55315898c2b3760959816d0a0aa). | Automated DB scenario passed; not an authenticated cross-workflow browser journey. |
| Authorization and database regression | [WP1.4 run 38659411120](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411120) passed on the same PR #59 head. Logs report 196 tests across 7 files, all successful. | Passed for this local test suite/head. |
| Stale-count concurrency | WP1.4 and WP1.6 logs show the two-session test passed: stock writer lock observed, writer receipt committed/version advanced, stale count rejected with SQLSTATE `40001`, and no accepted count audit left behind. | Passed for the tested concurrency case. |
| Count command uncertain acknowledgement / idempotency | PR #59 adds exact replay returning the accepted result and changed-payload reuse rejection; WP1.6 passed on its exact head. | Partial: not fault-injection coverage for every command type. |
| Authenticated narrow viewport | [PR #60 WP1.6 run 38660630936](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38660630936) passed on `e9c0560287d58065a385be22ddf727f5bff5f99b`: DB suite 177 tests across 6 files, concurrency, build, and all 9 Playwright scenarios passed. The authenticated count flow ran at 360 × 800 CSS pixels and asserted no horizontal overflow/no uncaught page errors through posting. | Automated mobile-viewport smoke passed; not real-device acceptance. |
| Manual accessibility/device/recovery | No evidence that a human performed device installation, on-device offline navigation, screen-reader/contrast review, or manual recovery checks. | Deferred / unverified. |
| Full phase-wide gates and final owner review | Relevant implementation workflow runs above are green on their exact PR heads. PRs #58–#60 remain Draft/unmerged; other phase-wide exit scope and the full diff have not been owner-accepted in this review. | Pending owner review; do not infer Phase 3 completion. |

### Conditions before closure

1. Owner reviews the complete diffs and decides whether the documented automated-only evidence and deferred manual checks are acceptable for this milestone.
2. Confirm required checks and path-trigger coverage for the final heads before any later merge decision; do not treat docs-only PR #58 as implementation CI evidence.
3. If full Phase 3 exit requires broader reliability coverage, add only specifically justified missing cases for disposition/production/receipt uncertain acknowledgement and multi-line atomic failure; current evidence does not claim these are all newly fault-injected here.
4. Keep real-device/accessibility/manual recovery checks explicitly deferred until actually performed, or obtain owner acceptance of the deferral in the project’s acceptance record.
5. Keep all PRs Draft/unmerged until owner approval. No hosted provisioning, billing, secrets, or deployment is authorized.

**Scope conclusion:** WP3.6.1 is evidenced for the server-side DB composition; WP3.6.2 has count-command replay/payload mismatch and stale concurrency evidence but remains partial across command types; WP3.6.3 has authenticated 360px automated E2E evidence but manual checks remain deferred. Therefore WP3.6.4 remains **conditional**, not pass/closed.


### Authenticated purchase-store E2E evidence refresh — 2026-10-15

PR #59 head `1d5d3aeb288094eb6f89eec1460c643a0073254c` passed:
- [WP1.6 run 38697638766](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38697638766): local-Supabase database and concurrency tests, app build, and all 10 Playwright scenarios.
- [WP1.4 run 38697638744](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38697638744): database migration/RLS and two-session stock-count concurrency tests.
- [WP1.2 baseline run 38697638670](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38697638670): passed.

The newly passing authenticated purchase scenario exercised the actual purchase UI/store/RPC path for a 10 kg draft, a 4 kg partial receipt, and a 6 kg remainder. It verified confirmed/outstanding projections, server-authoritative stock snapshots of 4 kg and 10 kg, and an inventory version change. This resolves the previously documented purchase-store integration test gap.

**Exit review remains CONDITIONAL.** The database composition and purchase-store UI journey are separate scenarios; a single authenticated browser journey through purchase → production → finished-stock disposition → stock count is not yet evidenced. Manual real-device installation, on-device offline navigation, screen-reader/contrast and recovery checks remain deferred. PRs #58–#60 remain Draft/unmerged pending owner review; no hosted provisioning, billing, secrets, deployment, or Phase 3 completion claim is authorized.


## Current-state reconciliation — 2026-10-16

This document originated in the WP3.6 planning branch and its historical notes refer to an earlier main commit. For current status, use [`PHASE_3_CURRENT_STATUS.md`](./PHASE_3_CURRENT_STATUS.md) and the current implementation reconciliation in [`WP_REGISTRY.md`](./WP_REGISTRY.md). PR #59 and PR #63 are merged; PR #60 was closed as superseded by PR #63. Main commit `e515873c046ab03a56d92aa7eb935c79e8703d34` passed Baseline Checks, Application Shell, Local Supabase Authorization, and Local Supabase Vertical Slice. PR #63's exact-head Baseline and Local Supabase Vertical Slice checks also passed. The automated local/emulated gates do not replace deferred physical-device installation/offline checks, screen-reader/contrast review, or manual recovery acceptance. Phase 3 is not declared complete, and no hosted provisioning, billing, secrets, or production deployment is authorized.
