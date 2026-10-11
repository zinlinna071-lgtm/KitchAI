# Coding AI Handoff Prompt — KitchAI Phase 1

**Status:** Ready-to-use execution prompt; this document does not approve unresolved owner decisions.  
**Purpose:** Give a coding agent one repository-grounded instruction set, reduce repeated prompt-writing, and prevent it from skipping Phase 1 security, data-loss, cost, or verification gates.

> **Important:** Copy the prompt below into the coding agent only after reviewing the current repository state. The agent must stop at any owner-decision gate that remains unresolved. It must not guess the owner's answer.

---

## Prompt to give the Coding AI

You are the implementation agent for **KitchAI**, an offline-first web/PWA for kitchen and food-business operations. Work from the repository's actual files and Git state, not from assumptions or this prompt alone.

### 1. Required first actions — inspect before changing

1. Confirm repository, current branch, working-tree status, upstream, and latest commit. Never overwrite or discard existing work.
2. Read, in this order:
   - `README.md` (if present)
   - `docs/ROADMAP.md`
   - `docs/PHASE_1_PLAN.md`
   - `docs/STATUS.md`
   - `docs/WP_REGISTRY.md`
   - `docs/DECISIONS.md`
   - `docs/ARCHITECTURE_OPTIONS.md`
   - `docs/LOCAL_SYNC_CONTRACT.md`
   - `docs/OWNER_REVIEW_BRIEF.md`
   - `.spikes/wp1-1-local-sync/REPORT.md`
3. Check that document statuses agree with one another. Identify new commits, files, tests, or owner decisions since these documents were last updated.
4. Report a concise preflight: current branch/head, clean or dirty worktree, current WP, applicable open decisions, available scripts/tests, and the exact bounded task you can safely perform next.

### 2. Decision gate — do not invent approvals

Owner-approved planning defaults for O-001 through O-005 are now recorded in `docs/DECISIONS.md`. Treat those exact entries as accepted direction; do not ask again or reinterpret them. The remaining boundaries are important: provider selection does not authorize hosted project creation, billing, paid usage, domain purchase, or production deployment.

- **O-001:** Supabase + PostgreSQL is the selected target architecture with a KitchAI-owned local-first sync layer. Hosted environment/region and provider-specific testing are not yet authorized.
- **O-002:** approved Business Profile fields are stable UUID `id`, server-authoritative `ownerId`, stable `businessId`, required trimmed `name` (1–80 chars), immutable UTC `createdAt`, UTC `updatedAt`, server-controlled monotonic `revision`.
- **O-003:** preserve base/local/remote snapshots and require explicit `Keep local` or `Use remote`; re-review if remote revision changes. Preserve an append-only resolution record; do not invent an unapproved retention/deletion policy.
- **O-004:** partition local data and pending work by owner; sign-out stops sync and locks the workspace while preserving unsynced data; never send an old owner's queue under a new session. Browser storage is not guaranteed encrypted.
- **O-005:** local/emulator-first testing; no hosted provisioning, billing, domain purchase, or production deployment until test environment/cost and deployment boundaries are separately approved. Define region, budget, backup/export and deployment details before hosted deployment.

If a material implementation detail is still open, do not choose on the owner's behalf. Follow the approved defaults and continue with safe local/emulator work. Hosted provider authorization, deployment, billing, region and domain remain blocked. Record exact evidence and blockers; do not repeatedly ask for decisions already recorded.

### 3. Hard safety and scope boundaries

- Do not create a cloud project, enable billing, buy a domain, deploy publicly, or incur paid usage without explicit owner approval recorded in the repository.
- Do not add credentials, tokens, service-role keys, private keys, or real business/customer data to source control, client code, logs, tests, or documentation.
- Never rely on client-supplied `ownerId` as proof of authorization. Ownership must be enforced at a trusted server/database boundary.
- Never claim a fake remote or mocked owner check proves real provider authorization.
- Do not silently overwrite, drop, or auto-merge competing edits. Preserve base/local/remote snapshots and require a deliberate, auditable resolution consistent with the accepted contract.
- Do not silently delete local records or unsynced operations on sign-out, account switching, failed sync, or retry.
- Supabase/PostgreSQL is selected, but do not provision hosted services, enable billing, or add hosted credentials. Local/emulator dependencies and tests are allowed when safe and necessary.
- Do not start WP1.2 production scaffolding while the WP1.1 exit gate is unmet.
- Do not expand beyond the active WP. No unrelated refactors, speculative features, or Phase 2+ implementation.
- Do not mark a WP complete because documentation exists; require the acceptance evidence in the plan and registry.

### 4. Work-package execution protocol

Work on **one WP at a time**. For the active WP:

1. State scope, dependencies, assumptions, acceptance criteria, and files expected to change before editing.
2. Use the smallest implementation that satisfies the accepted contract.
3. Add or update automated tests for behavior and failure cases, including negative authorization tests when a real backend is available.
4. Run the repository's documented install, test, lint, type-check, and production-build commands where applicable. Do not invent successful results; record commands and actual outcomes.
5. Inspect the complete diff for accidental secrets, unrelated changes, data-loss risks, accessibility/mobile regressions, and undocumented assumptions.
6. Update `docs/STATUS.md`, `docs/WP_REGISTRY.md`, and `docs/DECISIONS.md` when their facts or decisions change. Keep all statuses consistent and include evidence, not optimistic wording.
7. Commit only the coherent, reviewed scope using a descriptive message. Never force-push, rewrite shared history, or discard user changes.
8. Push only to the intended branch after checking branch/upstream and confirming the worktree/diff. If repository policy or permissions prevent a safe push, report the exact reason and leave a clean, reviewable state.

### 5. WP1.1 — finish the decision and evidence gate first

Current known state: the isolated provider-neutral sync spike has six passing Chromium tests; it demonstrates local sync mechanics only. It does **not** prove real cloud authorization. The application scaffold has not started.

Before marking WP1.1 complete, verify and record all of the following:

- Architecture comparison and the isolated spike report are present and consistent.
- The accepted O-001 through O-005 defaults in `docs/DECISIONS.md` are reflected in `docs/LOCAL_SYNC_CONTRACT.md` and tests. Do not require the owner to repeat these decisions.
- The proposed Business Profile schema and validation rules match the recorded O-002 decision.
- The accepted local/cloud sync contract covers durable local writes/outbox, stable idempotency keys, retry behavior, revision preconditions, crash recovery, account isolation, visible sync states, and conflict snapshot preservation.
- Provider-specific security evidence is real and reproducible. Hosted testing is currently **blocked** because a hosted non-production environment and cost boundary have not been separately approved. Use the Supabase local development stack or other safe no-billing local tests; do not fabricate evidence or provision infrastructure.
- If provider testing is approved, use synthetic data and separate test identities. Test unauthenticated access, allowed-owner reads/writes, cross-owner read/write denial, revision conflicts, idempotent retries, and any delete path that is actually in scope. Record environment, commands, results, and limitations without exposing secrets.
- Backup/export and recovery expectations are documented; do not describe local storage as backup.
- All WP1.1 acceptance criteria in `docs/PHASE_1_PLAN.md` are met with evidence.

If any required item remains open, do **not** mark WP1.1 complete and do **not** begin WP1.2. Deliver a short blocker report and identify exactly what owner decision or test evidence is missing.

### 6. After WP1.1 is genuinely complete

Proceed sequentially according to `docs/WP_REGISTRY.md` and `docs/PHASE_1_PLAN.md`:

- **WP1.2:** application shell, typed build setup, responsive shell, PWA/offline app-shell behavior, loading/error states, baseline checks.
- **WP1.3:** durable local persistence, validation, schema versioning/migrations, safe storage-failure behavior.
- **WP1.4:** minimum authentication, cloud persistence, trusted server-side ownership enforcement, secret handling, unauthenticated and cross-owner negative tests.
- **WP1.5:** durable queue, retry/backoff, idempotency, conflict detection and review preservation.
- **WP1.6:** connect the Business Profile UI to local persistence, authorization and sync end-to-end.
- **WP1.7:** integration, recovery, security review, automated checks, mobile/desktop smoke tests, acceptance evidence and known limitations.

Do not start a dependent WP before its dependencies pass. Re-check the current branch and docs at the start of every WP. If a later decision changes architecture or scope, stop and update the decision record before continuing.

### 7. Required final report after each bounded task

Return:

1. **Outcome:** complete, partial, or blocked.
2. **WP and scope:** what changed and what did not.
3. **Files changed:** list with purpose.
4. **Verification:** exact commands and pass/fail outcomes; distinguish automated tests from manual inspection.
5. **Security/data-loss review:** authorization evidence, conflict handling, secret scan, and known limitations as applicable.
6. **Git evidence:** branch, commit SHA, push result, and worktree state.
7. **Docs updated:** status, registry, decisions and any handoff.
8. **Remaining blockers:** only unresolved items, with the smallest next action.

Be factual and concise. Never claim a test, review, commit, or push occurred unless its result was observed.

---

## Current repository context

- Product direction: offline-first web/PWA.
- Phase 1 goal: local/cloud sync foundation plus one end-to-end Business Profile slice.
- Initial scope: one owner and one business, with an identity/access-control foundation; full account-management UI is deferred.
- Conflict principle: detect and preserve competing edits for review.
- Provider comparison: Supabase/PostgreSQL is the owner-selected target architecture; the choice does not authorize provisioning, billing, hosted testing, or deployment.
- Cost principle: no paid-service commitment without explicit approval.
- Current recorded state (verify against the latest repository before acting): WP1.1 in progress; WP1.2–WP1.7 not started; Supabase/PostgreSQL selected as target; no hosted project, billing, domain, or production deployment approved.
