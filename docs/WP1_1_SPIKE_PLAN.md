# WP1.1 Technical Spike Plan

**Status:** Ready for execution in a disposable Codespaces/dev environment.  
**Purpose:** Gather implementation evidence before choosing the cloud provider or starting WP1.2.  
**Parent:** [Phase 1 plan](./PHASE_1_PLAN.md) · [Architecture options](./ARCHITECTURE_OPTIONS.md)

## Guardrails

- This is a prototype only; do not treat it as production application code.
- Do not create a cloud project, add billing, use real customer/business data, or add secrets.
- Do not install a provider SDK or commit to Supabase/Appwrite/Firebase in the production dependency graph.
- Keep the spike isolated under `.spikes/wp1-1-local-sync/` (or another clearly isolated disposable folder); document removal/retention before changing the main app structure.
- Do not claim cloud authorization is proven by a fake server. Cloud authorization requires a separate provider-specific test after the owner selects a provider.
- Do not silently overwrite either side of a simulated conflict.

## Questions the spike must answer

1. Can a small browser PWA data layer save a Business Profile locally and read it after reload?
2. Can an edit be queued while offline and safely retried when connectivity returns?
3. Does retrying the same operation avoid duplicate logical writes?
4. When local and remote versions diverge, can both versions be retained and surfaced as a conflict?
5. Can the behavior be tested deterministically without live cloud credentials or network access?
6. What limitations or reasons would justify evaluating RxDB instead of direct IndexedDB?

## Proposed minimum record

```ts
type BusinessProfile = {
  id: string;                 // stable UUID
  ownerId: string;            // test fixture only; server ownership is authoritative
  name: string;               // required, trimmed, bounded length
  createdAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
  revision: number;           // monotonically increasing test revision
};
```

This is a spike fixture, not a finalized production schema. Keep the initial fields minimal; do not add addresses, phone numbers, financial details, or real personal data.

## Minimum behavior

- Local create/read/update with schema validation.
- Reload persistence using IndexedDB in a real browser test where feasible.
- An explicit outbox with stable operation IDs, pending/synced/failed/conflict states, and bounded retry behavior.
- A fake remote adapter with deterministic responses (success, transient failure, duplicate retry, stale revision, and conflicting update).
- Conflict records retain the base revision, local candidate, remote candidate, and a status requiring explicit resolution.
- A failed sync must not delete or replace the local version.
- The fake remote must reject mismatched owner IDs in tests, while clearly labeling this as a simulation—not proof of production authorization.
- No last-write-wins fallback.

## Acceptance checklist

- [ ] Valid profile can be created, read, updated, and survives a browser reload.
- [ ] Invalid/empty names are rejected without corrupting the stored record.
- [ ] An offline edit remains locally readable and visibly pending.
- [ ] A transient failure followed by retry reaches the fake remote.
- [ ] Replaying the same operation ID does not create a duplicate logical write.
- [ ] A stale-revision/competing edit creates a conflict record and retains both candidates.
- [ ] Resolving a conflict is an explicit operation; no candidate is discarded automatically.
- [ ] Tests cover each behavior above and run through documented commands.
- [ ] A short report compares direct IndexedDB with RxDB against actual spike evidence.
- [ ] Report clearly lists untested items, especially real authentication, database RLS/permissions, multi-device replication, and provider-specific behavior.

## Required report

Create `.spikes/wp1-1-local-sync/REPORT.md` containing:
- environment and exact commands run;
- files/dependencies added;
- test results (pass/fail; no unsupported claims);
- observed failure modes and limitations;
- direct IndexedDB vs RxDB assessment based on the prototype;
- recommendation for the local persistence/sync boundary;
- next provider-specific checks needed after O-001 is decided.

## Coding-AI execution prompt

> Work only on KitchAI WP1.1 as described in `docs/WP1_1_SPIKE_PLAN.md`. First inspect the repository and read `docs/STATUS.md`, `docs/PHASE_1_PLAN.md`, `docs/WP_REGISTRY.md`, `docs/ARCHITECTURE_OPTIONS.md`, and `docs/DECISIONS.md`. Do not start WP1.2 or production app scaffolding. Implement the smallest isolated, disposable local-first sync spike under `.spikes/wp1-1-local-sync/` that tests IndexedDB persistence, outbox/retry/idempotency, and preservation of both sides of a conflict using a deterministic fake remote. Do not provision or connect any cloud service, add secrets, enable billing, use real data, or add a provider SDK. Add automated tests and document exact commands/results in `REPORT.md`. Fake-owner checks must be labeled simulation only; do not claim real authorization is proven. Never silently overwrite a conflicting version. Run all available checks, inspect the final diff, and fix failures. If browser tooling or dependencies are unavailable, document that limitation rather than faking a pass. Do not delete or overwrite existing files. Commit the isolated spike and its report to `main` only if all available checks pass and the diff contains only this spike plus a narrowly necessary status/registry update. If checks fail, leave the work uncommitted and report the blockers. Update `docs/STATUS.md` and `docs/WP_REGISTRY.md` only with verified results. Do not mark WP1.1 complete until the owner decision and provider-specific authorization/security evidence are resolved.
