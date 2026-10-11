# Phase 1 Architecture Options — Initial Comparison

**Status:** Initial desk comparison; not a final vendor selection. Re-check current product limits and pricing before creating any service.  
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

## Initial assessment

A provisional shortlist is **Option A (Supabase/Postgres with an explicit local-first sync layer)** and **Option C (Appwrite with an RxDB-based local-first layer)**, with Firebase retained as a comparison point. This is a recommendation for further validation, not authorization to create a project, enable billing, or hard-code a provider into application code.

Supabase's official documentation describes a full Postgres database and recommends Row Level Security for exposed tables; its service-role/secret keys must never be exposed in frontend code. Firebase's documentation describes web offline persistence as disabled by default and states that multiple changes to the same document use last-write-wins. Appwrite documents an offline-sync approach using local storage and push/pull replication, including conflict handling as an application design concern.

## Validation checklist before selection

- [ ] Confirm current free-tier limits, billing triggers, and region availability for shortlisted services.
- [ ] Confirm authentication providers and account recovery options appropriate to the initial release.
- [ ] Prototype one record with local create/update, offline restart, reconnect, retry, and conflict preservation.
- [ ] Prove server-side ownership isolation with allow and deny tests.
- [ ] Confirm migration/export path and backup/restore implications.
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

Checked the current official product documentation and pricing pages on 2026-10-11. Limits and prices can change, so re-check them before provisioning or launch.

### Current free-tier snapshot

| Service | Current published free-tier indicators | Practical implication |
|---|---|---|
| Supabase | 2 active free projects; 500 MB database per project; 5 GB egress; 1 GB file storage; 50,000 monthly active users; free projects may pause after one week of inactivity. | Suitable for a small prototype, but pause behavior and lack of automatic backups on Free must be planned for. Quotas apply at organization level for several usage categories. |
| Appwrite Cloud | 2 projects on Free; 5 GB bandwidth; 2 GB storage; 750K function executions; 75K monthly active users; 1 database, 1 bucket, and 2 functions per project; projects may pause after one week of inactivity. | Also viable for a prototype; monitor database read/write quotas and Realtime usage, and verify how the current pricing page applies database compute credits/overages. |
| Firebase Firestore | Web offline persistence can be enabled; multiple edits to the same document resolve with last-write-wins. | Easy offline cache behavior, but this default conflict behavior does not satisfy KitchAI's requirement unless a separate version/conflict model is built. |

### Updated recommendation (still not a final vendor decision)

**Lead candidate: Supabase/PostgreSQL + a deliberate local-first layer (IndexedDB initially, with RxDB evaluated if its replication model proves useful).**

Reasons:
- KitchAI's future recipe, ingredient, purchase, inventory, sales, and finance data is naturally relational.
- PostgreSQL is portable and gives a clear migration path.
- Supabase Auth and Postgres Row Level Security provide a strong basis for owner/business-level authorization, provided every exposed table has correctly tested least-privilege policies.
- The app must still implement or integrate explicit offline queueing, idempotent retry, version checks, and conflict preservation; Supabase does not automatically solve the full local-first sync requirement.

**Alternative to keep active: Appwrite Cloud + RxDB.** Its official guide documents a local-first push/pull approach, but KitchAI must verify the exact replication adapter, supported operations, schema/version migration, and conflict behavior in a minimal prototype. The fact that an integration exists does not prove it meets KitchAI's preservation and review requirements.

**Firebase:** retain as a comparison reference, but do not prefer Firestore for this first slice unless a tested conflict-preservation layer is designed and the data model trade-offs are accepted.

### Decision gate before WP1.2

WP1.1 should not be marked complete until:
1. We document the local persistence choice and how browser storage failures/eviction are handled.
2. A small technical spike proves local create/update, reload durability, offline edits, reconnection, retry/idempotency, and preservation of competing versions.
3. Authorization rules prove a signed-in owner cannot read or modify another owner's record.
4. Free-tier pause behavior, quota limits, backups/export, and expected early-stage cost are understood.
5. The recommendation and any unresolved owner decision are recorded in `DECISIONS.md`.

No cloud project has been created and no paid service has been enabled as part of this review.

### Official sources checked

- Supabase billing and quotas: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase pricing: https://supabase.com/pricing
- Supabase data security / RLS: https://supabase.com/docs/guides/database/secure-data
- Supabase RLS testing guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Appwrite pricing: https://appwrite.io/pricing
- Appwrite Free plan behavior: https://appwrite.io/docs/advanced/billing/free
- Appwrite offline sync: https://appwrite.io/docs/products/databases/tablesdb/offline
- Firebase Firestore offline persistence and conflict behavior: https://firebase.google.com/docs/firestore/manage-data/enable-offline
