# Decision Log

This log distinguishes accepted planning constraints from proposals and unresolved owner decisions. Update it when a material decision is made; do not treat a draft recommendation as approval. The consolidated Phase 1 review is in [OWNER_REVIEW_BRIEF.md](./OWNER_REVIEW_BRIEF.md).

## Accepted planning constraints

| ID | Decision / constraint | Status |
|---|---|---|
| D-001 | Target an offline-first web application/PWA. | Accepted planning direction |
| D-002 | Phase 1 must establish local–cloud sync and deliver one working end-to-end vertical slice. | Accepted planning direction |
| D-003 | Initial business model is one owner and one business, while avoiding architecture that blocks later SaaS expansion. | Accepted planning direction |
| D-004 | Phase 1 includes the minimum identity, authentication, ownership, and authorization foundation required for secure sync. | Accepted planning direction |
| D-005 | Full user-facing account-management features are deferred beyond Phase 1. | Accepted planning direction |
| D-006 | Detect and preserve conflicting edits for review; do not silently discard a competing version. | Accepted planning direction |
| D-007 | Compare cloud/backend architecture options before choosing a provider. | Required process; comparison completed before the provisional selection below |
| D-008 | Do not incur material paid-service costs without explicit owner approval. | Required constraint |
| D-009 | The MVP direction is Core + Basic AI; AI implementation follows dependable core data/workflows. | Accepted planning direction |

## Owner-approved Phase 1 planning defaults

The owner instructed the team to proceed with the recommended defaults on 2026-10-12. These approvals select planning/implementation direction only; they do not authorize cloud provisioning, paid plans, billing activation, domain purchase, or production deployment.

| ID | Approved direction | Boundary / follow-up |
|---|---|---|
| O-001 | Select Supabase + PostgreSQL as the target provider architecture, with a KitchAI-owned explicit local-first sync layer. | No project provisioning, billing activation, secrets, or hosted provider tests are authorized by this selection alone. Use local/emulator-only work until the environment and cost boundary are separately approved. |
| O-002 | First vertical slice is a minimal Business Profile: stable UUID `id`, server-authoritative `ownerId`, stable `businessId`, required trimmed `name` (1–80 characters), immutable UTC `createdAt`, UTC `updatedAt`, and server-controlled monotonic `revision`. | Validate schema and ownership constraints in implementation review; do not let clients set authoritative owner or revision fields. |
| O-003 | Preserve base/local/remote snapshots for conflicts; require an explicit user choice between “Keep local” and “Use remote”. | Record the resolution; if the remote revision changes before resolution, reopen/re-evaluate the conflict rather than silently applying a stale choice. |
| O-004 | Partition local data and pending sync work by owner. On sign-out, stop sync and lock the local workspace; preserve unsynced data rather than silently deleting it. Never submit a prior owner's queue under a different session. | Browser storage is not guaranteed encrypted. Implement safe account switching and disclose the local-data limitation; do not claim encryption unless actually implemented and tested. |
| O-005 | Start with local/emulator testing, separate environments, HTTPS for any deployed environment, and synthetic non-production data. Define spend cap, region, domain, backup/export and deployment details before any hosted deployment. | No cloud provisioning, billing, domain purchase, or production deployment is approved yet. Local storage is not a backup. |

## Deferred decision

| ID | Decision needed | Status |
|---|---|---|
| O-006 | First AI feature/provider and cost limits | Deferred until Phase 6 planning. |

## Provider and authorization test gate

Before provider-specific authorization/security tests against a hosted project, the owner must explicitly approve the test environment and any cost/billing boundary. Until then, use local/emulator-only tests and do not provision hosted infrastructure. Required evidence: (1) provider/plan/region and cost approval or a no-billing local emulator boundary; (2) isolated non-production environment with synthetic data and secret handling; (3) reviewed schema and server-side ownership policies, including privileged server SDK paths; (4) separate test owners/business scopes and documented unauthenticated, allowed-owner, cross-owner read/write, and delete-denial cases; (5) reproducible test instructions and reviewable results. The fake-owner spike test is simulation only, not provider authorization evidence.

## Proposed Phase 3 decisions — all OPEN

The candidate decisions below are recorded for owner review only. Suggestions are not approvals; do not implement assumptions for unresolved material decisions.

| ID | Decision needed | Suggested direction for review | Status |
|---|---|---|---|
| D3-01 | Inventory costing method | Compare weighted average and FIFO before choosing; do not rely on inventory valuation in financial reports until selected | OPEN |
| D3-02 | Quantity precision and rounding | Unit-specific precision; never silently round | OPEN |
| D3-03 | Insufficient stock during production | Block or require an explicit audited override; owner decision required | OPEN |
| D3-04 | Partial receiving/cancellation | Consider partial receiving; unreceived quantity never affects stock | OPEN |
| D3-05 | Recipe theoretical use vs actual consumption | Record actual usage and variance | OPEN |
| D3-06 | Carry-over/shelf-life suitability | Operator confirms suitability under reviewed rules; app must not assume food is safe from age alone | OPEN |
| D3-07 | Discounted-sale capture in Phase 3 | Consider minimal quantity/actual-price disposition only; full sales/order/payment workflow remains Phase 4 | OPEN |
| D3-08 | Owner consumption, giveaway, and waste | Separate disposition types and reason capture | OPEN |
| D3-09 | Physical count corrections | Append-only adjustment with reason and explicit confirmation | OPEN |
| D3-10 | Supplier fields and purchase costs | Supplier optional for ad hoc purchases; decide required cost/tax/shipping fields | OPEN |
| D3-11 | Stock-movement sync conflicts | Preserve competing snapshots and require explicit review; never silently combine duplicate/conflicting movements | OPEN |

Full scope and acceptance criteria: [PHASE_3_PLAN.md](./phases/PHASE_3_PLAN.md). These are planning proposals and do not authorize implementation, hosted resources, billing, secrets, or deployment.

## Decision process

1. Record constraints and compare realistic options using explicit criteria.
2. Distinguish reversible implementation choices from material product/security/cost choices.
3. Make recommendations with trade-offs and record the owner's selected direction.
4. Implement one work package at a time, verify tests and diffs, and update status/registry with evidence.
