# WP1.1 Local Sync Spike Report

**Date:** 2026-10-11
**Status:** Spike checks passed; WP1.1 remains in progress.
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
- `npm test`: passed, 6 tests in Chromium. This serves the page locally and uses the browser's native IndexedDB; the reload test reloads the page in the same browser context.
- `npm audit`: passed, 0 vulnerabilities.
- `npm ls --depth=0`: passed; only `@playwright/test@1.64.0` and `@sparticuz/chromium@153.0.0` are direct development dependencies of this private spike.
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

The fake remote stores no state across page reloads and provides deterministic transient failures, idempotency receipts, owner mismatch rejection, competing revisions, and write counts. The outbox records pending, synced, failed, and conflict states. Conflicts are kept in IndexedDB with their base and both candidates; choosing the local candidate explicitly creates a new operation based on the remote revision.

## Limitations and untested behavior

- The fake-owner check is **simulation only**. It proves no authentication, server authorization, tenant isolation, database policy, or provider security property.
- No cloud service, provider-specific integration, real credentials, network replication, multi-device behavior, or provider authorization tests were used.
- The fake remote is in-memory and deterministic, not a server or durable remote database. The prototype does not test real reconnection, request ordering across tabs, concurrent writers, or server-side idempotency constraints.
- The browser persistence check covers a page reload in one browser context. Storage eviction/quota failures, browser restart, migrations, backup/restore, sign-out, and shared-device protection are untested.
- The local-candidate resolution path is tested; the remote-candidate selection branch and a conflict-review UI are not. The status page is a spike fixture, not an application shell or PWA.
- The schema and validation are intentionally minimal test fixtures; no personal, financial, address, or customer data is present.

## IndexedDB versus RxDB

For this measured slice, direct IndexedDB was sufficient: three small stores cover profiles, outbox operations, and conflict snapshots, and the browser tests exercise reload durability and transaction-backed state changes without a database abstraction dependency. It leaves migrations, retries, replication, and conflict policy owned by KitchAI. The spike provides no evidence that direct IndexedDB scales to future domains or multi-device replication.

RxDB remains worth evaluating if provider-compatible replication, richer query needs, or schema migration complexity justify its dependency and integration cost. Its replication/conflict behavior must be tested against KitchAI's requirement to preserve both candidates; the library name alone is not evidence that it does.

**Provisional boundary:** keep local profile/outbox/conflict storage behind a small repository API; treat the remote adapter as replaceable; only mark operations synced after an authenticated provider confirms them; use provider-side ownership enforcement and revision checks; retain unresolved conflict snapshots until an explicit resolution is recorded. This is spike evidence, not a production architecture decision.

## Next gates and retention

1. Resolve owner decision O-001 and record the selected provider, hosting model, cost limits, and rationale before vendor-dependent implementation.
2. For that provider, test authenticated allow and deny cases, including unauthenticated access and cross-owner reads/writes, against the actual server-side policy boundary. Verify idempotency, revision-conflict behavior, secret handling, and auditability. A fake-owner test is not a substitute.
3. Decide the first-record fields, local data protection expectations, migration strategy, and backup/export requirements.

Retain this isolated folder as disposable WP1.1 evidence until those gates are reviewed. It has no references from the project app and can be removed as a unit; do not move its code into production scaffolding without a separate reviewed decision. WP1.1 is not complete.
