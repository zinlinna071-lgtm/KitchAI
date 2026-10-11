# Decision Log

This log distinguishes accepted planning constraints from proposals and unresolved owner decisions. Update it when a material decision is made; do not treat a draft recommendation as approval.

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
| O-001 | Cloud backend/auth/database provider and hosting model | Determines security policies, sync approach, operating cost, vendor lock-in, and deployment. | Open; compare options first |
| O-002 | Exact first vertical-slice fields and validation rules | Defines schema, ownership boundary, migration and acceptance tests. | Proposed Business Profile; refine in WP1.1 |
| O-003 | Conflict review UX and resolution policy | Determines how users compare and choose between competing versions. | Preserve both versions required; detailed UX open |
| O-004 | Offline data protection expectations on shared devices | Affects local data exposure, sign-out behavior, and device threat assumptions. | Open; document threat model in WP1.1 |
| O-005 | Deployment and domain approach | Affects PWA installability, authentication redirects, secure transport, and cost. | Open; do not purchase or configure paid services yet |
| O-006 | First AI feature and provider/cost limits | Needed before Phase 6 implementation, not a Phase 1 blocker. | Deferred |

## Decision process

1. Record constraints and compare realistic options using explicit criteria.
2. Distinguish reversible implementation choices from material product/security/cost choices.
3. Make recommendations with trade-offs; ask the owner only for decisions that materially require their input.
4. Record the selected option and rationale here before implementing a vendor-dependent foundation.
