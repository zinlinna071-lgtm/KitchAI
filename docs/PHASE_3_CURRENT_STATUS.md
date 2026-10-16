# Current Project Status — 2026-10-16

**Authority:** This page is the current-state reconciliation for Phase 2/3 and the UI preview as of this date. Where older dated sections in `STATUS.md`, `WP_REGISTRY.md`, or draft planning PRs conflict with this page, treat the older statements as historical.

## Verified merged work

- Phase 2 entity sync vertical slice: PR #35 is merged. Older statements that PR #35 is unmerged or that Phase 2 is still blocked solely on that PR are stale. Manual/hosted checks remain separately deferred.
- Phase 3 inventory/production/finished-stock foundations: WP3.1, WP3.2, WP3.2.1 purchasing/receiving, WP3.3 production, finished-stock dispositions, and WP3.5 stock counts have merged implementation slices. See the existing implementation reconciliation tables in `WP_REGISTRY.md`.
- Cross-workflow stock integrity tests: PR #59 merged to main at `60d3b5351ed4aba3c8b6142882113124f811689d`.
- Authenticated stock-count mobile viewport test: PR #63 merged to main at `e515873c046ab03a56d92aa7eb935c79e8703d34`. It adds a 360×800 viewport assertion, no-horizontal-overflow check, and uncaught-browser-error assertion while preserving the current authenticated stock-count test.
- PR #63 exact-head Baseline Checks [run 38897212177](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38897212177) and Local Supabase Vertical Slice [run 38897212658](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38897212658) both passed. Main-head Baseline [run 38896833016](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38896833016), Application Shell [run 38896833339](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38896833339), Local Supabase Authorization [run 38896833126](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38896833126), and Local Supabase Vertical Slice [run 38896833071](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38896833071) all passed on main commit `60d3b535`.

## Current open work

- PR #62, `Add AI-first KitchAI UI preview with Manage Mode`, remains a **draft preview-only PR**. The approved UI is not merged into production; `index.html` and production business logic must remain untouched until a separately reviewed integration plan.
- PR #58 is a draft Phase 3 integration/exit-review planning PR. Its older notes about PR #59 and PR #60 being unmerged are historical; PR #59 merged and PR #60 was closed as superseded by PR #63.
- PRs #36, #40, and #42 are older draft planning branches with stale bases. Do not merge them blindly; compare their unique documentation against current main and the consolidated Phase 3 contracts before deciding whether to close or selectively port anything.
- Phase 3 is **not declared complete**. The automated local/emulated database and browser suites cover many core invariants, but real-device installation/offline use, screen-reader/contrast, and manual recovery checks remain deferred. Do not imply hosted Supabase authorization, real cross-device sync, backup/restore readiness, or production readiness from local tests.

## Next steps

1. Reconcile the old contradictory Phase 2/3 status statements in `docs/STATUS.md` and `docs/WP_REGISTRY.md` against this current evidence.
2. Inspect PR #58 and the older planning drafts for unique, still-relevant content; close superseded drafts or selectively port content in small reviewable PRs.
3. Continue the approved UI preview baseline in PR #62 without touching production runtime code.
4. Keep hosted provisioning, billing, production secrets, and production deployment gated behind separate explicit authorization.
