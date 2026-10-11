# Decision Log

This log distinguishes accepted planning constraints from proposals and unresolved owner decisions. Update it when a material decision is made; do not treat a draft recommendation as approval. The consolidated Phase 1 review is in [OWNER_REVIEW_BRIEF.md](./OWNER_REVIEW_BRIEF.md); it contains recommendations, not approvals.

## Accepted planning constraints

| ID | Decision / constraint | Status |
|---|---|---|
| D-001 | Target an offline-first web application/PWA. | Accepted planning direction |
| D-002 | Phase 1 must establish local–cloud sync and deliver one working end-to-end vertical slice. | Accepted planning direction |
| D-003 | Initial business model is one owner and one business, while avoiding architecture that blocks later SaaS expansion. | Accepted planning direction |
| D-004 | Phase 1 includes the minimum identity, authentication, ownership, and authorization foundation required for secure sync. | Accepted planning direction |
| D-005 | Full user-facing account-management features are deferred beyond Phase 1. | Accepted planning direction |
| D-006 | Detect and preserve conflicting edits for review; do not silently discard a competing version. | Accepted planning direction |
| D-007 | Compare cloud/backend architecture options before choosing a provider. | Required process |
| D-008 | Do not incur material paid-service costs without explicit owner approval. | Required constraint |
| D-009 | The MVP direction is Core + Basic AI; AI implementation follows dependable core data/workflows. | Accepted planning direction |

## Open owner decisions

| ID | Decision needed | Why it matters | Current status |
|---|---|---|---|
| O-001 | Cloud backend/auth/database provider and hosting model | Determines security policies, sync approach, operating cost, vendor lock-in, and deployment. | Open; technical lead recommends Supabase/PostgreSQL + explicit local-first sync; Appwrite + RxDB remains active alternative. Official-doc review is in ARCHITECTURE_OPTIONS.md; this is not owner approval. |
| O-002 | Exact first vertical-slice fields and validation rules | Defines schema, ownership boundary, migration and acceptance tests. | Proposed minimal Business Profile and validation are recorded in ARCHITECTURE_OPTIONS.md; owner acceptance remains open. |
| O-003 | Conflict review UX and resolution policy | Determines how users compare and choose between competing versions. | Preserve base/local/remote snapshots and require explicit resolution; review UI, audit retention, and exact choices remain open for owner review. |
| O-004 | Offline data protection expectations on shared devices | Affects local data exposure, sign-out behavior, and device threat assumptions. | Browser-storage threat assumptions and sign-out questions are documented in ARCHITECTURE_OPTIONS.md; retention, encryption/locking, and account-switch behavior remain open. |
| O-005 | Deployment and domain approach | Affects PWA installability, authentication redirects, secure transport, and cost. | HTTPS and separated environments are proposed; provider, region, domain, budget cap, and deployment approval remain open. Do not provision or purchase. |
| O-006 | First AI feature and provider/cost limits | Needed before Phase 6 implementation, not a Phase 1 blocker. | Deferred |

## Owner decision brief (WP1.1)

**Recommended option (pending O-001):** Supabase/PostgreSQL with a separate explicit local-first layer. It best fits the relational roadmap and leaves revision checks, outbox semantics, and conflict preservation under KitchAI's control. Appwrite Cloud + RxDB remains the alternative if a KitchAI-specific replication test demonstrates less complexity without losing conflict snapshots or ownership guarantees. Firebase remains a comparator; Firestore's documented same-document last-write-wins needs an additional conflict layer. This recommendation is not provider approval or permission to provision.

**Trade-offs:** Supabase requires KitchAI to own/test the local queue, retries, idempotency, migrations, and conflict UI; Free projects pause after a week of inactivity and have no automatic backups. Appwrite offers documented push/pull and RxDB integration, but this review could not verify exact Free quotas or whether projects pause; conflict policy is application-owned. Firebase reduces basic sync work but web persistence is opt-in, cache can persist across sessions, and default conflict behavior does not meet the preserve-both requirement.

**Material owner decisions still needed:** provider and hosting/region; monthly spend cap and billing permission; Business Profile fields and name rules; conflict-review UX and resolution/audit retention; local-data protection and sign-out/account-switch behavior; deployment/domain and backup/export expectations.

**Evidence required before provider authorization tests:** (1) record provider/plan/region and owner cost approval or explicitly constrain tests to a no-billing local emulator; (2) approve an isolated non-production environment with no real data and secret-manager handling; (3) review the final schema and provider-native server-side ownership policy, including privileged server SDK paths; (4) create separate test owners/business scopes and document unauthenticated, allowed-owner, cross-owner read/write, and delete-denial cases; (5) record reproducible emulator/provider test instructions and reviewable results. The fake-owner spike test is simulation only and is not evidence for this gate.

## Decision process

1. Record constraints and compare realistic options using explicit criteria.
2. Distinguish reversible implementation choices from material product/security/cost choices.
3. Make recommendations with trade-offs; ask the owner only for decisions that materially require their input.
4. Record the selected option and rationale here before implementing a vendor-dependent foundation.
