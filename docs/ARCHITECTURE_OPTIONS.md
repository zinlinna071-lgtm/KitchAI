# Phase 1 Architecture Options and WP1.1 Decision Evidence

**Status:** Advisory comparison checked against official documentation on 2026-10-11; not a final vendor selection.
**Related:** [Phase 1 plan](./PHASE_1_PLAN.md), [Decision log](./DECISIONS.md)

## Requirements used for comparison

1. Offline-first web/PWA; local changes must remain safe when connectivity is absent.
2. Secure identity and server-side authorization/ownership.
3. Business data will become relational over time (recipes, ingredients, purchasing, inventory, sales, finance).
4. Detect and preserve conflicting edits for review rather than silently discarding one side.
5. Small initial project with low operational burden and no unapproved paid commitments.
6. Testable behavior, migration/backup options, and a path toward multiple businesses.

## Options

| Option | Strengths | Main trade-offs / risks | Fit for KitchAI |
|---|---|---|---|
| **A. Supabase (Postgres + Auth + RLS) with explicit local-first store and app-owned sync** | Relational SQL suits recipes, stock movements, orders, and finance; integrated auth and database; Row Level Security can enforce access at the data boundary; portable Postgres model. | Offline-first sync, retry/idempotency, and conflict preservation are still application responsibilities; RLS must be designed and tested correctly; managed-service limits/costs must be checked. | **Strong candidate** because future business domains are relational and ownership policies are important. Not selected yet. |
| **B. Firebase Authentication + Cloud Firestore** | Managed auth/database; browser SDK offers offline persistence and sync for cached data; security rules provide client access control and validation. | Document-oriented data modeling may complicate relational reporting and cross-domain consistency; web offline persistence must be enabled and has browser/security considerations; Firestore documents that competing writes to one document use last-write-wins, which does not by itself meet KitchAI's preserve-conflicts requirement. | Viable if managed sync simplicity outweighs relational modeling needs, but custom conflict handling would still be required. |
| **C. Appwrite (managed or self-hosted) + local-first store such as RxDB** | Integrated auth and database permissions; Appwrite documents an offline-sync integration using RxDB and a push/pull flow; self-hosting is an option. | Adds a local-first replication integration and its operational/versioning considerations; verify exact conflict behavior, supported features, deployment burden, and total cost before choosing. | Worth evaluating as a candidate, especially if its documented local-first integration reduces custom sync work. |
| **D. Custom API + managed/self-hosted PostgreSQL and separate identity service** | Maximum control over APIs, data model, sync protocol, and conflict review; relational portability. | Highest implementation and operations burden; more security-sensitive components to build and maintain; inappropriate to start without a clear need and operational plan. | Keep as a fallback/reference architecture, not the default for the first slice. |

## Local persistence and sync strategy (separate from cloud vendor)

For any option, KitchAI needs a deliberate local data layer. Candidate approaches include:

- **IndexedDB directly:** fewer dependencies and maximum control, but the team owns queueing, replication, migrations, and conflict logic.
- **A local-first database such as RxDB:** provides replication abstractions/integrations, but introduces a dependency, licensing/feature verification, and configuration work. Verify conflict semantics rather than assuming it automatically matches the product requirement.

Browser storage is not a backup. The app must communicate sync state and must not imply cloud backup while changes are still local-only.

## Initial assessment (superseded by the dated review below)

A provisional shortlist is **Option A (Supabase/Postgres with an explicit local-first sync layer)** and **Option C (Appwrite with an RxDB-based local-first layer)**, with Firebase retained as a comparison point. This is a recommendation for further validation, not authorization to create a project, enable billing, or hard-code a provider into application code.

Supabase's official documentation describes a full Postgres database and recommends Row Level Security for exposed tables; its service-role/secret keys must never be exposed in frontend code. Firebase's documentation describes web offline persistence as disabled by default and states that multiple changes to the same document use last-write-wins. Appwrite documents an offline-sync approach using local storage and push/pull replication, including conflict handling as an application design concern.

## Validation checklist before selection

- [ ] Before selection/provisioning, confirm current free-tier resource ceilings, billing triggers, pause behavior, and region availability. Supabase and Firebase published limits were rechecked 2026-10-11; Appwrite's exact resource ceilings and pause rule remain unverified.
- [ ] Confirm authentication providers and account recovery options appropriate to the initial release.
- [x] Run the provider-neutral local sync spike for IndexedDB reload persistence, offline pending state, retry/idempotency, and conflict snapshots. See [spike report](../.spikes/wp1-1-local-sync/REPORT.md); provider reconnection, durable remote behavior, and authorization remain untested.
- [ ] Prove server-side ownership isolation with allow and deny tests.
- [ ] Confirm migration/export path and backup/restore implications.
- [ ] Confirm the selected provider's complete migration/export and backup/restore path with a tested restore; this review is documentation-only.
- [ ] Estimate expected cost at initial scale and define a spending guardrail.
- [ ] Record the chosen provider and rationale in the decision log before implementation dependencies are added.

## Sources

- Supabase database overview: https://supabase.com/docs/guides/database/overview
- Supabase secure data / Row Level Security guidance: https://supabase.com/docs/guides/database/secure-data
- Firebase Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firebase Firestore security rules: https://firebase.google.com/docs/firestore/security/overview
- Appwrite offline sync: https://appwrite.io/docs/products/databases/tablesdb/offline
- Appwrite database options: https://appwrite.io/docs/products/databases


## 2026-10-11 validation update
## Official-document review (2026-10-11)

The provider URLs below were fetched from official documentation on this date. Published prices and quotas can change; verify again immediately before provisioning. "Verified" means the linked page states the fact, not that KitchAI has tested it in a provider environment. Design judgments and unresolved items are labeled separately.

### Consistent comparison matrix

| Criterion | Supabase / PostgreSQL + explicit local-first layer | Appwrite Cloud + RxDB | Firebase Auth + Cloud Firestore |
|---|---|---|---|
| Relational data fit | **Strong.** PostgreSQL fits the expected recipes, ingredients, purchasing, inventory, sales, and finance relationships. | **Moderate.** TablesDB documents rows, relationships, and queries; current pricing also lists PostgreSQL and MySQL database options. Confirm the exact product/plan and migration model before selection. | **Weaker for this roadmap.** Firestore is document-oriented; relational constraints and cross-domain reporting would be application-owned or require another service. |
| Local-first behavior | **Application responsibility.** Keep IndexedDB/outbox local and the server/Postgres authoritative. The spike validates browser persistence and fake-remote mechanics only. | **Documented pattern, not turnkey proof.** Appwrite describes local storage followed by push/pull sync and links RxDB; adapter behavior and supported operations need a KitchAI prototype. | **Built-in cache/sync path.** Web offline persistence is disabled by default; cached data can persist across sessions and is not automatically cleared. This raises shared-device/sign-out questions. |
| Authentication and ownership boundary | Supabase Auth plus Postgres RLS is a suitable design. Official guidance requires RLS and least-privilege policies on exposed tables; service-role/secret keys bypass RLS and must stay server-side. Actual policy behavior is untested. | Appwrite Auth and table/row permissions are available; row permissions require Row Security to be enabled. Actual user/server SDK boundaries and cross-owner behavior must be tested. | Firebase Auth plus Firestore Security Rules supports client authorization. Admin/server libraries use IAM, so those paths need separate least-privilege tests. |
| Conflict preservation | **Application-owned.** Use optimistic revision checks and retain base/local/remote snapshots; Postgres alone does not define KitchAI's review policy. | **Application-owned.** Appwrite's guide says push/pull conflicts need a chosen strategy, such as last-write-wins or manual user resolution. RxDB exposes assumed master state and client conflict handling; it does not supply KitchAI's review/audit workflow. | **Mismatch by default.** Firestore documents last-write-wins for multiple changes to one document. A separate version/snapshot workflow is required to meet D-006. |
| Migrations and export | PostgreSQL tools/CLI support logical dumps and portable SQL data. Free projects lack automatic backups; Supabase recommends regular CLI `db dump` exports and off-site copies. Auth/configuration and extensions still need a migration plan. | CSV export is documented for Cloud and self-hosted. Managed database backups are documented for Cloud Pro and Enterprise; do not assume Free backup coverage. CSV is not a full application migration plan. | Managed export/import supports Firestore data and collection groups, using Cloud Storage. This review did not establish automated-backup coverage or included restore pricing; it is not a relational schema migration. Verify operation/storage charges and restore procedure before relying on it. |
| Testing | Local Supabase/Postgres development and database-level RLS tests can exercise the actual policy boundary before production. No provider test has been run. | Test a self-hosted/local deployment or approved non-production Cloud environment, plus the RxDB adapter. Self-hosting shifts security and operations to KitchAI. | Firebase Emulator Suite can exercise local Auth/Firestore rules; still validate deployed IAM and production-equivalent configuration before release. |
| Operational burden | **Moderate-low managed;** explicit client sync and PostgreSQL policy/migration ownership remain. | **Moderate** on Cloud, higher self-hosted; adds RxDB integration/versioning and deployment choices. | **Low managed** for basic sync; higher data-model and conflict-layer cost for KitchAI's requirements. |
| Cost limits and pause/recovery | **Verified Free snapshot:** $0; 50,000 MAU, 500 MB database, 5 GB egress, 5 GB cached egress, 1 GB file storage, and at most 2 active projects. Free projects pause after one week of inactivity. Free has no automated backups; Pro/Team/Enterprise have daily backups with plan-dependent retention. Recheck pricing and workload headroom. | **Verified:** Free accounts have one organization and 2 projects; Free resources are shared across projects and reset each billing period. At limits, functions/realtime/storage actions can stop; bandwidth exhaustion can deny API access; migration imports can be disabled while exports remain available. Current official pages checked here do **not** verify the earlier numeric quota bundle or a one-week pause rule; capture the live plan table/terms before selection. Cloud automated backups are Pro/Enterprise, not Free. | **Verified Spark snapshot:** no-cost Firestore allowance includes 1 GiB stored data, 10 GiB/month egress, 50K reads/day, 20K writes/day, and 20K deletes/day. Spark requires no payment method; Blaze is pay-as-you-go. This review did not verify inactivity-pause behavior or automated-backup coverage. Budget alerts are not a hard spending cap. No KitchAI-specific cost estimate has been made. |

### Recommendation (not an owner decision)

**Technical lead: Supabase/PostgreSQL with an explicit local-first layer.** It aligns with the relational roadmap, keeps the conflict policy in KitchAI's control, and provides a database-level RLS boundary that can be tested directly. The spike supports direct IndexedDB as a sufficient first local-storage experiment, not as a final scale or replication decision. Keep local persistence behind a replaceable repository/adapter boundary and evaluate RxDB only if its tested migration/replication benefits outweigh the dependency and policy complexity.

**Active alternative: Appwrite Cloud + RxDB.** Its official offline guide describes the right broad push/pull shape and leaves conflict resolution to the application. It may reduce sync plumbing, but only a KitchAI-specific spike can show that local/server snapshots, permissions, migrations, and recovery meet requirements. The checked Free-plan pages do not state whether projects pause; exact resource ceilings also need verification from current plan terms before selection.

**Firebase remains a comparison option, not the lead.** Managed Auth and offline cache are attractive, but Firestore's same-document last-write-wins and web persistence defaults require explicit additional design and shared-device testing.

This recommendation is not provider approval. O-001 remains open; no cloud project, billing, credentials, provider SDK, or production code was created as part of this review.

### Proposed minimum Business Profile (not final)

```ts
type BusinessProfile = {
  id: string;          // stable UUID generated once
  ownerId: string;     // authenticated owner scope; server derives/validates it
  businessId: string;  // stable business scope, even for the one-business MVP
  name: string;        // required, trimmed, 1-80 characters
  createdAt: string;   // UTC timestamp; immutable after creation
  updatedAt: string;   // UTC timestamp; updated with each accepted edit
  revision: number;    // monotonic optimistic-concurrency token
};
```

Validation proposal: reject missing/invalid IDs and scope; accept only a trimmed, non-empty name up to 80 characters; generate IDs once and never repurpose them; set timestamps in UTC; make `createdAt` immutable. `ownerId` is a server-authoritative identity value, never trusted from an offline client's write. Keep local sync state, outbox operation IDs, attempt counts, and sync errors outside this domain record; `revision` is justified because the server needs a compare-and-swap conflict check. O-002 remains open for owner review of names, bounds, and scope representation.

### Conflict-review workflow (required proposal)

1. Each edit records its base revision/snapshot and immutable local candidate. The remote accepts only when the supplied base revision matches current state; otherwise it returns the remote candidate without overwriting either side.
2. Persist base, local, and remote snapshots as an unresolved conflict. Show the three versions and changed fields together in the review UI; never apply last-write-wins or auto-merge a conflicting field.
3. Require an authenticated user to explicitly choose local or remote (field-level merge can be a later owner-approved feature). Preserve the snapshots, choice, actor, timestamp, and source operation as an append-only resolution/audit record.
4. A local choice creates a new operation based on the current remote revision. A remote choice updates the local working copy only after recording the resolution. Failed resolution leaves the conflict recoverable.

### Security, lifecycle, migration, and operations assumptions

- **Offline-data threat model:** browser storage is available to the signed-in browser profile and is not treated as encrypted or protected from XSS, extensions, malware, device access, or browser-profile access. The spike uses synthetic data only. Local persistence is not a backup.
- **Sign-out questions (O-004):** decide whether to lock, encrypt, retain, or purge local data; how to protect unsynced changes; how account switching partitions local stores; and what sign-out means on a shared device. Do not discard an unsynced outbox silently.
- **Migrations/export:** version local schema; make migrations transactional and test upgrades with pending outbox/conflict snapshots present. Define a user-readable export and restore path separate from provider backups. Test actual dump/export and restore before storing real data.
- **Deployment (O-005):** proposal only: deploy the PWA on an HTTPS origin; keep development/test/production isolated; run versioned database migrations; use a local emulator or isolated non-production provider project for security tests; store credentials only in an approved secret manager. Provider, region, domain, and hosting remain owner choices.
- **No-unapproved-spend:** create no project, attach no payment method, enable no billing, or buy a domain/service without explicit owner approval. Before any approved experiment, record provider/plan/region, quota and pause behavior, an owner-approved monthly cap, alerts and any actual hard limit, and a shutdown/cleanup procedure. Alerts alone are not a hard cap.

### Remaining WP1.1 gate

Keep WP1.1 **In progress** and do not start WP1.2 until O-001 and material product/security/cost decisions are recorded; the owner accepts the proposed slice and offline/sign-out/conflict expectations; deployment and spend boundaries are approved; and the provider-specific authorization plan is ready. The fake-owner check in the spike is simulation only and proves no provider authorization.

Before provider-specific authorization tests begin, require all of the following evidence:
1. Owner-recorded provider, hosting/deployment model, region/data-residency expectation, and explicit plan/billing/spend approval (or written no-billing local-emulator scope).
2. Approved non-production test environment and written confirmation it contains no production or customer data; credentials provisioned through an approved secret store, not source control or client bundles.
3. Reviewed schema and server-side ownership rule (RLS/table-row permission/security rule/IAM as applicable), with a threat boundary showing which server SDK paths can bypass client rules.
4. Two isolated test identities and records in distinct owner/business scopes; a test matrix covering unauthenticated access, owner allow, cross-owner/business read and write denial, update/delete denial, and privileged server path.
5. Reproducible provider-native test/emulator instructions, policy/configuration version, expected results, and captured evidence that can be independently reviewed.

### Sources checked (official; checked 2026-10-11)

- Supabase pricing and Free limits: https://supabase.com/pricing
- Supabase billing, quotas, and pause behavior: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase backups and Free-plan export recommendation: https://supabase.com/docs/guides/platform/backups
- Supabase secure data/RLS and key boundary: https://supabase.com/docs/guides/database/secure-data
- Supabase RLS and database testing: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase local development: https://supabase.com/docs/guides/local-development
- Appwrite pricing: https://appwrite.io/pricing
- Appwrite Free-plan quota scope and limit behavior: https://appwrite.io/docs/advanced/billing/free
- Appwrite offline push/pull and conflict strategies: https://appwrite.io/docs/products/databases/tablesdb/offline
- Appwrite table and row permissions: https://appwrite.io/docs/products/databases/tablesdb/permissions
- Appwrite Cloud backups: https://appwrite.io/docs/products/databases/tablesdb/backups
- Appwrite CSV export: https://appwrite.io/docs/products/databases/tablesdb/csv-exports
- Appwrite self-hosting: https://appwrite.io/docs/advanced/self-hosting
- RxDB replication/conflict protocol: https://rxdb.info/replication.html
- Firebase pricing and no-cost quotas: https://firebase.google.com/pricing
- Firestore web offline persistence and same-document conflict behavior: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Firestore export/import: https://firebase.google.com/docs/firestore/manage-data/export-import
- Firestore client Security Rules and server IAM boundary: https://firebase.google.com/docs/firestore/security/overview
- Firestore Emulator Suite: https://firebase.google.com/docs/emulator-suite/connect_firestore?hl=en
- Firestore Security Rules unit testing: https://firebase.google.com/docs/rules/unit-tests?hl=en
- Google Cloud budget alerts (notifications, not a spending cap): https://cloud.google.com/billing/docs/how-to/budgets
