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
- **Status:** WP2.5a proof complete; WP2.5b, WP2.5c, WP2.5d1, and WP2.5d2 merged to main; WP2.6 integration/regression in progress
- **Dependencies:** WP2.2–WP2.4 and verified Phase 1 sync contracts
- **Sub-WP sequence:** WP2.5a sync/storage architecture spike → WP2.5b atomic entity outbox and migration → WP2.5c remote schema/RLS/idempotency (local Supabase only) → WP2.5d1 entity transport/retry/snapshot primitives → WP2.5d2 app lifecycle/conflict review and resolution → WP2.6 integration and phase exit.
- **WP2.5a evidence:** `.spikes/wp2-5-entity-sync/REPORT.md` compares per-entity outboxes, a shared Phase 2 entity database/outbox, and unsafe best-effort writes across independent databases. `.spikes/wp2-5-entity-sync/migration-prototype.js` and the browser regression test exercise disposable migration rollback, source preservation, and idempotent restart. Baseline [run 38238622571](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38238622571) and app-shell/browser [run 38238622636](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38238622636) passed.
- **WP2.5b implementation:** PR [#31](https://github.com/zinlinna071-lgtm/KitchAI/pull/31) merged to main as `4512d3bdeeae98c80f465f8be9f46f59142adcf1`; post-merge app-shell CI [run 38244077139](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38244077139) passed. Shared entity DB, safe legacy migration, stable local business partition, and atomic outbox are in place; legacy stores remain preserved.
- **WP2.5c implementation:** PR [#32](https://github.com/zinlinna071-lgtm/KitchAI/pull/32) merged to main as `fc11ff0edb36c879380eceefb897cb8a1ca5e958`. PR-head local Supabase authorization [run 38245719667](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38245719667) and vertical slice [run 38245719797](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38245719797) passed. Post-merge main authorization [run 38246225366](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38246225366) and vertical slice [run 38246225018](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38246225018) subsequently passed; earlier stack startup retry failed before tests executed.
- **WP2.5d split:** The plan now has WP2.5d1 transport/retry/snapshot primitives and WP2.5d2 app lifecycle/conflict UI integration.
- **WP2.5d1 implementation:** PR [#33](https://github.com/zinlinna071-lgtm/KitchAI/pull/33) merged to main at `06d7ca33c357d8d80269d5e6673907da754fb0b8`; PR-head baseline [run 38249444721](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249444721), app-shell [run 38249444526](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249444526), and static preview [run 38249444565](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249444565) passed. Post-merge main baseline [run 38249484043](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249484043), app-shell [run 38249484074](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249484074), and baseline [run 38249484176](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38249484176) passed. It adds `src/phase2-sync-engine.js` with owner/session-gated RPC transport, stable operation-ID retry, dependency-aware dispatch, durable acknowledgement metadata, auth pause, permanent-denial handling, interrupted `in_flight` recovery, and base/local/remote conflict snapshot persistence. `kitchai-business-data` receives an additive IndexedDB v1 → v2 upgrade with a scoped conflict store; existing entity data and legacy databases are preserved. `tests/phase2-sync-engine.test.mjs` covers dispatch, dependency ordering, retry timing, auth expiry, conflict preservation, normalization, and RPC error classification. WP2.5d2 merged to main via PR [#34](https://github.com/zinlinna071-lgtm/KitchAI/pull/34) at `595675b9855f1d53ba65e5126af9639cec7e598b`. PR-head app-shell [run 38250970569](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38250970569), static preview [run 38250970575](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38250970575), and local Supabase vertical slice [run 38250970553](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38250970553) passed. Post-merge main app-shell [run 38252484211](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38252484211), baseline [run 38252484194](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38252484194), and local Supabase vertical slice [run 38252484200](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38252484200) passed. WP2.6 is now in progress on `test/wp2-6-phase2-vertical-slice`; it adds a real local-Supabase browser scenario for creating and syncing ingredient, menu item, recipe, and recipe-line records, checking durable acknowledgements and reload persistence. Do not claim full Phase 2 cloud sync or Phase 2 exit until WP2.6 evidence and known-limitations review pass.
- **Migration/atomicity note:** WP2.2–WP2.4 originally introduced separate legacy IndexedDB databases. WP2.5b now routes current entity writes and the Phase 2 outbox through `kitchai-business-data` v2 so the entity record and operation can be committed in one IndexedDB transaction; legacy stores remain migration sources and are preserved. The migration prototype covers rollback, source preservation, and idempotent restart, but representative legacy-data migration through the current runtime still needs explicit acceptance coverage. No production data migration or hosted schema has been applied.
- **Guardrails:** No hosted provisioning, production secrets, billing, or deployment; never claim cloud sync until remote-path tests and evidence pass.

### WP2.6 — Integration, Regression & Phase Exit
- **Status:** Automated local integration, conflict-resolution, and migration/upgrade gates pass; Phase 2 exit remains blocked pending final known-limitations/acceptance review and required human review.
- **Dependencies:** WP2.1–WP2.4 and WP2.5a–WP2.5d
- **Current implementation:** PR [#35](https://github.com/zinlinna071-lgtm/KitchAI/pull/35) adds an authenticated local-Supabase Playwright vertical slice for offline creation and sync of ingredient, menu item, recipe, and recipe-line records, durable acknowledgements, unique operation IDs, positive remote revisions, and reload persistence. It also covers app-level conflict preservation with explicit Use-remote and Keep-local choices, correct entity-list sync-status copy, current-runtime legacy IndexedDB migration, and shared entity-store v1 → v2 upgrade behavior.
- **Current-head verification:** Application-code commit [809b5a6](https://github.com/zinlinna071-lgtm/KitchAI/commit/809b5a69c518b1a7423d0750602856e72e01a92d) passed Local Supabase [run 38280998836](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38280998836), including both database suites (77 pgTAP assertions) and all eight Playwright scenarios. The later documentation-only candidate commit [03b58b5](https://github.com/zinlinna071-lgtm/KitchAI/commit/03b58b513db218c0b1b09cca28165ecae5bad7e4) also passed all current-head workflows: Local Supabase [run 38309068365](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38309068365), baseline [run 38309068325](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38309068325), app-shell/build [run 38309068459](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38309068459), and static preview [run 38309068349](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38309068349). Scenarios cover profile sync/reload, explicit import of anonymous drafts, stale-revision conflict preservation, sign-out queue isolation, duplicate-create conflict, all four Phase 2 entity types syncing end to end, both Phase 2 conflict choices, and legacy entity migration.
- **Migration/upgrade acceptance:** The runtime test seeds a legacy ingredient store plus a pre-existing shared `kitchai-business-data` v1 schema and record before app startup. It verifies migration into the shared store, exactly one pending create operation, preserved legacy source data, `needsOutbox === false`, idempotence across reload, upgrade to DB version 2, preservation of the pre-existing shared record and scope index, and creation of the `conflicts` store.
- **Other current-head gates:** Baseline/browser/dependency checks [run 38280998663](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38280998663) passed 14/14 browser tests and dependency audit (0 vulnerabilities); app-shell/build [run 38280999005](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38280999005) passed 39/39 sync-engine unit tests, production build, and 16/16 app-shell browser tests; static preview [run 38280998867](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38280998867) passed. Database assertions cover RLS/owner isolation, server-derived ownership, cross-owner mutation rejection, revision conflicts, and idempotency.
- **Acceptance boundary:** Automated local-only WP2.6 gates pass, and the known-limitations/deferred-check/exit decision record is in [STATUS.md — WP2.6 Phase 2 exit review](./STATUS.md). PR #35 is unmerged and ready for owner review; Phase 2 must not be declared complete until the owner reviews the PR and accepts the exit record. Local/emulated Supabase does not prove hosted-provider authorization, real cross-device behavior, backup/recovery readiness, or production readiness.
- **Guardrails:** No hosted provider testing, provisioning, billing, production secrets, or production deployment.
Planning artifacts do not count as implementation completion. Implement one bounded WP at a time and retain Phase 1 regression gates.


## Phase 3 WPs

### WP3.1 — Inventory Domain Rules & Data Model
- **Status:** In progress — partial implementation; review and SQL execution gates remain open.
- **Dependencies:** Phase 2 local business store, recipe/catalog data, sync identity/scope foundation, owner-selected D3-01–D3-11 and T3-01–T3-08.
- **Implemented on feature branch:** exact six-decimal string/BigInt quantity primitives; stock movement validation; explicit lot allocation and carry-over confirmation; additive IndexedDB v2→v3 stores for stock movements, finished lots, inventory commands, and explicit stock-movement-to-lot allocations; sale is modeled as a finished-stock outflow, separate from sale pricing/revenue.
- **Migration test:** a populated-v2 Chromium test now covers the Phase 2 catalog, numeric recipe-line compatibility, outbox, sync metadata, migration ledger, conflicts, old indexes, additive stores, a deliberately failed legacy mapping followed by a safe retry, preserved source data, and reload idempotency. The first run caught a closed-test-connection defect; after the fix, [app-shell run 38419093724](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38419093724) passed. [Baseline run 38419093572](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38419093572) and [static preview run 38419093895](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38419093895) also passed.
- **SQL hardening added:** the migration reuses the Phase 2 composite owner/business key for scoped foreign keys, withholds direct client access to the idempotency command ledger, and rejects finished lots that do not exactly match their production-output event; finished lot identities are immutable. The database now persists explicit finished-lot allocation rows and defers exact-sum validation until transaction end.
- **Current code-head verification:** [app-shell run 38420258964](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420258964), [baseline run 38420259073](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259073), and [static preview run 38420259044](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259044) passed.
- **Blocking gates:** [authorization run 38420259349](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259349) and [vertical-slice run 38420259000](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38420259000) failed during isolated Supabase Docker startup, before SQL/pgTAP tests, due to Docker Hub image-pull limits. Obtain a successful SQL/pgTAP run and review the full diff plus Phase 2 recipe-line quantity compatibility.
- **Not allowed / not claimed:** no merge, hosted provisioning, billing, production deployment, inventory UI, production posting workflow, or inventory sync support. Do not mark WP3.1 complete until remaining evidence is reviewed.


- **WP3.1 verification refresh (2026-10-13):** The v1-seeded legacy migration integration test now expects current IndexedDB schema v3. On implementation commit `a868a04f452951d444bc403d8f3b561e6bfd2b0b`, app-shell, baseline, static preview, Supabase authorization, and vertical-slice workflows passed; the database suite passed 102 tests and all 8 local Supabase browser integration tests passed. Phase 2 recipe-line quantities remain JavaScript numbers locally and PostgreSQL `numeric` remotely, and are preserved without conversion. A future production-consumption workflow must introduce an explicit tested precision/range adapter. WP3.1 remains partial; PR #38 is Draft and unmerged.


- **WP3.1 current-head verification (2026-10-13):** Code commit `ae07e57827601e6929f1a28abdda9a40f1f79cf9` passed Baseline, Application Shell, Static Preview, Local Supabase Authorization, and Local Supabase Vertical Slice. pgTAP groups passed (40, 37, 26 tests); all 8 Playwright integration tests passed. Added explicit negative coverage for allocation sums that do not equal finished-stock reduction quantity. WP3.1 remains partial; PR #38 is Draft/unmerged.


- **WP3.1 follow-up — strict recipe quantity adapter:** Added `src/recipe-quantity-adapter.js` plus focused tests to reject unsupported precision, scientific notation, floating-point artifacts, invalid units, finished-`each` fractions, and numeric range overflow. Included the module in the explicit syntax-check command. This is not production posting and does not complete WP3.1; await CI on the follow-up branch before relying on the test results.
- **WP3.1 adapter CI refresh (2026-10-13):** After CI exposed a TypeScript/JSDoc error from an optional-looking `unit` parameter, the adapter now requires the options object and `unit`; it also rejects quantities above `Number.MAX_SAFE_INTEGER`, with a regression case for `9007199254740992`. On head `8f4db941e91115fe4ea20b10f4bad3fe6546ef6d`, [Application Shell run 38455305594](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455305594) passed its syntax/type/unit-test/build step and browser smoke tests. [Local Supabase Vertical Slice run 38455305557](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455305557) was still in progress at the time of this update. Do not mark WP3.1 complete until all current-head checks finish successfully and the full diff is reviewed.

- **WP3.1 final review refresh (2026-10-14):** Reviewed the complete PR #39 diff and Phase 2 recipe-line compatibility. On commit `4ebfca8a7d63955894b0e1f22c777ddfed7d0c87`, [Application Shell run 38455887104](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455887104) passed and [Local Supabase Vertical Slice run 38455887046](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38455887046) passed all 103 pgTAP tests plus all 8 browser integration tests. The strict recipe quantity adapter is a guarded boundary only, not production posting. WP3.1 remains partial; PRs #38 and #39 remain Draft/unmerged. Fresh CI is required after this documentation refresh.



## Phase 3 implementation reconciliation — 2026-10-14

This dated section supersedes the older WP3.1 status paragraphs above where they still describe PRs as draft/unmerged. Historical CI notes are retained as history, not current state.

| Work item | Current state on `main` | Evidence / boundary |
|---|---|---|
| WP3.1 — Inventory domain foundation and guarded recipe quantity adapter | Merged | PR [#38](https://github.com/zinlinna071-lgtm/KitchAI/pull/38), merge `2decd7b`; PR [#39](https://github.com/zinlinna071-lgtm/KitchAI/pull/39), merge `723f73f`. Latest recorded implementation verification passed 103 pgTAP tests and 8 local-Supabase browser integration tests. Exact quantity conversion is guarded; this does not imply every recipe line is precisely measurable. |
| WP3.2 — Atomic inventory commands and idempotent posting | Merged | PR [#41](https://github.com/zinlinna071-lgtm/KitchAI/pull/41), merge `81fafdd`. Server-side command ID/payload idempotency, owner/business scope, negative-stock rejection, atomic stock/lot/allocation writes, and append-only ledger are implemented. |
| WP3.2.1 — Purchasing and receiving | Merged | PR [#50](https://github.com/zinlinna071-lgtm/KitchAI/pull/50), merge `337a5d8`. Local purchase drafts, partial receiving, durable retry-safe receipt commands, and explicit rejected/uncertain receipt handling. Stock changes only after the server accepts the receipt command. Purchase price is not yet an official inventory valuation, COGS, or profit calculation. |
| WP3.3 — Production batch workflow | Merged implementation slices | Recipe snapshot: PR [#43](https://github.com/zinlinna071-lgtm/KitchAI/pull/43), merge `744f6db`; production lifecycle/actual usage: PR [#45](https://github.com/zinlinna071-lgtm/KitchAI/pull/45), merge `d3502e8`; atomic posting/retry: PR [#46](https://github.com/zinlinna071-lgtm/KitchAI/pull/46), merge `bf6b0a0`; operator UI: PR [#49](https://github.com/zinlinna071-lgtm/KitchAI/pull/49), merge `500591d`. |
| Finished stock and disposition | Merged | PR [#47](https://github.com/zinlinna071-lgtm/KitchAI/pull/47), merge `94eadc7`; UI/offline disposition: PR [#48](https://github.com/zinlinna071-lgtm/KitchAI/pull/48), merge `5100e5e`. Carry-forward is an explicit safe/suitable decision; sale/discounted sale/owner consumption/giveaway/waste are separate stock dispositions. Sales/revenue accounting is not included. |

### Work-package numbering rule

Implementation history uses WP3.2 for the atomic inventory command foundation and WP3.2.1 for the purchasing/receiving UI workflow, while earlier planning material may use WP3.2 more broadly for purchasing/inventory. Preserve the existing IDs in history; new work must use the implementation registry IDs and avoid reusing an identifier.

### WP3.5 Physical Stock Counts and Adjustments
- **WP3.5d — Atomic count posting:** merged via [PR #55](https://github.com/zinlinna071-lgtm/KitchAI/pull/55), merge commit `8cae7f31a828fe03f2819e8c159d1d4190b06f95`. Five PR-triggered workflows passed on head `1938cdad903aa707d166cc09ab4c3f374b77ffd8`.
- **WP3.5e — Accessible stock-count review UI:** merged via [PR #56](https://github.com/zinlinna071-lgtm/KitchAI/pull/56), squash commit `e49757f7e302f5aa02999c11ec09d18ef4816120`. The UI supports creating a count session for a synced business, choosing ingredient/finished-product items and capturing trusted server snapshots, recording/reviewing counts, variance reasons, stale-line refresh, explicit selected-line posting, cancellation, pending-post lockout, and a retry path for saved posting commands. If the server has no unit recorded, the user must supply the actual unit; no conversion is assumed. All four PR-triggered CI workflows passed on final PR head `948a9bc5c3f4485d37c325c871e45bad3312c957`: [WP3.5e Stock Count Browser Tests](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38647883772), [Static test preview](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38647883835), [WP1.2 Application Shell](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38647883808), and [WP1.6 Local Supabase Vertical Slice](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38647883622). The browser smoke test covers the unauthenticated/no-workspace state and narrow viewport; it is not a full authenticated count-session/count/post end-to-end test. Hosted-provider behavior is not claimed as tested.
- **Safety boundary:** count drafts do not change stock. Only a server-accepted atomic post changes inventory. Merge does not authorize hosted provisioning, billing, secrets, or deployment.

### WP3.5a — Physical count consistency and test contract

**State:** Documentation-only design contract prepared on branch `docs/wp3-5a-stock-count-contract`; awaiting review/CI and merge. Owner decisions D3.5-01 through D3.5-04 are accepted and recorded in `docs/DECISIONS.md`.

**Key implementation finding:** the existing atomic inventory RPC derives balances from append-only movements but does not yet establish a shared per-item lock/version protocol for all concurrent writers. Timestamps alone are not safe stale-count tokens. Before count posting can be enabled, WP3.5b must introduce a server-authoritative monotonically advancing per-item version and ensure every stock-changing RPC participates in deterministic item-lock acquisition/version advancement. Count posting must compare the captured version and append its adjustment in the same transaction.

See [WP3.5 plan](./PHASE_3_WP3_5_STOCK_COUNTS_PLAN.md) and [WP3.5a test contract](./PHASE_3_WP3_5A_COUNT_CONSISTENCY_TEST_CONTRACT.md). No application code or database migration was added in WP3.5a.


## Phase 3 stock-count implementation reconciliation — 2026-10-14

This section is authoritative for WP3.5 status and supersedes older WP3.5 paragraphs above where they say the design is awaiting review or that WP3.5b remains future work.

- **WP3.5a — Count consistency/test contract:** merged via [PR #52](https://github.com/zinlinna071-lgtm/KitchAI/pull/52). Owner decisions D3.5-01 through D3.5-04 are accepted and documented.
- **WP3.5b — Server-authoritative stock-item versions:** merged via [PR #53](https://github.com/zinlinna071-lgtm/KitchAI/pull/53), squash commit `105ade9062125dd1bb18522c3a72bd7b36c830e3`. WP1.4 Local Supabase Authorization and WP1.6 Local Supabase Vertical Slice both passed on PR head `b783f274d7ff9b5ce8e4468fe0b903c6327df72a`.
- **WP3.5c — Offline count drafts and review:** merged via [PR #54](https://github.com/zinlinna071-lgtm/KitchAI/pull/54), squash commit `4788cde4bedd3012f4e16d909041cfbc67b80fdb`. Baseline, app-shell, static preview, and Local Supabase Vertical Slice workflows all passed on PR head `5a870402f091bc0588b2a3102feb9716698260e9`.
- **WP3.5d — Atomic count posting:** implemented on [Draft PR #55](https://github.com/zinlinna071-lgtm/KitchAI/pull/55), head `e383a71b49c8fb72ad973c4bc8885f7ae03e6fd5`. All five PR-triggered workflows passed: Baseline, Static Preview, WP1.2 Application Shell, WP1.4 Local Supabase Authorization, and WP1.6 Local Supabase Vertical Slice. Evidence includes database authorization/idempotency and 175 pgTAP assertions, build/browser checks, 8 local-Supabase Playwright scenarios, a two-session concurrency regression (stale count rejected with SQLSTATE `40001`, no accepted audit), and a browser regression that freezes local count mutations while a post result is uncertain. PR remains Draft pending owner review.
- **Hard gate:** do not mark WP3.5d complete or merge until the owner reviews the current PR and accepts the remaining scope/limitations. The automated database, adapter, offline retry, stale-recount, and concurrency gates passed on the cited head. Every count adjustment must compare the server version and append the movement in the same transaction under the lock shared with `apply_inventory_command`.


## Phase 3 WP3.6 integration and exit review — 2026-10-15

**Current state:** Planning and static test-gap reconnaissance are in Draft PR [#58](https://github.com/zinlinna071-lgtm/KitchAI/pull/58). This is not implementation evidence and does not declare Phase 3 complete.

- Plan: [PHASE_3_WP3_6_PLAN.md](./PHASE_3_WP3_6_PLAN.md)
- Coding AI handoff: [CODING_AI_PHASE3_WP3_6_EXECUTION_PROMPT.md](./CODING_AI_PHASE3_WP3_6_EXECUTION_PROMPT.md)
- Initial static test-gap matrix: [PHASE_3_WP3_6_TEST_GAP_MATRIX.md](./PHASE_3_WP3_6_TEST_GAP_MATRIX.md)

### Proposed work packages (not yet implemented)

- **WP3.6.1 — Cross-workflow integration contract:** compose purchase receipt → production → finished-stock disposition → stock count and assert authoritative end state.
- **WP3.6.2 — Reliability regression:** verify retry/idempotency, uncertain acknowledgement recovery, stale-count/concurrent-write rejection, atomic rollback, and authorization where actual coverage gaps remain.
- **WP3.6.3 — UI/mobile smoke review:** verify key accessible interactions and narrow viewport behavior; distinguish automated checks from manual device/accessibility acceptance.
- **WP3.6.4 — Phase 3 exit review:** summarize exact test/CI evidence, unresolved limitations, and owner decisions before considering the phase exit gate.

The Coding AI must check out the latest repository, reconcile the initial matrix against actual source and tests, and complete the gap matrix before editing application code. Add only tests for demonstrated gaps and the smallest fixes justified by failing tests. Use synthetic data and local Supabase/emulators only.

**Verification state:** the matrix is static inspection only. No tests were run during its preparation. PR #58's latest documentation-only head has no workflow runs or combined status visible; the current workflows use path filters, so documentation-only changes are not evidence of implementation CI. For any implementation PR, verify that changed paths trigger the required workflows and report the exact final head SHA and run links.

**Hard gates:** keep PR #58 in Draft pending review. Do not merge until owner review and required CI on the final implementation head pass. No hosted provisioning, billing, production secrets, or deployment is authorized.

## WP3.6 owner direction and source-inspection refresh — 2026-10-15

The owner accepted the proposed WP3.6 plan in conversation and directed work to continue. Treat this as approval to proceed with bounded test-first implementation, **not** as approval to merge PR #58, waive CI, declare Phase 3 complete, or provision hosted resources. The test-gap matrix has been refreshed with source/workflow paths inspected against the current main baseline. The remaining candidate is the composed purchase receipt → production posting → finished-stock disposition → physical stock-count path, pending verification that no equivalent test already exists. Local tests were not executed in this inspection environment; no pass is claimed. Keep PR #58 Draft/unmerged until implementation evidence and required CI are available.



### WP3.6 implementation and verification update — 2026-10-15

This addendum supersedes the earlier WP3.6 paragraph that described all work as static reconnaissance only; retain its planning/authorization boundaries.

- **WP3.6.1 — Cross-workflow DB integration:** test added in [PR #59](https://github.com/zinlinna071-lgtm/KitchAI/pull/59), combining accepted receipt → production usage/output and finished lot → giveaway allocation → reviewed physical count adjustment with authoritative balance/ledger/audit assertions.
- **WP3.6.2 — Reliability regression:** PR #59 head `031bf2798c29c55315898c2b3760959816d0a0aa` adds same-command retry after uncertain acknowledgement and rejects reuse of the command ID with a changed payload. [WP1.6 run 38659411117](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411117) passed on this exact head. This does not claim fault injection for every command type.
- **CI qualification:** [WP1.4 run 38659411120](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411120) failed while pulling the Supabase Postgres image due to `toomanyrequests: Data limit exceeded`; database/concurrency tests were skipped. Rerun is still required for that workflow gate.
- **WP3.6.3 — UI/mobile:** partial only. The authenticated stock-count E2E passed on PR #57 head `cd5e60a2ba50b0786500b58f1eab50f90f8b5cfe`; the narrow 360px browser smoke currently exercises the empty state. Manual device, screen-reader, contrast and recovery acceptance remain deferred.
- **WP3.6.4 — Exit review:** conditional / not ready to close. PR #58 and PR #59 remain Draft/unmerged pending owner review, rerun of the blocked gate, and remaining evidence. Phase 3 is not declared complete. Hosted provisioning, billing, production secrets and deployment remain unauthorized.


### WP3.6.3 focused mobile E2E follow-up — 2026-10-15

Draft [PR #60](https://github.com/zinlinna071-lgtm/KitchAI/pull/60), head `e9c0560287d58065a385be22ddf727f5bff5f99b`, changes the authenticated stock-count local-Supabase E2E to a 360 × 800 CSS-pixel viewport and asserts no horizontal overflow after server-confirmed posting. This is test-only. CI is pending on the exact PR head; do not treat WP3.6.3 as passed until the workflow completes. Real-device, screen-reader, contrast and manual recovery checks remain deferred.


### WP3.6 CI result refresh — 2026-10-15

This update supersedes the preceding pending/rate-limited CI notes where they describe current state.

- **WP3.6.1 — Cross-workflow DB integration:** [PR #59 WP1.4 run 38659411120](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411120) passed on head `031bf2798c29c55315898c2b3760959816d0a0aa`; 196 pgTAP tests across 7 files passed, as did the two-session stale-count concurrency regression. WP1.6 on the same head also passed: [run 38659411117](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38659411117).
- **WP3.6.2 — Count retry/idempotency and concurrency:** same-command count replay and changed-payload rejection are in PR #59; the exact-head WP1.6 and WP1.4 runs passed. This does not establish fault-injection coverage for every command type.
- **WP3.6.3 — Authenticated mobile E2E:** [PR #60 WP1.6 run 38660630936](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38660630936) passed on exact head `e9c0560287d58065a385be22ddf727f5bff5f99b`: 177 DB tests across 6 files, concurrency regression, build, and all 9 Playwright scenarios. The authenticated stock-count scenario ran at 360 × 800 CSS pixels and passed its no-horizontal-overflow and no-uncaught-page-error assertions through posting.
- **WP3.6.4 — Phase 3 exit review:** still **conditional / not ready to close**. Automated evidence is stronger, but real-device install, offline navigation on device, screen-reader/contrast checks, and manual recovery acceptance remain deferred. The composed cross-workflow path is DB-level, not one authenticated browser journey across all workflows. PRs #58–#60 remain Draft/unmerged; Phase 3 is not declared complete. No hosted resources, billing, secrets, or deployment are authorized.


### PR #59 latest-head CI — 2026-10-15

- Current head `26ed3e336bf5bb322a32f343875a4a4b5bffa423` extends the server-side composition with safe carry-forward handling. [WP1.4 run 38661235589](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38661235589) passed 200 pgTAP tests across 7 files and the two-session concurrency regression.
- [WP1.6 run 38661235561](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38661235561) failed at Supabase Postgres image pull due to Docker `toomanyrequests: Data limit exceeded`; its database/concurrency/build/browser steps did not execute. Failed job rerun was requested; pending outcome.
- Keep WP3.6.1 database composition evidence separate from full WP1.6 vertical-slice evidence. PR #59 remains Draft/unmerged; WP3.6.4 remains conditional.


## Current test-head note — 2026-10-15

PR #59 now points to `3aed4c9edf0f3250d9d9c5a61799d24669d72464`, a small test-fidelity correction aligning the synthetic receipt movement metadata with the purchase domain contract (`sourceType: purchase`, source ID representing the purchase draft). The prior head's WP1.4 pass (200 tests + concurrency) remains useful historical evidence, but it is **not** a green check on this newest head. The WP1.6 retry for the prior head was still running at last poll and had not completed; the newest head's required CI is pending. Do not close WP3.6.4 or treat PR #59 as ready until exact-head required checks are green.
