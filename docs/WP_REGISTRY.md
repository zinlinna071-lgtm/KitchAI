# Work Package Registry

**Status:** WP1.1–WP1.6 implementation gates passed on main. PR #21 merged as docs-only commit `d1341bd9586e5b77ebcaf992d1437e80771fd954`; PR #22 merged as docs-only commit `c16a8b83b5c5ee8a6d87442b6a6265683d249167`, with baseline CI passing on that merge commit [run 38230100063](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38230100063). Earlier baseline, app-shell, and local Supabase workflows passed on unchanged application-code commit `1b7169f7569fe012ffacfca44356bb144d86f86d`; the static preview workflow passed on PR #21's merge commit. Owner explicitly accepts deferring named non-critical manual-only checks until the app is more complete. Those checks are recorded as deferred, not passed. WP1.7 is closed for the local-only Phase 1 milestone with the owner's manual-only deferrals documented; hosted provider authorization remains separately gated on explicit environment/cost approval.  
**Parent plans:** [PHASE_1_PLAN.md](./PHASE_1_PLAN.md); [PHASE_2_PLAN.md](./PHASE_2_PLAN.md); [PHASE_2_DOMAIN_CONTRACT.md](./PHASE_2_DOMAIN_CONTRACT.md)

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
- **Status:** Complete (local queue/retry/conflict mechanics gate; transport integration reserved for WP1.6)
- **Dependencies:** WP1.3, WP1.4
- **Scope:** persist owner-partitioned profile drafts and outbox operations atomically; retain stable operation IDs; coalesce edits into an unsent create; model in-flight, retryable, authentication-paused, permanent-failure, and conflict states; schedule bounded exponential backoff with jitter; preserve base/local/remote snapshots; require explicit Keep local or Use remote resolution against the current remote revision.
- **Current implementation:** `src/sync-store.js` implements IndexedDB profile/outbox/conflict stores with owner-scoped reads and atomic local profile + operation writes, plus visible persisted profile sync states. `src/sync-engine.js` implements transport-injected orchestration, retry timing, owner-partition checks, and conflict-resolution flow. It does not configure a remote transport or contact hosted services; WP1.6 integrates the end-to-end Business Profile vertical slice.
- **Verification:** [CI run 38178596957](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38178596957) passed 15/15 Node tests, 14/14 WP1.1 Chromium tests, dependency audit (0 vulnerabilities), and dependency tree; [CI run 38178596967](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38178596967) passed 6/6 Chromium app-shell tests, including owner partitioning, durable outbox, unsent-create coalescing, persisted sync states, and conflict snapshots/resolution across reload. PR [#10](https://github.com/zinlinna071-lgtm/KitchAI/pull/10) and sync-state follow-up [#11](https://github.com/zinlinna071-lgtm/KitchAI/pull/11) merged to `main`.
- **Done when:** pending operations survive reload; retries reuse operation IDs and do not duplicate logical writes; only the active owner's queue is eligible for processing; transient/permanent/auth failures have distinct durable states; stale revisions preserve base/local/remote snapshots; explicit resolution is recoverable and tests/build pass. **Local mechanics gate met.** End-to-end transport/UI behavior remains part of WP1.6. No hosted provisioning is part of this WP.

### WP1.6 — Business Profile Vertical Slice
- **Priority:** High
- **Status:** Complete (local-only integration gate passed; merged to main)
- **Dependencies:** WP1.3, WP1.4, WP1.5
- **Plan:** [WP1_6_PLAN.md](./WP1_6_PLAN.md)
- **Scope:** connect the selected simple business record to UI, owner-scoped local storage, Supabase Auth, server-side ownership/revision checks, and WP1.5 sync end to end. Preserve the anonymous local draft unless the owner explicitly adopts it. Add server-side idempotency so a lost acknowledgement cannot apply one logical write twice.
- **Verification:** PR [#12](https://github.com/zinlinna071-lgtm/KitchAI/pull/12) merged to main as `89838aa517999e98fd3c80cf830e10f25ba07d59`. Post-merge [WP1.4 CI run 38181264500](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38181264500) passed all 40 pgTAP assertions; [WP1.6 CI run 38181264533](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38181264533) passed build, all 40 pgTAP assertions, and 5 Playwright tests for offline queue/reconnect/reload, explicit import of anonymous draft, two-session stale-revision conflict, sign-out queue isolation, and duplicate-create conflict. App shell [run 38181264524](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38181264524) and baseline [run 38181264526](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38181264526) passed on the merge SHA.
- **Done when:** local Supabase Auth/Postgres/RLS integration passes create/update, owner isolation, offline queue/reconnect, retry/lost-ack recovery, conflict preservation/resolution, sign-out locking, and reload durability checks; CI remains green; limitations are documented. **Local gate met.** No hosted provisioning.

### WP1.7 — Integration, Recovery, Security & Acceptance
- **Priority:** Blocking for Phase exit
- **Status:** Complete (local-only Phase 1 gate; non-critical manual-only checks explicitly deferred by owner)
- **Dependencies:** WP1.2–WP1.6
- **Scope:** consolidate end-to-end tests, offline/reconnection and conflict recovery evidence, authorization review, build/type checks, manual PWA/accessibility checks, and known-limitations/Phase exit documentation.
- **Evidence:** WP1.6 main-branch integration suite passed five browser scenarios and 40 pgTAP assertions. PR [#18](https://github.com/zinlinna071-lgtm/KitchAI/pull/18) merged as [commit c67504b](https://github.com/zinlinna071-lgtm/KitchAI/commit/c67504b18245fe6e1100d8d3666a21ad37e467dd). PR-head local Supabase [run 38190575289](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38190575289), app-shell [run 38190575294](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38190575294), and baseline [run 38190575298](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38190575298) all passed. Added smoke tests verify keyboard skip-link focus, accessible names/status, and no horizontal overflow at 200% text and 320px viewport. These do not replace manual screen-reader, contrast, real-device install/offline, or safe recovery checks. PR [#14](https://github.com/zinlinna071-lgtm/KitchAI/pull/14) corrected outdated UI sync-status copy and added regression assertions. Its feature-branch local Supabase, app-shell, and baseline CI runs [38186745954](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38186745954), [38186745953](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38186745953), and [38186745952](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38186745952) passed. After PR #14 merged as `f5f05158337ce84d80ea698b070ed13ae7598de5`, main-branch baseline [38189391199](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38189391199), app-shell [38189391200](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38189391200), and local Supabase [38189391159](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38189391159) all passed. Baseline [run 38189491782](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38189491782) also passed on docs commit `6dbe587`. PR [#16](https://github.com/zinlinna071-lgtm/KitchAI/pull/16) recorded the verified results and merged as `ba75ccdfe608aa35daad107428b36130da5f14a0`; details are in [WP1_7_POST_MERGE_CI_VERIFICATION.md](./WP1_7_POST_MERGE_CI_VERIFICATION.md). Manual real-device install/offline/accessibility checks are not covered by CI and are explicitly deferred by the owner until the app is more complete; the checklist marks them DEFERRED, not passed. The owner previously reported the instructed preview steps completed successfully, without device/browser metadata or per-check details. Automated local authorization, conflict, retry/idempotency, offline/reconnection/reload, sign-out queue isolation, and data-preservation evidence remains required and is linked above. See [WP1_7_MANUAL_ACCEPTANCE_CHECKLIST.md](./WP1_7_MANUAL_ACCEPTANCE_CHECKLIST.md) and [post-merge CI verification](./WP1_7_POST_MERGE_CI_VERIFICATION.md).
- **Done when:** automated local integration/security/data-integrity evidence is green; manual-only checks are explicitly accepted as deferred with rationale; known limitations are documented; and no unresolved critical security/data-loss issue is known. This closes only the local-only Phase 1 gate. Deferred manual checks remain follow-up work for later app-completion/release-readiness, and this status does not imply hosted-provider validation or production readiness.

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


## Phase 2 WPs — Menu & Recipes

**Phase plan:** [PHASE_2_PLAN.md](./PHASE_2_PLAN.md)  
**Domain contract:** [PHASE_2_DOMAIN_CONTRACT.md](./PHASE_2_DOMAIN_CONTRACT.md)

### WP2.1 — Domain Rules & Data Contract
- **Priority:** Blocking
- **Status:** Complete (logical contract reconciled with current repository baseline; implementation remains unstarted)
- **Dependencies:** Phase 1 local-only foundation; Phase 2 plan
- **Scope:** define menu item, ingredient, recipe, and recipe-ingredient entities; ownership/business partitioning; lifecycle; validation; initial unit allowlist; migration compatibility; sync constraints; and unresolved decisions.
- **Current artifact:** [PHASE_2_DOMAIN_CONTRACT.md](./PHASE_2_DOMAIN_CONTRACT.md).
- **Reconciliation evidence:** reviewed `src/local-store.js` (kitchai-local v1), `src/sync-store.js` (kitchai-sync v2), `src/sync-engine.js`, `src/supabase-api.js`, both current Business Profile SQL migrations, and the current test/package baseline. Documented that Phase 2 entities do not yet exist, the two IndexedDB databases version independently, Phase 1 uses separate profile/outbox/conflict stores, and current remote SQL supports only Business Profile plus idempotency. Text length and migration compatibility notes now distinguish the existing Phase 1 behavior from the proposed Phase 2 contract.
- **Completion boundary:** the domain contract and repository reconciliation are complete; no Phase 2 runtime code or schema migration is included. WP2.2 may begin as a bounded local-first ingredient catalog implementation. Syncing new entities remains gated on WP2.5 and must not be implied by local persistence.
- **Not allowed:** silently choosing advanced conversions, permanent deletion/tombstones, costing/accounting, inventory deduction, hosted schema rollout, or production provisioning.

### WP2.2 — Ingredient Catalog & Validation
- **Status:** Complete (local-only workflow; automated regression gates passed)
- **Dependencies:** WP2.1 accepted
- **Implementation:** PR [#26](https://github.com/zinlinna071-lgtm/KitchAI/pull/26) merged to main as `4801066cb2e15f7f5f28d3615311ee45c34cc25c`. Separate `kitchai-ingredients` IndexedDB v1 store with compound owner/business/record key, scope index, Unicode-code-point text validation, create/edit/list/archive/reactivate, and a local-only accessible UI.
- **Verification:** Baseline [run 38233064585](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233064585), app-shell [run 38233064639](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233064639), static preview [run 38233064598](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233064598), and post-merge Phase 1 local Supabase regression [run 38233214370](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233214370) passed. Tests cover validation, create/edit/reload/archive/reactivate, owner/business partition isolation, and offline shell asset inclusion. The post-merge WP1.6 local Supabase regression passed; Phase 1 sync code and SQL were not changed.
- **Boundary:** Ingredient changes are local-only. No ingredient sync queue, remote table, or hosted schema was added; new-entity sync remains WP2.5.

### WP2.3 — Menu Item Workflow
- **Status:** Complete (local-only workflow; baseline, browser, and Local Supabase regression gates passed)
- **Dependencies:** WP2.1 and WP2.2
- **Implementation:** PR [#27](https://github.com/zinlinna071-lgtm/KitchAI/pull/27) merged to main as `19fe1a39dfb1b2c254aecd9faa69c041fa4c4760`. Separate `kitchai-menu` IndexedDB v1 store, owner/business partitioning, validation, create/list/edit/archive/reactivate, responsive UI, and offline precaching.
- **Verification:** Main-branch baseline [run 38233845463](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233845463) and application shell/browser [run 38233845452](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38233845452) passed. The later main-branch Phase 1 Local Supabase regression [run 38237714165](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38237714165) also passed with Phase 2 source present.
- **Boundary:** Menu items are local-only. Recipe association belongs to WP2.4; new-entity sync remains WP2.5. No pricing, taxes, modifiers, sales availability, inventory consumption, destructive deletion, or cloud-sync claims.

### WP2.4 — Recipe & Ingredient Lines
- **Status:** Complete for the local-only milestone; all required automated gates passed
- **Dependencies:** WP2.1, WP2.2, and WP2.3
- **Implementation:** PR [#28](https://github.com/zinlinna071-lgtm/KitchAI/pull/28) merged to main as `7ac52371fb3b603eac5035e8320fa5386a087fb5`. Separate `kitchai-recipes` IndexedDB v1 stores recipes and ingredient lines with owner/business compound keys, draft/active/archived lifecycle, relationship validation, exact unit allowlist, accessible UI, and offline precaching.
- **Verification:** Main-branch baseline [run 38237714151](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38237714151), app-shell/browser [run 38237714136](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38237714136), PR-head static preview [run 38237452881](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38237452881), and main-branch Local Supabase regression [run 38237714165](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38237714165) passed.
- **Boundary:** Recipes and ingredient lines are local-only. No remote schema, sync queue, unit conversion, line deletion, costing, inventory deduction, or cloud-sync claim; new-entity sync remains WP2.5.

### WP2.5 — Local-first Sync & Conflict Integration
- **Status:** Planning breakdown added in PR #29; WP2.5a is next after the plan merges
- **Dependencies:** WP2.2–WP2.4 and verified Phase 1 sync contracts
- **Sub-WP sequence:** WP2.5a sync/storage architecture spike → WP2.5b atomic entity outbox and migration → WP2.5c remote schema/RLS/idempotency (local Supabase only) → WP2.5d client transport/retry/conflict integration.
- **Design concern:** WP2.2, WP2.3, and WP2.4 currently use independent IndexedDB databases, while Phase 1's outbox is in `kitchai-sync`. A record and outbox operation cannot be committed atomically across those databases. WP2.5a must compare alternatives and test migration/recovery before any sync implementation.
- **Guardrails:** No hosted provisioning, production secrets, billing, or deployment; never claim cloud sync until remote-path tests and evidence pass.

### WP2.6 — Integration, Regression & Phase Exit
- **Status:** Not started; blocking for Phase 2 exit
- **Dependencies:** WP2.1–WP2.4 and WP2.5a–WP2.5d

Planning artifacts do not count as implementation completion. Implement one bounded WP at a time and retain Phase 1 regression gates.
