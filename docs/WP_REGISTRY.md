# Work Package Registry

**Status:** Phase 1 implementation baseline; WP1.1–WP1.4 local gates are complete. Hosted provider authorization remains separately gated on explicit environment/cost approval.  
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
- **Status:** Complete (app-shell baseline)
- **Dependencies:** WP1.1
- **Scope:** minimal application scaffold, typed build checks, basic responsive shell, PWA/offline app-shell behavior, connection/install states, and baseline automated checks.
- **Current implementation:** `index.html`, `src/app.js`, `src/styles.css`, `public/manifest.webmanifest`, `public/sw.js`, `scripts/build.mjs`, `tests/app.test.mjs`, `tsconfig.json`, and `.github/workflows/app-shell.yml` are merged to `main`. The app has no runtime npm dependencies; CI invokes a pinned TypeScript compiler over JSDoc-typed browser JavaScript.
- **Verification:** [GitHub Actions run 38176325304](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38176325304) passed the type-check, 6/6 Node tests, and production build. The app shell explicitly does not implement business-record persistence, authentication, or cloud sync.
- **Known remaining checks:** manually verify offline navigation after the first successful load and install behavior where supported in a real browser on mobile and desktop widths. Browser automation is not included in this baseline.
- **Done when:** documented commands work, production build emits a complete `dist/`, automated checks pass in CI, responsive/accessibility baseline and real-browser install/offline behavior are reviewed, and limitations are recorded. Do not mark complete based on source files alone.

### WP1.3 — Local Persistence & Data Integrity
- **Priority:** High
- **Status:** Complete
- **Dependencies:** WP1.1, WP1.2
- **Scope:** durable IndexedDB storage for the Business Profile local draft, validation, schema version metadata, reload durability, and safe behavior when storage fails.
- **Current implementation:** `src/local-store.js` adds a versioned `kitchai-local` IndexedDB database with separate profile and metadata stores. The UI allows creating/updating a local profile and explicitly says it is not synced. The local draft omits server-authoritative `ownerId` and server `revision`; see [LOCAL_SYNC_CONTRACT.md](./LOCAL_SYNC_CONTRACT.md).
- **Verification:** [WP1.3 app-shell CI run 38176993521](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38176993521) passed 5/5 Chromium smoke tests including profile create/update/reload, immutable `createdAt`/`businessId`, schema version and local revision metadata, invalid blank names, and unavailable IndexedDB. [Baseline CI run 38176993535](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38176993535) passed 8/8 Node tests, JSDoc TypeScript check, production build, WP1.1's 14 Chromium tests, dependency audit, and dependency tree.
- **Limitations:** local draft is not synced, does not assert an owner identity, and is not a backup. Real browser quota exhaustion is not simulated; unavailable IndexedDB is tested. WP1.4 must bind server-authoritative owner/revision fields after authentication.
- **Done when:** create/read/update survives reload; name validation and schema metadata are tested; storage failures do not claim success; tests/build pass; limitations and local-draft/server-authority boundary are documented. **Gate met.**

### WP1.4 — Cloud Identity, Persistence & Authorization
- **Priority:** High
- **Status:** Complete (local Supabase authorization gate; hosted path gated)
- **Dependencies:** WP1.1, WP1.2
- **Scope:** minimum authentication and cloud persistence required for sync; enforce ownership on trusted server/database boundaries; protect secrets; test unauthenticated and cross-owner access.
- **Current implementation:** `supabase/config.toml`, migration `supabase/migrations/20261012000000_create_business_profiles.sql`, pgTAP suite `supabase/tests/database/business_profiles.test.sql`, and `.github/workflows/supabase-local.yml`. The migration derives `owner_id` from `auth.uid()`, generates immutable `business_id`, controls timestamps/revision, enables RLS, and grants authenticated users only select/insert/update. Delete is not granted. No hosted project or credentials are used.
- **Verification:** [GitHub Actions run 38177790964](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38177790964) passed local Supabase CLI stack startup, migration application, and all 21 pgTAP assertions against actual local Supabase Auth/Postgres/RLS. Coverage includes anonymous access denial, no delete grant, server-owned field enforcement, name trimming, revision increments, and cross-owner read/update isolation. PR [#9](https://github.com/zinlinna071-lgtm/KitchAI/pull/9) merged to `main` as `b11041112de77524ac2c11515602bbf60c7547c3`.
- **Done when:** authorized operations work and negative authorization tests demonstrate isolation against the actual local Supabase Auth/Postgres/RLS boundary. Full account-management UI is not required. **Local gate met.** Hosted tests require an explicitly approved non-production environment and cost boundary.

### WP1.5 — Sync State, Retry & Conflict Preservation
- **Priority:** High
- **Status:** In progress (local-only engine and durable queue)
- **Dependencies:** WP1.3, WP1.4
- **Scope:** persist owner-partitioned profile drafts and outbox operations atomically; retain stable operation IDs; coalesce edits into an unsent create; model in-flight, retryable, authentication-paused, permanent-failure, and conflict states; schedule bounded exponential backoff with jitter; preserve base/local/remote snapshots; require explicit Keep local or Use remote resolution against the current remote revision.
- **Current implementation:** `src/sync-store.js` implements IndexedDB profile/outbox/conflict stores with owner-scoped reads and atomic local profile + operation writes. `src/sync-engine.js` implements transport-injected orchestration, retry timing, owner-partition checks, and conflict-resolution flow. It does not configure a remote transport or contact hosted services; WP1.6 integrates the authorized Business Profile vertical slice.
- **Verification in progress:** Node tests cover retry bounds, owner isolation, success acknowledgement, transient failure, auth pause, permanent rejection, conflict preservation, and Keep local revision preconditions. Chromium tests exercise IndexedDB persistence, unsent-create coalescing, owner partitioning, and conflict snapshots/resolution across reload.
- **Done when:** pending operations survive reload; retries reuse operation IDs and do not duplicate logical writes; only the active owner's queue is eligible for processing; transient/permanent/auth failures have distinct durable states; stale revisions preserve base/local/remote snapshots; explicit resolution is recoverable and tests/build pass. No hosted provisioning is part of this WP.

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
