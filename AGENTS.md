# KitchAI — Mandatory Coding-Agent Rules

These rules apply to every AI or human contributor, every task, and every branch. Read this file before inspecting or changing code. **Protecting existing working behavior is more important than quickly fixing or adding a feature.**

## Non-negotiable priorities

1. **Preserve working behavior first.** Never knowingly break a working feature to fix another issue. If a safe fix is not understood, do not guess or make a speculative patch; report the uncertainty and leave behavior unchanged.
2. **Find the cause before changing code.** Reproduce the problem when possible. Trace relevant state, event handlers, data flow, CSS, persistence, and related tests. State a testable root-cause hypothesis before patching.
3. **Keep changes small and isolated.** Use a feature/fix/docs branch and a reviewable PR. Never work directly on `main`. Avoid unrelated refactors, formatting churn, dependency upgrades, and broad rewrites while fixing a focused bug.
4. **Establish a baseline.** Inspect the current branch, recent changes, existing tests, and relevant implementation before editing. Record the current expected behavior and tests that pass. Do not overwrite another contributor's work.
5. **Add regression protection.** Create or update a test that would fail before the fix and pass after it, whenever the behavior can be automated. Test nearby behaviors that could be affected, not only the reported symptom.
6. **Verify honestly.** Run relevant tests and checks after the change. Run `npm run check` when applicable; it includes type checking, tests, and a build. If a command cannot run, say exactly what was not verified. Never claim success based on code inspection alone or on checks that did not run.
7. **Do not game the tests.** Never weaken/remove a valid assertion, skip a failing test, fake a success, or change production behavior solely to make CI green without diagnosing the real cause. Fix the underlying defect or explain a justified test change.
8. **Protect data and security.** Treat local stores, domain logic, sync queue/retries, migrations, owner isolation/RLS, idempotency, conflict handling, and business records as high risk. Do not delete/transform data or weaken security without a justified, tested migration and explicit review.
9. **Protect PWA behavior.** Changes to app shell, offline support, service worker, cache names, or assets must consider installed-app behavior, stale caches, offline reload, and update/recovery paths.
10. **Stop on regression.** If a previously working behavior fails, stop adding changes. Compare against the last known-good commit, isolate or revert the offending change, and investigate before proceeding.
11. **Do not merge on assumptions.** Review the diff and CI status. Keep the PR open when important behavior is untested, a regression remains, or required checks have not passed. Do not claim a real-device/manual test was performed by an AI that did not perform it.
12. **Report evidence, not confidence.** Summarize root cause, exact files changed, tests actually run and results, manual tests still needed, known risks, and merge status.

## Required workflow for every code change

1. Read these rules and the relevant project docs/code; inspect current branch and diff.
2. Write down the existing behavior to preserve and the smallest acceptance/regression checklist.
3. Reproduce the issue or explain why it cannot be reproduced. Inspect before patching.
4. Make the smallest focused change on a non-`main` branch.
5. Add regression test(s) where feasible; do not replace real behavior with a test-only shortcut.
6. Run focused tests, then appropriate project checks/build. Inspect the final diff for unrelated changes.
7. Open/update a PR with a clear explanation and test evidence. Do not merge until required automated and manual acceptance criteria are satisfied.
8. If any regression appears, stop, isolate/revert the bad change, and re-test the last known-good behavior.

## KitchAI regression checklist

Select the relevant items for each change; do not claim unrelated checks were performed.

- [ ] Existing navigation, controls, forms, and responsive layouts still work.
- [ ] Desktop swipe across the screen toggles AI/Manage mode.
- [ ] Desktop drawer remains open while navigating; only its intended toggle closes it.
- [ ] On mobile, the first tap after a mode swipe works.
- [ ] On mobile, the first tap after closing the drawer with a left swipe works.
- [ ] Local data remains after refresh and close/reopen; edits persist as expected.
- [ ] Offline use/reload and online recovery/sync remain correct where applicable.
- [ ] Existing local stores, business/domain logic, migrations, sync, and owner isolation remain intact.
- [ ] PWA install/update/service-worker behavior remains intact where applicable.
- [ ] Automated checks and real-device/manual checks are clearly distinguished.

## Consistent data-entry form presentation (mandatory)

- For every workflow where a user creates or edits a record, use the same **internal-screen form pattern** as Personal Expenses: set the relevant dialog/form state and replace the current page's content area with the form.
- Do **not** use a floating/overlay modal dialog for ordinary create/edit forms, and do **not** introduce a separate URL route solely to show these forms. Keep the form inside the existing app screen/content flow.
- Show a clear page-level heading and a **Back** control (back arrow preferred) to return to the prior list/screen. Use consistent spacing, field styling, action placement, validation feedback, and Save/Cancel behavior across forms.
- Editing an existing record should reuse the same form pattern and prefill its current values.
- On Back/Cancel, avoid silently losing user-entered data; where draft preservation is not supported, handle leaving the form clearly and consistently. On successful save, return to the appropriate prior screen and show the updated record/state.
- Apply this rule consistently to Personal Expenses, Ingredients, Menu, business expenses, production, inventory, and future create/edit forms. A truly tiny one-field action may be considered separately only when there is a clear usability reason; do not make inconsistent exceptions by default.
- This is a presentation/navigation rule, not proof of persistence. Continue to verify that saves use the correct data layer and persist where required.

## Repository-specific safeguards

- Follow the existing architecture and current repository docs; do not resurrect abandoned designs or invent features outside the task.
- The UI preview is not proof that database persistence, AI service calls, or cloud sync work. Verify each at the layer that actually implements it.
- Preserve local-first behavior and the existing data/sync foundations during UI changes.
- Update status/decision docs only when the change actually changes project status or decisions.
- Never expose secrets, commit credentials, or weaken access control to bypass a failing test.
- If requirements conflict or a safe fix cannot be demonstrated, stop and explain the blocker instead of guessing.

## Completion report template

- **Cause / hypothesis:** …
- **Change:** …
- **Regression coverage:** …
- **Checks run:** exact commands and outcomes; list anything not run.
- **Manual/device verification needed:** …
- **Risks / limitations:** …
- **PR / merge status:** …

These instructions are mandatory project guidance. Repository permissions and CI settings are the mechanisms for technical enforcement; instruction files alone cannot force every external AI tool to comply.
