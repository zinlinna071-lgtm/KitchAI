## Summary
<!-- What changed and why? -->

## Root cause / rationale
<!-- For bug fixes, describe evidence supporting the cause. If not confirmed, say so. -->

## Existing behavior protected
<!-- List the existing behavior that could regress. -->

## Regression checklist
- [ ] Change is isolated and unrelated files were not modified.
- [ ] Added/updated regression tests where feasible.
- [ ] Ran relevant focused tests.
- [ ] Ran `npm run check` or explained why it could not be run.
- [ ] Reviewed the final diff for unintended changes.
- [ ] Checked applicable desktop/mobile, offline/PWA, data/sync, and security behavior.
- [ ] Clearly listed manual/device tests not performed.
- [ ] No valid test was weakened or skipped to hide a defect.

## UI Rules Checklist
<!-- For PRs changing UI, check every item that applies and explain any exception in the PR body. -->
- [ ] Followed `docs/UI-DESIGN-SYSTEM.md` and reused shared tokens/components.
- [ ] Checked narrow mobile layout for overflow, clipping, overlap, and hidden actions.
- [ ] Considered phone, tablet, and desktop reflow rather than scaling content down.
- [ ] Checked light/dark theme behavior where supported.
- [ ] Checked supported translations and long/Burmese text wrapping where applicable.
- [ ] Considered keyboard focus, labels, touch targets, zoom, and text scaling.
- [ ] Ran relevant automated checks and listed any manual/device checks still pending.

## Evidence
<!-- Exact commands and outcomes. Do not report checks that did not run. -->

## Risks / manual verification still needed
<!-- State remaining limitations and acceptance steps. -->

## Merge readiness
- [ ] Required CI checks passed.
- [ ] Important acceptance criteria are satisfied.
- [ ] No known regression remains.
