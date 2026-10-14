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
