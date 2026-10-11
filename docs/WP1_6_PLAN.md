# WP1.6 Plan — Business Profile Vertical Slice

**Status:** Implementation planning baseline; no application changes in this document are approved for hosted deployment.  
**Dependencies:** WP1.3 local persistence, WP1.4 local Supabase Auth/Postgres/RLS gate, WP1.5 durable queue/retry/conflict mechanics.  
**Environment boundary:** local Supabase CLI/emulator and browser automation only. No hosted project, credentials, billing, domain, or deployment.

## Objective

Connect one Business Profile through the existing web/PWA UI, owner-scoped local IndexedDB workspace, Supabase authentication, database authorization, and WP1.5 sync state machine. The slice must remain useful offline and must never claim a local draft is cloud-synced without a successful authoritative response.

## Implementation boundaries

- Keep the existing anonymous local draft separate from authenticated owner-partitioned profiles. Never upload an anonymous draft automatically when someone signs in; provide an explicit import/adopt action or leave it local.
- Use Supabase Auth and Postgres/RLS from the local Supabase stack in tests. The client never receives a service-role key and never sends `owner_id` as an authorization assertion.
- Keep public local-stack configuration out of committed secrets. The local API URL and public anon key are runtime configuration; no hosted URL or production key is to be committed.
- Keep auth/session handling minimal: sign up, sign in, sign out, expired-session handling, and pause sync when there is no valid session. Full account-management UX is out of scope.
- Reuse the WP1.5 durable queue. Do not add a second queue or silently replace operation IDs on retries.
- Enforce revision preconditions in Postgres. A stale update must return a reviewable conflict with base/local/remote snapshots, not overwrite remote data.
- Make remote operation replay idempotent at the database boundary. A stable client operation ID alone is not sufficient unless the server persists and returns the original operation outcome.
- No delete support in this slice; the schema currently intentionally grants no delete permission.

## Proposed request path

1. The owner signs in against the local Supabase Auth endpoint.
2. The UI saves an edit to the owner-partitioned IndexedDB profile and outbox atomically, displaying **Saved on this device · waiting to sync**.
3. The sync engine sends the stable operation ID and base revision using the current access token. The server derives owner scope from `auth.uid()`.
4. A database function applies a create/update atomically, checks the base revision, and stores the operation result keyed by owner + operation ID. Replaying the same operation ID returns the same outcome.
5. The client acknowledges the operation only after receiving the authoritative profile/revision. Transient errors remain retryable; auth errors pause; permanent validation/authorization errors stop retry loops; revision mismatches preserve conflict snapshots.
6. Keep local enqueues a new operation based on the latest remote revision. Use remote applies the remote snapshot locally. Both preserve the original conflict and resolution history.

## Required verification

- Local Supabase stack starts in CI, applies all migrations, and passes pgTAP checks for operation idempotency, revision conflict, ownership, and unauthorized access.
- Browser tests exercise sign-up/sign-in/sign-out against the local stack, owner-scoped local persistence, create/update round-trip, offline queueing, reconnection retry, lost acknowledgement replay, auth expiry/pause, and conflict resolution.
- An owner cannot read or mutate another owner's record even if the client tampers with IDs or owner fields.
- Replaying an operation ID cannot increment revision twice or create duplicate logical records.
- Local changes and outbox survive reload; failed persistence does not report success; sign-out preserves unsynced data but stops sync and locks the prior owner's workspace.
- Existing 15 Node tests, 14 WP1.1 spike tests, 6 app-shell Chromium tests, typecheck, build, dependency audit, and WP1.4 local authorization tests remain green.
- Record any scenarios not supported by the local Supabase stack as blocked; do not substitute fake-remote tests for provider authorization evidence.

## Explicitly not authorized

Hosted Supabase project provisioning, paid plan/billing activation, production credentials, domain purchase, public deployment, and hosted security testing remain outside WP1.6 unless separately approved.
