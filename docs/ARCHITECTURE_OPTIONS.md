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
