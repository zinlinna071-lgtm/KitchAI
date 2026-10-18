# Incident Record: Swipe Followed by Tap Was Ignored

- **Incident ID:** KAI-UI-001
- **Severity:** P1 — High (core interaction blocker)
- **Status:** Resolved; regression guard added
- **Affected area:** Shared application shell, AI/Manage mode swipe navigation, mobile drawer interaction
- **First tracked in:** PR #106
- **Resolution merged:** 2026-10-19, PR #106

## User-visible symptoms

After a horizontal swipe switched between AI Mode and Manage Mode, the next tap could be ignored. The issue was especially noticeable after a right-to-left swipe. The mobile drawer gesture could also leave the next tap affected. This blocked normal interaction but did not indicate data loss or a security incident.

## Root cause

The shared shell used CSS `touch-action: pan-y`. In the tested Chromium touch-input path, after a horizontal swipe, the following physical tap could emit pointer/touch events without a corresponding synthesized `click`. The existing JavaScript click-suppression guard was not the root cause and could not reliably fix a click the browser never synthesized.

## Fix applied

1. Changed the shell's `touch-action` from `pan-y` to `manipulation`.
2. Applied the same adjustment to the desktop sidebar rule.
3. Added `overscroll-behavior-x: none` on `html` to prevent unwanted horizontal browser overscroll/navigation.
4. Bumped the service-worker shell cache to v30 so installed clients refresh the changed frontend.
5. Added a browser regression test that performs touch swipes in both directions and immediately taps a control, checking that both mode switching and the tap work.

## Verification

- Project owner confirmed the behavior works correctly on a real phone: both swipe directions and the following taps work.
- GitHub Actions: Static test preview, Application Shell, and Stock Count Browser Tests passed for the fix branch.
- One unrelated workflow, `WP1.6 Local Supabase Vertical Slice`, failed at “Start isolated local Supabase stack”; it did not fail in the swipe/tap test.
- Vercel deployment status was limited by the free-plan deployment rate limit; that is not a code-test result.
- Automated browser tests are not a substitute for real-device testing across every browser/OS.

## Regression-prevention rules (must follow in future UI work)

- **Do not change or remove the shell's `touch-action: manipulation` or the sidebar's corresponding rule without a demonstrated need and passing regression tests.**
- Any change to `src/ui-preview.css`, `src/ui-preview.js`, swipe handlers, mode switching, drawer gestures, or service-worker caching must run the swipe-then-tap browser test.
- Keep coverage for left-to-right and right-to-left swipes followed by an immediate tap; do not add arbitrary waits that hide the bug.
- Preserve ordinary taps and keyboard activation, and verify vertical scrolling/dragging is not mistaken for a horizontal swipe.
- Before merging interaction changes, inspect the browser test results. For changes to touch behavior, perform a real-phone smoke test when available.
- Treat a recurrence as **P1 — High** because it blocks core navigation/input. Fix and add/repair regression coverage before merging.

## Change history

- PR #106: https://github.com/zinlinna071-lgtm/KitchAI/pull/106
- StackBlitz preview used for owner verification: https://stackblitz.com/github/zinlinna071-lgtm/KitchAI/tree/fix/rtl-swipe-first-tap
