# WP1.7 Manual Acceptance Checklist

**Purpose:** Record manual checks that browser automation cannot honestly certify. This checklist is for the current local-only Phase 1 milestone; it does not authorize a hosted Supabase project, billing, production credentials, or deployment.

**Current decision:** WP1.7 remains in acceptance review until the checks below are performed and evidence is recorded, or the owner explicitly accepts named checks as deferred with rationale.

## Safety rules

- Use a disposable test profile and non-sensitive sample business name only.
- Do not enter real customer, employee, supplier, financial, or other sensitive data.
- Do not create a hosted cloud project, enable billing, add production secrets, or deploy to production. The only permitted public deployment for this check is the owner-enabled, temporary GitHub Pages static test preview described in [MOBILE_TEST_PREVIEW.md](./MOBILE_TEST_PREVIEW.md).
- Do not simulate storage exhaustion or power loss against any valuable profile. If tested, use a disposable browser profile with no important local data.
- A screenshot or a green CI run is not evidence that every real-device/manual check passed.

## A. Install and launch

### Android browser / PWA

- [ ] After the owner enables Pages and manually publishes the test artifact, open the static preview at the expected URL format `https://zinlinna071-lgtm.github.io/KitchAI/`; record the actual URL and environment. Do not assume a GitHub Actions artifact is an installable app.
- [ ] Confirm the non-production static-preview warning is visible and sign-in/account-creation controls are absent.
- [ ] Confirm the page loads without horizontal overflow at portrait width.
- [ ] If the browser offers installation, install the PWA and launch it from the home screen.
- [ ] Confirm the app opens and the visible connection status is understandable.
- [ ] Confirm the install button is absent or behaves correctly when installation is unavailable.
- [ ] Record browser/version, Android version, date, result, and any screenshot.

### Desktop browser / PWA

- [ ] Open the same test environment in a supported desktop browser.
- [ ] Inspect at a narrow/mobile-sized viewport and a desktop viewport; confirm no clipped content or horizontal overflow.
- [ ] If installation is supported, test install and launch; otherwise record “not supported/not offered,” not “passed.”
- [ ] Record browser/version, operating system, date, result, and any screenshot.

## B. Offline and reconnection

Use only a disposable test account and sample profile, and only an environment explicitly configured for local Supabase testing.

- [ ] Load the app once while connected.
- [ ] Disconnect the network (or use browser network controls); reload/navigate as appropriate and record what remains available.
- [ ] Create or edit a sample profile offline; verify the UI does not falsely report that the remote write has completed.
- [ ] Restore connectivity; verify the queued operation eventually syncs without duplicate records.
- [ ] Reload the app and verify the resulting profile remains available.
- [ ] Record observed statuses, errors, retry behavior, and any data loss or duplication.

## C. Accessibility and usability

- [ ] Complete the primary flow using only keyboard navigation; focus remains visible and the order is logical.
- [ ] Confirm the skip link moves focus/content to the main region.
- [ ] Confirm status updates are perceivable without relying on color alone.
- [ ] Inspect text zoom at 200% and a narrow viewport for clipping/overlap.
- [ ] Test with the platform screen reader where available; headings, labels, buttons, errors, and status announcements should be understandable.
- [ ] Check contrast and visible focus against the project's accessibility target.
- [ ] Record assistive technology, browser/OS, findings, and unresolved issues. Do not label accessibility “passed” if it was not tested.

### Owner-reported Android accessibility finding — 2026-10-12

**Owner decision:** Defer the Android system-font-scaling issue for a future iteration; it does not block the current milestone. Keep it documented and revisit only if needed.

**Evidence source:** Owner's written report in ChatGPT. No screenshot, exact device/OS, browser/version, or deployed URL was provided.

- [ ] **Android system font scaling: DEFERRED — owner-reported.** Increasing font size in Android phone Settings does not increase text size in the app. No fix is planned for the current milestone.
- [x] Owner reports checks “2” and “3” passed. Their exact mapping to individual checklist items was not specified, so no specific items are inferred from that report.
- [ ] Accessibility overall remains not fully verified. The system-font-scaling issue is deferred; all other checks remain pending unless separately evidenced.

### Owner-reported manual preview session — 2026-10-12

**Owner report:** The owner states that all steps from the latest manual preview/acceptance instructions were completed and worked as expected.

**Evidence limitation:** This is a user-reported result in ChatGPT. The exact test date/time, Android/desktop device and OS versions, browser versions, deployed URL, screenshots, and per-check results were not supplied in this message. Do not describe these as independently verified.

- [x] Owner reports the instructed manual steps were completed successfully.
- [ ] Detailed per-check evidence and environment metadata: not yet recorded.
- [ ] This report does not establish hosted authentication, cloud sync, backup, or production readiness. The GitHub Pages preview is static/local-only; any local draft/offline behavior must not be represented as remote sync.
- [ ] Keep WP1.7 open until the manual acceptance record is sufficiently specific to support closure. Automated checks are verified against the unchanged application-code commit; the PR #21 merge changed documentation only.

## D. Recovery boundary

- [ ] Review automated local tests for unavailable storage, reload recovery, queued-operation preservation, retry/idempotency, sign-out queue isolation, and conflict snapshots.
- [ ] If storage quota or interrupted-device recovery is manually explored, use a disposable browser profile only; record exact steps and whether recovery is possible.
- [ ] Never infer encrypted-at-rest storage or backup protection from IndexedDB persistence.
- [ ] Record any recovery scenario not safely reproducible and leave it explicitly unverified.

## E. Automated evidence already required

- [x] Confirm baseline, app-shell, and local Supabase integration workflows passed on the latest application-code commit `1b7169f7569fe012ffacfca44356bb144d86f86d`. PR #21 merged as `d1341bd9586e5b77ebcaf992d1437e80771fd954` and changed only this checklist, so path-filtered code workflows correctly did not rerun on that docs-only merge. See [post-merge verification](./WP1_7_POST_MERGE_CI_VERIFICATION.md).
- [x] Confirm the local Supabase database authorization suite and browser vertical-slice tests passed in the recorded WP1.6/local integration workflow evidence.
- [x] Confirm screenshots are temporary CI artifacts and the GitHub Pages URL is a static test preview, not a hosted application or evidence of remote sync.

## Evidence record

Fill this section for each actual manual session; leave fields blank rather than inventing results.

- Date/time:
- Tester:
- Device / OS:
- Browser and version:
- Test environment / URL:
- Sections completed:
- Results and observed issues:
- Evidence links:
- Follow-up issue/PR:
- Explicitly deferred checks and rationale:

## Exit decision

WP1.7 may be closed only after the automated evidence is green, concrete manual evidence is recorded or the owner explicitly accepts specific manual-only items as deferred, remaining limitations are documented, and no unresolved critical security/data-loss issue remains. Hosted-provider validation and production readiness are outside this local-only gate.
