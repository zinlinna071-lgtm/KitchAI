# Phase 1 Plan — Application Foundation & Local–Cloud Sync

**Status:** Planning baseline; Supabase + PostgreSQL is the owner-selected target architecture. Hosted provisioning, billing, hosted security tests, region/domain, and production deployment remain unauthorized until separately approved.  
**Roadmap:** [ROADMAP.md](./ROADMAP.md)  
**Target:** One owner, one business, offline-first web/PWA, with one simple business-record vertical slice.

## 1. Objective

Prove that KitchAI can safely create and read a simple business record locally, continue working offline, and synchronize changes with a cloud backend when connectivity returns. The server must authenticate the caller and enforce record/business ownership. Conflicting edits must be detected and preserved for review rather than silently overwritten.

## 2. Phase 1 boundaries

### Included
- Architecture and cloud-provider options comparison before selecting a provider.
- Minimal web/PWA application shell and accessible connection/sync status.
- Local persistent storage, validation, versioning/migration strategy, and safe error states.
- Authentication and server-side authorization/ownership foundation for sync.
- Sync metadata/state, safe retries, idempotency, and recovery from transient failures.
- Conflict detection and preservation of competing versions for review.
- One simple business record as the end-to-end vertical slice.
- Automated tests and documented acceptance/recovery checks.

### Deferred
- Full account-management UI, profile editing, team invitations, and advanced account recovery UX.
- Multiple business-data domains (menu, purchasing, sales, finance).
- Advanced reporting or AI features.
- Multi-role collaboration beyond the minimum authorization foundation needed to enforce ownership.
- Production-scale operational commitments or paid infrastructure without explicit owner approval.

## 3. Suggested vertical slice

Use the owner-approved minimal **Business Profile** record: stable UUID `id`, server-authoritative `ownerId`, stable `businessId`, required trimmed `name` (1–80 characters), immutable UTC `createdAt`, UTC `updatedAt`, and server-controlled monotonic `revision`. Keep sync bookkeeping separate from the domain record. The approved contract is in [LOCAL_SYNC_CONTRACT.md](./LOCAL_SYNC_CONTRACT.md).

Acceptance flow:
1. An authenticated owner creates or edits the profile while online.
2. The profile is persisted locally and remains readable after reload.
3. The app can read and edit the local profile with the network unavailable.
4. When connectivity returns, pending changes are safely retried and reach the cloud.
5. A second authorized session/device can receive the cloud state if that capability is included in the chosen architecture.
6. An unauthorized user cannot read or change another owner's record.
7. Simulated competing edits are detected and both versions are preserved for review.
8. Tests demonstrate retries do not duplicate logical writes and failed sync does not erase local data.

## 4. Work packages and dependencies

| WP | Name | Depends on | Exit evidence |
|---|---|---|---|
| WP1.1 | Requirements, architecture comparison, and decision record | None | Options comparison, data/threat assumptions, chosen stack only after owner decision where material, acceptance criteria |
| WP1.2 | Application shell and PWA baseline | WP1.1 | App starts, basic navigation/layout, install/offline capability baseline, automated checks |
| WP1.3 | Local persistence and data integrity | WP1.1, WP1.2 | Local create/read/update survives reload; validation and migration approach tested |
| WP1.4 | Cloud identity, persistence, and authorization foundation | WP1.1, WP1.2 | Authenticated requests; server-side ownership enforcement; positive and negative tests |
| WP1.5 | Sync state machine, retries, and conflict preservation | WP1.3, WP1.4 | Pending/synced/failed/conflict states, safe retries, preserved conflicts, tests |
| WP1.6 | Business Profile vertical slice | WP1.3, WP1.4, WP1.5 | End-to-end local-first record workflow with ownership and sync behavior |
| WP1.7 | Integration, recovery, security, and acceptance testing | WP1.2–WP1.6 | Documented test evidence, recovery checks, known limitations, phase exit review |

**WP1.1 exit review (2026-10-12):** The requirements/architecture and isolated local-sync evidence gate is met. GitHub Actions run [38175356346](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38175356346) passed 14 Chromium tests plus dependency checks. This does not implement production sync or validate real provider authorization; those remain in later WPs and are gated on explicit hosted-environment/cost approval. See [STATUS.md](./STATUS.md), [WP_REGISTRY.md](./WP_REGISTRY.md), and the [spike report](../.spikes/wp1-1-local-sync/REPORT.md).

## 5. Cross-cutting implementation rules

- Inspect the current repository and existing conventions before adding dependencies or generating scaffolding.
- Prefer typed, validated boundaries and small modules with clear responsibilities.
- Do not put service-role keys, database credentials, or privileged secrets in client code.
- Enforce authorization on the server/database policy layer; client filtering alone is insufficient.
- Keep local data when cloud operations fail. Make failure visible and retryable.
- Use idempotent operations and explicit versioning/metadata where needed to avoid duplicate writes and lost updates.
- Do not use last-write-wins as a silent universal conflict policy.
- Keep schema changes versioned and provide a migration strategy before relying on persistent user data.
- Record the selected stack and reasons in the decision log. The selected target architecture does not authorize provisioning, billing, or hosted deployment; confirm current costs/limits and explicit spend boundary before any hosted use.
- Do not enable paid services or incur material costs without the owner's explicit approval.

## 6. Required tests

- Unit tests for validation, sync-state transitions, retry eligibility, and conflict classification.
- Persistence tests for create/read/update and reload durability.
- Integration tests for successful sync, transient failure, retry, idempotency, and offline-to-online recovery.
- Authorization tests for unauthenticated requests and cross-owner access attempts.
- Conflict tests that prove both competing versions remain recoverable.
- Build, lint, type-check, and relevant automated tests in CI where supported.
- Manual smoke test on a mobile-sized viewport and a desktop viewport.

## 7. Phase exit gate

Phase 1 is complete only when:
- the agreed vertical slice works locally and after sync;
- offline use and reconnection are verified;
- authentication and server-side ownership checks pass;
- retry and conflict behavior preserve user data;
- required automated checks pass and evidence is recorded;
- remaining limitations and chosen architecture are documented;
- no unresolved critical security or data-loss issue remains.

A green build alone is not sufficient evidence of completion.
