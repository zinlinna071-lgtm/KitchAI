# Coding AI Execution Prompt — Phase 3 WP3.6 Integration & Exit Review

Repository: `zinlinna071-lgtm/KitchAI`. Read this prompt and `docs/PHASE_3_WP3_6_PLAN.md` before changing anything.

## Owner and safety constraints

- Read `docs/WP_REGISTRY.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, the WP3.5 stock-count plan, and current source/tests. If sources conflict, inspect the newest authoritative reconciliation and report the discrepancy.
- Use a dedicated feature branch from latest `main`; never commit directly to `main`.
- This is test-first integration/acceptance, not feature expansion. Change product behavior only when a test demonstrates a defect and a minimal safe fix is clear.
- Use local Supabase/emulators and synthetic disposable data only.
- No hosted provisioning, billing, secrets, domain purchase, paid services, or production deployment.
- Never expose credentials, tokens, personal/business data, or secret environment values in code, logs, traces, screenshots, or PR descriptions.
- Do not claim a workflow passed unless the exact run on the exact commit is green.
- Do not merge. Open a draft PR and wait for owner review. Required CI must pass before any later merge decision.

## Phase A — Reconnaissance (no code edits yet)

1. Inspect git status, branch and HEAD; create a clean feature branch from latest main without overwriting unrelated work.
2. Read the Phase 3 sections of the registry/status, `docs/PHASE_3_WP3_5_STOCK_COUNTS_PLAN.md`, and decision log.
3. Inspect inventory domain/store/UI modules, Supabase migrations/RPCs, pgTAP tests, unit tests, Playwright specs, and workflow YAML.
4. Inspect PR #57 authenticated stock-count E2E, test fixtures and failure-artifact configuration.
5. Build a test-gap matrix: invariant → existing test/file → missing scenario → minimal proposed test. Do not implement before this matrix is grounded in current code.

## Phase B — Test contract

Map and verify these transitions where supported:
1. Synthetic authenticated business and ingredient.
2. Purchase draft → partial/full receipt → server-confirmed ingredient stock change.
3. Recipe/production snapshot → actual ingredient usage/output → server-confirmed posting.
4. Finished-lot traceability and a supported finished-stock disposition.
5. Physical stock-count server snapshot → counted quantity/reason/review → explicitly selected line post.
6. Authoritative final stock quantities and append-only movement/lot/count audit records.

Cover reliability/negative cases:
- Duplicate command delivery and same-ID/same-payload retry do not duplicate stock effect.
- Reuse of a command ID with a different payload is rejected.
- Uncertain acknowledgement is not mislabeled success; retry is recoverable.
- Concurrent stock movement makes an older count stale and stale posting is rejected atomically.
- Invalid/stale multi-line count causes no partial accepted adjustments.
- Anonymous and cross-owner/business access are rejected server-side.
- Offline drafts survive reload/reconnect only where the current workflow supports it; do not imply server-posted commands can finish offline.
- Unsupported quantity precision/unit conversion fails closed without silent rounding.
- Mobile layout/accessibility checks and no uncaught page errors.

Prefer server/database assertions for balances and ledger effects. UI text is supplemental, not the sole proof.

## Phase C — Minimal implementation

- Add only missing tests and smallest fixes needed for demonstrated failures.
- Reuse existing test helpers and local-Supabase/Playwright conventions.
- Avoid new runtime dependencies; justify any unavoidable dependency.
- Do not invent APIs, statuses, conversions, or unsupported workflows.
- Preserve append-only stock movements and atomic server posting.
- Keep finished-stock dispositions separate from sales revenue/accounting.
- Do not edit posted history; use correction/reversal only if already supported.
- Isolate synthetic fixtures and owner/session/database state between tests.
- Retain browser traces/screenshots on failure with bounded artifact retention; ensure artifacts contain no secrets.

## Phase D — Verification

Inspect workflow YAML to identify required gates. At minimum, evaluate:
- Baseline unit/type/build/dependency gates.
- Application-shell and browser smoke checks.
- Static preview build/check.
- Local Supabase authorization/pgTAP.
- Local Supabase vertical-slice browser suite.
- Stock-count browser suite and authenticated stock-count E2E.

Run on the newest PR head. For failures, read actual logs, distinguish product defects from environment failures, fix safe defects, and record any test that never executed due to an external blocker. Do not waive required gates or merge.

## Phase E — Review and handoff

- Review the complete diff for scope, authorization, idempotency, quantity semantics, migrations, and regressions.
- Update `docs/STATUS.md` and `docs/WP_REGISTRY.md` with exact commit SHA, workflow URLs/results, test counts, limitations and deferred manual checks.
- State whether integrated workflow is passed, conditional, or blocked. Do not declare Phase 3 complete unless the plan's definition of done is met.
- Open a **draft PR** with summary, evidence, known limitations, and explicit no-hosted-resource boundary.
- Stop before merge. Report PR URL, head SHA, passed/pending/failed gates and any owner decisions needed.

## Hard stop conditions

Stop and report instead of guessing if an operation is not implemented, unit/conversion semantics are ambiguous, migrations/tests contradict the plan, a required gate cannot run, or work requires hosted provisioning, billing, production secrets, paid services, real business data, or deployment.
