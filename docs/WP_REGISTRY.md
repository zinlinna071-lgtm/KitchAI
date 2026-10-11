# Work Package Registry

**Status:** Phase 1 planning baseline; WP1.1 local requirements/architecture spike is complete. Provider authorization remains a gated follow-up for WP1.4 after explicit environment/cost approval.  
**Parent plan:** [PHASE_1_PLAN.md](./PHASE_1_PLAN.md)

A work package (WP) is a bounded implementation unit with dependencies and evidence of completion. The workflow maintains this registry so the owner does not need to manually split tasks.

**Coding-agent handoff:** [CODING_AI_PHASE1_EXECUTION_PROMPT.md](./CODING_AI_PHASE1_EXECUTION_PROMPT.md) contains the repository-first execution prompt and mandatory decision/security gates. Owner-approved planning defaults are recorded in [DECISIONS.md](./DECISIONS.md); approval does not authorize provisioning or billing.

## Phase 1 WPs

### WP1.1 — Requirements, Architecture Comparison & Decisions
- **Priority:** Blocking
- **Status:** Complete (local requirements/architecture spike gate met)
- **Dependencies:** None
- **Scope:** inspect repository and product constraints; compare local storage and cloud/auth/sync architecture options; document data ownership, threat boundaries, expected cost, offline behavior, migrations, testability, and operational burden; run an isolated local-sync spike; reconcile owner-approved defaults into the contract and acceptance checks.
- **Current evidence:** Supabase/PostgreSQL is the owner-selected target architecture, with a KitchAI-owned explicit local-first sync layer. The approved minimal Business Profile schema, explicit conflict choices, owner-partitioned local data, safe sign-out/account switching, and local/emulator-first guardrails are recorded in [DECISIONS.md](./DECISIONS.md). The owner-aligned write/retry/idempotency/conflict contract and acceptance matrix are in [LOCAL_SYNC_CONTRACT.md](./LOCAL_SYNC_CONTRACT.md). GitHub Actions run [38175356346](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38175356346) passed 14 Chromium tests, `npm audit --audit-level=low` (0 vulnerabilities), and `npm ls --depth=0`. Evidence includes local owner partitioning, sign-out lock/preserved queue, simulated storage failure, export/restore, lost-acknowledgement recovery, conflict preservation, and remote same-ID owner isolation. See [REPORT.md](../.spikes/wp1-1-local-sync/REPORT.md). Fake session/remote tests are not production authentication or provider authorization; provider-side tests are deferred until the environment and cost boundary are explicitly approved.
- **Not allowed:** cloud project provisioning, paid plan/billing activation, domain purchase, secret addition, or production deployment without separate explicit authorization; treating a fake remote as proof of real cloud authorization.
- **Done when:** approved decisions are reflected consistently in the contract and acceptance checks; isolated spike results are reproducibly verified; local/emulator sync, retry/idempotency, conflict preservation, and the tested reload recovery behavior have reviewable evidence; remaining account isolation, sign-out, storage-failure, export/restore, and lost-acknowledgement recovery gaps are explicitly tested or documented as blocked; provider authorization/security testing is performed only after an explicitly approved hosted test environment and cost boundary, or is clearly recorded as deferred with no false claim of provider validation. Update status with exact evidence before marking complete.

### WP1.2 — Application Shell & PWA Baseline
- **Priority:** High
- **Status:** In progress (baseline merged; final browser smoke review pending)
- **Dependencies:** WP1.1
- **Scope:** minimal application scaffold, typed build checks, basic responsive shell, PWA/offline app-shell behavior, connection/install states, and baseline automated checks.
- **Current implementation:** `index.html`, `src/app.js`, `src/styles.css`, `public/manifest.webmanifest`, `public/sw.js`, `scripts/build.mjs`, `tests/app.test.mjs`, `tsconfig.json`, and `.github/workflows/app-shell.yml` are merged to `main`. The app has no runtime npm dependencies; CI invokes a pinned TypeScript compiler over JSDoc-typed browser JavaScript.
- **Verification:** [GitHub Actions run 38176325304](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38176325304) passed the type-check, 6/6 Node tests, and production build. The app shell explicitly does not implement business-record persistence, authentication, or cloud sync.
- **Known remaining checks:** manually verify offline navigation after the first successful load and install behavior where supported in a real browser on mobile and desktop widths. Browser automation is not included in this baseline.
- **Done when:** documented commands work, production build emits a complete `dist/`, automated checks pass in CI, responsive/accessibility baseline and real-browser install/offline behavior are reviewed, and limitations are recorded. Do not mark complete based on source files alone.

### WP1.3 — Local Persistence & Data Integrity
- **Priority:** High
- **Status:** Not started
- **Dependencies:** WP1.1, WP1.2
- **Scope:** durable local storage for the selected record, validation, schema versioning/migration plan, and safe behavior when storage fails.
- **Done when:** create/read/update survives reload; invalid data is rejected safely; persistence tests pass.

### WP1.4 — Cloud Identity, Persistence & Authorization
- **Priority:** High
- **Status:** Not started
- **Dependencies:** WP1.1, WP1.2
- **Scope:** minimum authentication and cloud persistence required for sync; enforce ownership on trusted server/database boundaries; protect secrets; test unauthenticated and cross-owner access.
- **Done when:** authorized operations work and negative authorization tests demonstrate isolation. Full account-management UI is not required. Hosted tests require an explicitly approved non-production environment and cost boundary.

### WP1.5 — Sync State, Retry & Conflict Preservation
- **Priority:** High
- **Status:** Not started
- **Dependencies:** WP1.3, WP1.4
- **Scope:** local pending queue/state, retry/backoff, idempotency, recoverable failures, conflict detection, and preserving competing versions for review.
- **Done when:** offline-to-online sync works; retries do not duplicate logical changes; conflicts are surfaced and neither side is silently discarded.

### WP1.6 — Business Profile Vertical Slice
- **Priority:** High
- **Status:** Not started
- **Dependencies:** WP1.3, WP1.4, WP1.5
- **Scope:** connect the selected simple business record to UI, local storage, authorization, and sync end to end.
- **Done when:** the acceptance flow in the Phase 1 plan passes on the chosen implementation.

### WP1.7 — Integration, Recovery, Security & Acceptance
- **Priority:** Blocking for Phase exit
- **Status:** Not started
- **Dependencies:** WP1.2–WP1.6
- **Scope:** end-to-end tests, offline/reconnection checks, retry and conflict recovery, authorization review, build/lint/type checks, mobile/desktop smoke checks, and evidence/known-limitations documentation.
- **Done when:** Phase 1 exit gate is met and results are recorded.

## Workflow for each WP

1. Read the plan and current repository state.
2. State the intended change and acceptance checks in task notes.
3. Implement only the bounded WP scope.
4. Run relevant tests.
5. Inspect the final diff and fix failures before marking complete.
6. Commit a coherent change and update this registry/status.
7. Do not start dependent WPs until prerequisite evidence exists.

## Status legend

- Not started
- In progress
- Blocked
- Review required
- Complete

Planning documents do not count as implementation completion. WP1.1 completion means its requirements/architecture and isolated local-sync evidence gate is met; it does not mean production sync or server authorization is implemented.
