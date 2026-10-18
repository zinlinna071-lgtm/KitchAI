# KitchAI instructions for GitHub Copilot

**Before every task, read the repository-root `AGENTS.md` and follow it as mandatory project policy.** The same rules apply to bug fixes, refactors, tests, and documentation.

Critical requirements:
- Preserve all existing working behavior before fixing or adding anything.
- Diagnose and verify a root cause before patching; do not guess.
- Work on a feature branch, never directly on `main`; keep fixes minimal and reviewable.
- Add regression tests and test nearby behavior. Never weaken tests or fake green CI to hide a defect.
- Protect local data, sync, migrations, security/owner isolation, offline/PWA and service-worker behavior.
- If a regression appears, stop and isolate/revert the change before continuing.
- Report the exact checks actually run and manual checks still needed. Do not merge while required checks or important acceptance tests are unresolved.

Use the KitchAI regression checklist and completion-report template in `AGENTS.md`.
