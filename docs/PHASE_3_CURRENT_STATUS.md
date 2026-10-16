# Current Project Status — 2026-10-16

**Authority:** This page reconciles verified Phase 2/3 implementation and the approved KitchAI UI design. Older dated statements in `STATUS.md`, `WP_REGISTRY.md`, and draft planning branches are historical where they conflict with this page.

## Verified merged work

- Phase 2 entity sync vertical slice: PR #35 is merged. Manual/hosted checks remain separately deferred.
- Phase 3 inventory/production/finished-stock foundations: WP3.1, WP3.2, WP3.2.1 purchasing/receiving, WP3.3 production, finished-stock dispositions, and WP3.5 stock counts have merged implementation slices. See `WP_REGISTRY.md` for implementation reconciliation.
- Cross-workflow stock integrity tests: PR #59 merged to main at `60d3b5351ed4aba3c8b6142882113124f811689d`.
- Authenticated stock-count mobile viewport test: PR #63 merged to main at `e515873c046ab03a56d92aa7eb935c79e8703d34`. It adds a 360×800 viewport assertion, no-horizontal-overflow check, and uncaught-browser-error assertion while preserving the authenticated stock-count test.
- PR #63 exact-head Baseline Checks [run 38897212177](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38897212177) and Local Supabase Vertical Slice [run 38897212658](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38897212658) passed. Main-head checks also passed on the documented commit `60d3b535`.
- Approved UI design preview: PR #67 merged to main at `5b28f31cfe514472dc85a8411991a453815dafb0`. It adds a separate `ui-preview.html` route; it does not replace the production `index.html` or enable a production AI connection.
- UI integration safety plan: PR #68 merged to main at `11094b147d9cc06496b6f812ba51c6493654003e`. It adds the production DOM/workflow inventory and staged UI integration guardrails. Vercel status for this merge commit was verified as **Success**.

## Current UI status and release gate

- The approved UI design preview is available at: https://kitchai-ui-preview-pzs9ksaoc-zinlinna071-8944.vercel.app/ui-preview.html
- The standalone preview is visual-only for features explicitly marked preview-only. The AI chat does not send prompts to a real AI service.
- The next planned step is UI-I2: implement the smallest production-shell foundation on a separate branch, preserving current DOM IDs, workflow handlers, data stores, offline/PWA behavior, and sync logic.
- **Production UI integration remains gated on the user's visual review of the standalone preview.** Do not merge a production UI change or release it before that review gate is satisfied.
- Do not load `src/ui-preview.js` into the production app. Do not copy the preview markup wholesale into `index.html`; `src/app.js` and workflow modules depend on the existing production DOM contract.
- Destinations without real, tested workflows must remain clearly marked **Coming Soon**. Do not display invented revenue, stock, reports, or AI responses.

## Phase 3 limitations and deferred acceptance

- Phase 3 is **not declared complete**.
- Real-device install/offline use, screen-reader/contrast review, and manual recovery acceptance remain deferred.
- Do not imply hosted Supabase authorization, real cross-device sync, backup/restore readiness, or production readiness from local tests.
- Hosted provisioning, billing, production secrets, and production deployment remain outside the current authorization.

## Next steps

1. Complete the approved UI preview visual review gate.
2. After review, implement UI-I2 as a small, isolated production-shell change; preserve the existing DOM contract and business workflows.
3. Verify critical DOM selectors are present exactly once, then run `npm run check`, `npm run check:pages-preview`, and relevant browser tests.
4. Deploy the integration branch to a separate preview and validate desktop/mobile, light/dark mode, navigation, offline behavior, and existing workflows before considering a production release.
5. Continue Phase 3 only against current main and current implementation evidence; do not merge stale, diverged planning branches blindly.
