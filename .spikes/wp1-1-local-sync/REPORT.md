# WP1.1 Local Sync Spike Report

**Date:** 2026-10-12
**Status:** Fourteen isolated Chromium tests and CI dependency checks passed on GitHub Actions run [38175356346](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38175356346). WP1.1's local/emulator evidence gate is met; production authentication and provider-side authorization remain deferred until a non-production environment and cost boundary are explicitly approved.
**Scope:** Disposable browser prototype only. No production app, cloud service, provider SDK, credentials, billing, or real business data.

## Environment and commands

- Ubuntu 24.04.5 LTS, Node.js v24.21.0, npm 11.19.0.
- Chromium 153.0.0 bundled by `@sparticuz/chromium`; Playwright Test 1.64.0.
- From the repository root, the repeatable setup and checks are:

```sh
cd .spikes/wp1-1-local-sync
npm ci
npm test
npm audit
npm ls --depth=0
```

- `npm ci`: passed; installed the lockfile dependencies, 0 vulnerabilities.
- `npm test`: passed, 14 tests in Chromium on GitHub Actions run [38175356346](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38175356346). This serves the page locally and uses the browser's native IndexedDB; reload tests reload the page in the same browser context.
- `npm audit --audit-level=low`: passed, 0 vulnerabilities in the CI run.
- `npm ls --depth=0`: passed in CI; only `@playwright/test@1.64.0` and `@sparticuz/chromium@153.0.0` are direct development dependencies of this private spike.
- `git diff --check` from the repository root: passed; no whitespace errors.
- No application build, lint, or type-check command exists in this repository.

The first `npx playwright install chromium` downloaded Chromium, but it could not launch because the container lacks system libraries including `libatk-1.0.so.0`. No privileged/system package installation was performed. The test harness instead uses the spike-local bundled Chromium package; the successful test results above are from that actual browser, not an IndexedDB mock.

## Files and dependencies

All added files are under this disposable directory. The prototype consists of a native IndexedDB repository, a deterministic in-memory fake remote, a small status page, a local static test server, Playwright configuration, browser tests, and a private npm manifest/lockfile. `node_modules`, test results, and reports are ignored locally. No root package manifest or production dependency graph was created or changed.

## Results

| Behavior | Result |
|---|---|
| Create a validated profile in native IndexedDB and read it after page reload | Pass |
| Trim valid names; reject blank names without changing the stored profile | Pass |
| Edit offline; retain local readability, pending outbox state, and visible pending count | Pass |
| Retry a transient failure; replay the stable operation ID without a duplicate logical remote write | Pass |
| Bound retries at three attempts and retain the local profile after failure | Pass |
| Detect a stale revision and retain base, local, and remote candidates; resolution is explicit and snapshots remain | Pass |
| Reject a mismatched fake owner ID | Pass, **simulation only** |
| Pending outbox operation survives page reload with the same operation ID and can sync afterward | Pass; one browser context, simulated remote |
| Explicit remote-candidate conflict resolution preserves original snapshots and marks the original operation as conflict | Pass; fake remote only |
| Owner-partitioned local profile/outbox/conflict keys; same profile ID can exist under two owners | Pass; local spike only |
| Sign-out locks the workspace, preserves unsynced data, and blocks sync under the next owner | Pass; in-memory session test seam, not real auth |
| Injected IndexedDB write failure does not leave a partial profile/outbox write | Pass; simulated pre-transaction failure, not a real browser quota test |
| Remote accepts a write but the acknowledgement is lost; retry reuses the operation ID without a duplicate logical write | Pass; fake remote only |
| Export/restore carries profile and pending queue into a fresh browser context and rejects cross-owner backup | Pass; same-owner restore into a fresh workspace |
| Two owners sync the same profile ID without remote record collision | Pass; fake remote only |

The fake remote stores no state across page reloads and provides deterministic transient failures, idempotency receipts, owner mismatch rejection, competing revisions, and write counts. The outbox records pending, synced, failed, and conflict states. Conflicts are kept in IndexedDB with their base and both candidates; choosing the local candidate explicitly creates a new operation based on the remote revision.

## Limitations and untested behavior

- The fake-owner check is **simulation only**. It proves no authentication, server authorization, tenant isolation, database policy, or provider security property.
- No cloud service, provider-specific integration, real credentials, network replication, multi-device behavior, or provider authorization tests were used.
- The fake remote is in-memory and deterministic, not a server or durable remote database. The prototype does not test real reconnection, request ordering across tabs, concurrent writers, or server-side idempotency constraints.
- Owner partitioning and the session switch are local test seams only. They do not provide real authentication or prove server-side authorization. Sign-out locks the spike's application API but does not encrypt browser storage; browser data may remain inspectable on the device.
- The storage failure case is an injected failure before a write transaction starts; real quota exhaustion, storage eviction, corrupt data, migration failure, and browser restart remain untested.
- Export/restore is tested into a fresh browser context for the same owner and rejects a different-owner backup; it is not a production backup service or a tested restore-over-existing-data workflow.
- The local- and remote-candidate resolution branches are tested at the storage/function level; a conflict-review UI is not. The status page is a spike fixture, not an application shell or PWA.
- The schema and validation are intentionally minimal test fixtures; no personal, financial, address, or customer data is present.

## IndexedDB versus RxDB

For this measured slice, direct IndexedDB was sufficient: three small stores cover profiles, outbox operations, and conflict snapshots, and the browser tests exercise reload durability and transaction-backed state changes without a database abstraction dependency. It leaves migrations, retries, replication, and conflict policy owned by KitchAI. The spike provides no evidence that direct IndexedDB scales to future domains or multi-device replication.

RxDB remains worth evaluating if provider-compatible replication, richer query needs, or schema migration complexity justify its dependency and integration cost. Its replication/conflict behavior must be tested against KitchAI's requirement to preserve both candidates; the library name alone is not evidence that it does.

**Provisional boundary:** keep local profile/outbox/conflict storage behind a small repository API; treat the remote adapter as replaceable; only mark operations synced after an authenticated provider confirms them; use provider-side ownership enforcement and revision checks; retain unresolved conflict snapshots until an explicit resolution is recorded. This is spike evidence, not a production architecture decision.

## Next gates and retention

1. O-001 through O-005 are recorded as owner-approved planning defaults in `docs/DECISIONS.md`. The local spike evidence gate is met, but this does not authorize cloud provisioning, billing, secrets, hosted tests, or deployment.
2. Before WP1.4's provider-specific authorization/security tests, obtain explicit approval for the non-production environment and cost boundary. Then verify unauthenticated access, allowed-owner access, cross-owner read/write denial, server-controlled identity/revision, idempotency, conflict handling, secret boundaries, and auditability against the real server-side policy. A fake-owner test is not a substitute.
3. Before real business data is used, review migration behavior, actual browser quota/eviction failures, local-data protection expectations, and production backup/restore semantics.

Retain this isolated folder as disposable WP1.1 evidence until those gates are reviewed. It has no references from the project app and can be removed as a unit; do not move its code into production scaffolding without a separate reviewed decision. WP1.1 is not complete.
