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

### Owner-reported Android install/launch result — 2026-10-12

The owner reports that the remaining non-accessibility checks they attempted were successful and that installing the PWA on their Android phone also worked. Accessibility has **not** been tested and remains pending. Exact device model, Android version, browser/version, deployed URL, and screenshots were not provided; do not infer or claim those details.

- [x] Android PWA installation: PASS — owner-reported.
- [x] Android PWA launch/use: PASS — owner reports the tests were successful; detailed individual outcomes were not supplied.
- [ ] Accessibility: NOT TESTED — still pending.
- [ ] Desktop install/launch: unverified unless separately tested and documented.

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

## D. Recovery boundary

- [ ] Review automated local tests for unavailable storage, reload recovery, queued-operation preservation, retry/idempotency, sign-out queue isolation, and conflict snapshots.
- [ ] If storage quota or interrupted-device recovery is manually explored, use a disposable browser profile only; record exact steps and whether recovery is possible.
- [ ] Never infer encrypted-at-rest storage or backup protection from IndexedDB persistence.
- [ ] Record any recovery scenario not safely reproducible and leave it explicitly unverified.

## E. Automated evidence already required

- [ ] Confirm the latest main-branch baseline, app-shell, and local Supabase integration workflows are green on the same merge commit.
- [ ] Confirm the local Supabase database authorization suite and browser vertical-slice tests passed.
- [ ] Confirm screenshots are treated as temporary CI artifacts, not a public deployment or a hosted application URL.

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

## Owner-reported Android test evidence — 2026-10-12

**Evidence source:** Owner's written report in ChatGPT. No screenshot, exact browser/version, Android OS version, or deployed URL was provided; these details remain unrecorded.

### Local persistence checks reported by owner

- [x] Entered sample data, closed the app, reopened it, and confirmed the data remained.
- [x] Edited data, refreshed the page, and confirmed the edited values remained.
- [x] Went offline, refreshed, and confirmed data remained available.
- [x] Edited data while offline, refreshed, and confirmed the edits remained.
- [x] Reconnected to the internet, then refreshed, and confirmed the data remained available.

**Interpretation:** These results support persistence across app restart/refresh and availability during offline refresh in the tested environment. They do **not** prove that offline edits synchronized to a cloud backend, that another device received the edits, or that account isolation/recovery passed. The preview is intended to have no configured Supabase backend, so cloud-sync acceptance remains unverified.

**Session details:**
- Date: 2026-10-12 (recorded from this conversation; exact test time not provided)
- Tester: Project owner
- Device: Android phone (model and OS version not provided)
- Browser/version: Not provided
- Test environment / URL: Static preview environment; exact URL not provided in the report
- Evidence: Owner's written test report; no screenshot link provided
- Follow-up: Complete remaining install/launch and accessibility checks where feasible. Review automated recovery evidence; do not use scarce Coding AI credits for work that can be recorded manually.
- Still unverified: desktop checks, PWA install/launch, accessibility checks, storage-quota recovery, cloud sync, cross-device sync, account isolation, hosted auth, production readiness.

## Exit decision

WP1.7 may be closed only after the automated evidence is green, concrete manual evidence is recorded or the owner explicitly accepts specific manual-only items as deferred, remaining limitations are documented, and no unresolved critical security/data-loss issue remains. Hosted-provider validation and production readiness are outside this local-only gate.
