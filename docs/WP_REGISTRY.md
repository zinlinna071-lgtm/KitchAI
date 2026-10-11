# Work Package Registry

**Status:** Phase 1 planning baseline; WP1.1 is in progress. WP ordering may be refined after WP1.1, with changes recorded.  
**Parent plan:** [PHASE_1_PLAN.md](./PHASE_1_PLAN.md)

A work package (WP) is a bounded implementation unit with dependencies and evidence of completion. The workflow maintains this registry so the owner does not need to manually split tasks.

## Phase 1 WPs

### WP1.1 — Requirements, Architecture Comparison & Decisions
- **Priority:** Blocking
- **Status:** In progress
- **Dependencies:** None
- **Scope:** inspect repository and product constraints; compare local storage and cloud/auth/sync architecture options; identify data ownership, threat boundaries, expected cost, offline behavior, migrations, testability, and operational burden; document recommendations and unresolved owner decisions; run an isolated local-sync spike.
- **Current evidence:** Official provider docs/pricing checked 2026-10-11; consistent comparison, advisory Supabase/PostgreSQL lead, proposed Business Profile schema, conflict-review workflow, threat assumptions, and open owner gates are recorded in [ARCHITECTURE_OPTIONS.md](./ARCHITECTURE_OPTIONS.md) and [DECISIONS.md](./DECISIONS.md). The proposed provider-neutral write/retry/idempotency/conflict contract and acceptance matrix are in [LOCAL_SYNC_CONTRACT.md](./LOCAL_SYNC_CONTRACT.md). The isolated spike report records 6 passing Chromium tests in [REPORT.md](../.spikes/wp1-1-local-sync/REPORT.md). Fake-owner rejection is simulation only.
- **Not allowed:** silently committing to a paid service or material vendor decision without owner approval; treating a fake remote as proof of real cloud authorization.
- **Done when:** options and trade-offs are recorded; the owner accepts the initial data model and conflict/offline expectations; isolated spike results are recorded; provider, hosting, cost, and data-protection decisions are recorded; provider-specific authorization/security behavior is validated after explicit provider and non-production test-environment approval. Current recommendation and schema are proposals, not decisions. WP1.1 remains in progress.

### WP1.2 — Application Shell & PWA Baseline
- **Priority:** High
- **Status:** Not started
- **Dependencies:** WP1.1
- **Scope:** minimal application scaffold, typed build setup, basic responsive shell, PWA/offline app-shell behavior, error/loading states, and baseline automated checks.
- **Done when:** the app runs through documented commands, produces a successful production build, and baseline checks pass.

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
- **Done when:** authorized operations work and negative authorization tests demonstrate isolation. Full account-management UI is not required.

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

Planning documents do not count as implementation completion.
