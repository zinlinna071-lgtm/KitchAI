# Phase 1 Owner Review Brief

**Status:** Recommendations for owner review; none of the open choices below are approved by this document.  
**Purpose:** Resolve the minimum product, data-protection, provider, and cost decisions needed to close WP1.1 without spending Coding AI quota on planning.  
**Related:** [Decision log](./DECISIONS.md), [architecture comparison](./ARCHITECTURE_OPTIONS.md), [local-sync contract](./LOCAL_SYNC_CONTRACT.md), [Phase 1 plan](./PHASE_1_PLAN.md).

## Recommendation at a glance

- Keep Phase 1 limited to one owner, one business, and one Business Profile vertical slice.
- Use a provider-neutral local-first design: durable browser storage plus a durable outbox; cloud writes must enforce ownership and revision checks.
- Keep conflicts visible and recoverable; require explicit resolution instead of silent last-write-wins.
- Prefer Supabase/PostgreSQL as the leading technical candidate, but do not treat this as provider selection or permission to create a project.
- Do not attach billing, buy a domain, store real customer data, or provision cloud resources without explicit approval.
- Do not start WP1.2 production scaffolding until the WP1.1 gate is met. Planning and test-contract work can continue without Coding AI.

## Decision recommendations

### O-001 — Provider and hosting model

**Recommendation:** Supabase Auth + PostgreSQL/RLS, with an application-owned local-first store and sync protocol. Keep the client persistence layer behind an adapter so the storage implementation can be changed later. Keep Appwrite + RxDB as the alternative only if a focused comparison shows materially less complexity while preserving conflict snapshots, ownership isolation, migration/export, and recovery.

**Why:** KitchAI's planned recipes, ingredients, stock, purchasing, sales, and finance data are relational. PostgreSQL is a strong fit and provides a testable database authorization boundary. Supabase does not solve local queueing, retries, idempotency, or KitchAI's conflict review automatically; these remain explicit app responsibilities.

**Not decided:** Provider, plan, region/data residency, hosting, auth methods, and deployment remain open. No project should be created on the strength of this recommendation.

### O-002 — Business Profile fields and validation

**Recommended first-slice fields:**

| Field | Proposed rule |
|---|---|
| `id` | Stable UUID generated once; never reused |
| `ownerId` | Derived/validated by trusted server from authenticated identity; never trusted from client input |
| `businessId` | Stable business scope; server validates that it belongs to the authenticated owner |
| `name` | Required, trim surrounding whitespace, 1–80 characters |
| `createdAt` | UTC timestamp, immutable after creation |
| `updatedAt` | UTC timestamp updated for accepted changes |
| `revision` | Server-controlled monotonically increasing concurrency token |

Reject blank names and names over the limit. Do not include contact details, address, tax information, or other sensitive fields in the first slice unless a real requirement emerges. Keep sync state, retry counters, operation IDs, and conflict snapshots outside the domain record.

**Reason:** This is sufficient to prove the complete local-save/offline/sync/authorization/conflict path without expanding the first slice into full business onboarding.

**Still requires owner acceptance:** The display name limit, whether one record is the business itself or a profile attached to a stable business entity, and any additional fields.

### O-003 — Conflict review and resolution

**Recommendation for the first slice:**

1. Preserve base, local, and remote snapshots with revision and source operation metadata.
2. Show the user which values differ.
3. Offer two explicit actions: **Keep local** or **Use remote**. Do not auto-merge or use last-write-wins.
4. Keep the original snapshots and append a resolution record with actor, timestamp, selected outcome, and resulting revision.
5. If the remote revision changes during review, reopen/recompute the conflict rather than forcing the old choice.

**Audit retention proposal:** Keep resolution metadata for the life of the associated record until a retention/deletion policy is designed. Avoid claiming legal compliance from this provisional choice.

**Still requires owner acceptance:** Two-button resolution UX, whether field-level merge is deferred, and audit retention/deletion rules.

### O-004 — Offline data, sign-out, and account switching

**Recommended safe initial behavior:**

- Treat browser storage as accessible to the signed-in browser profile; do not claim it is encrypted or protected from device access, malware, extensions, or XSS.
- Partition local records and queues by authenticated owner scope.
- On sign-out, stop sync and lock access to that owner's local workspace until that same owner signs in again. Do not silently purge unsynced data.
- On account switch, never send the previous account's pending operations using the new account's session.
- If a user asks to clear local data while unsynced operations exist, explain the risk and require an explicit confirmation; preserve/export options should be considered before destructive removal.
- Do not add custom encryption in Phase 1 unless a threat review demonstrates a concrete need; key management can create its own data-loss risk. Browser/device-level protections are not a substitute for server authorization.

**Still requires owner acceptance:** Lock-versus-purge policy, whether a local export is required before clearing, and any encryption/device-lock requirement. The proposed lock behavior is a conservative UX default, not a guarantee that data is cryptographically protected.

### O-005 — Deployment, region, budget, backup, and export

**Recommendation:** Use separate development/test/production environments; serve the PWA over HTTPS; never commit credentials or put privileged server keys in client code. Begin provider-policy tests with a local emulator or an isolated non-production project containing synthetic data only.

**Cost boundary:** Start with a no-billing local-emulator test if feasible. If a hosted project is required, record provider, plan, region, payment/billing state, maximum acceptable monthly spend, quota/pause behavior, and a cleanup procedure before provisioning. Budget alerts are notifications, not guaranteed hard caps.

**Backup/export:** Browser storage is not a backup. Before real business data is used, define a user-readable export path and test a recovery/restore procedure. Provider backups alone are not a complete application export, and free-tier backup guarantees must not be assumed.

**Still requires owner acceptance:** Provider/region, deployment/domain, whether any hosted test is allowed, monthly spending ceiling, backup frequency/retention, and export format.

## Proposed WP1.1 exit sequence

1. Owner reviews O-001–O-005 and confirms or revises the proposals.
2. Record the actual decisions in `DECISIONS.md`; do not change an item to accepted merely because it is recommended here.
3. Prepare the provider-specific policy and security test plan, including unauthenticated, owner-allowed, cross-owner read/write denied, and account-switch cases.
4. Choose an approved no-billing emulator scope or explicitly approved hosted non-production environment and cost boundary.
5. Only after those gates, implement provider-specific foundations and run real authorization tests.
6. Close WP1.1 only when the evidence is recorded. Then begin WP1.2 using one bounded implementation prompt for Coding AI, followed by tests and diff review.

## Current state / no-go boundaries

- The isolated local-sync spike tests browser persistence and fake-remote sync mechanics; it does not prove provider authorization.
- The provider recommendation is advisory, not approval.
- No production application implementation has started according to the current project status.
- No cloud project, billing activation, paid subscription, domain purchase, or provider credential is authorized by this brief.
- WP1.2 remains **Not started** until WP1.1's material decisions and evidence gates are met.
