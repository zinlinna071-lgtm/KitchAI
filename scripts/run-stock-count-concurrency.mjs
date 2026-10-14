import assert from 'node:assert/strict';
import { Client } from 'pg';

const connectionString = process.env.KITCHAI_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const ownerId = '55111111-1111-4111-8111-111111111111';
const businessProfileId = 'b5511111-1111-4111-8111-111111111111';
const itemId = 'b5521111-1111-4111-8111-111111111111';
const commandId = 'b5530000-0000-4000-8000-000000000001';
const sessionId = 'b5540000-0000-4000-8000-000000000001';
const lineId = 'b5550000-0000-4000-8000-000000000001';
const varianceEventId = 'b5590000-0000-4000-8000-000000000001';
const writerCommandId = 'b5560000-0000-4000-8000-000000000001';
const writerEventId = 'b5570000-0000-4000-8000-000000000001';
const writerSourceId = 'b5580000-0000-4000-8000-000000000001';

const admin = new Client({ connectionString });
const writer = new Client({ connectionString });
const counter = new Client({ connectionString, application_name: 'kitchai_stock_count_race_counter' });
const observer = new Client({ connectionString });
const clients = [admin, writer, counter, observer];

async function setOwnerClaim(client) {
  await client.query('SET ROLE authenticated');
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [ownerId]);
}

async function waitForAdvisoryWait() {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_catalog.pg_stat_activity
         WHERE datname = current_database()
           AND wait_event_type = 'Lock'
           AND wait_event = 'advisory'
           AND application_name = 'kitchai_stock_count_race_counter'
       ) AS waiting`
    );
    if (result.rows[0].waiting) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Concurrent count request never waited on the shared owner advisory lock');
}

try {
  for (const client of clients) await client.connect();

  await admin.query(
    `INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
     VALUES ($1, 'authenticated', 'authenticated', 'wp35d-race@example.test', '', now())
     ON CONFLICT (id) DO NOTHING`,
    [ownerId]
  );
  await setOwnerClaim(admin);
  await admin.query(
    'INSERT INTO public.business_profiles (id, name) VALUES ($1, $2) ON CONFLICT (owner_id) DO NOTHING',
    [businessProfileId, 'WP3.5d concurrency owner']
  );
  await admin.query(
    `SELECT public.apply_phase2_entity_operation(
       $1::uuid, 'ingredient', $2::uuid, 'create', NULL,
       '{"name":"WP3.5d race ingredient","description":"Two-session stale-count test","status":"active"}'::jsonb
     )`,
    ['b5520000-0000-4000-8000-000000000001', itemId]
  );
  await admin.query('RESET ROLE');

  const businessResult = await admin.query(
    'SELECT business_id FROM public.business_profiles WHERE owner_id = $1',
    [ownerId]
  );
  const businessId = businessResult.rows[0]?.business_id;
  assert.ok(businessId, 'test owner has a business');

  await writer.query('BEGIN');
  await setOwnerClaim(writer);
  await writer.query(
    'SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))',
    [ownerId]
  );

  await setOwnerClaim(counter);
  const countPromise = counter.query(
    'SELECT public.post_stock_count_subset($1::uuid, $2::uuid, $3::uuid, $4::jsonb, false) AS result',
    [commandId, businessId, sessionId, JSON.stringify([{
      lineId,
      stockClass: 'ingredient',
      stockItemId: itemId,
      expectedVersion: '0',
      countedQuantity: '2',
      varianceEventId,
      unit: 'g',
      reason: 'Verify the count after the concurrent receipt',
      countedAt: '2026-10-14T12:00:00Z',
      reviewedAt: '2026-10-14T12:01:00Z'
    }])]
  );

  await waitForAdvisoryWait();
  const movementResult = await writer.query(
    `SELECT public.apply_inventory_command(
       $1::uuid, $2::uuid, 'stock_receipt',
       jsonb_build_object('movements', jsonb_build_array(jsonb_build_object(
         'eventId', $3::text, 'stockClass', 'ingredient', 'stockItemId', $4::text,
         'kind', 'purchase_receipt', 'direction', 'in', 'quantity', '1',
         'unit', 'g', 'sourceType', 'purchase_receipt', 'sourceId', $5::text
       )))) AS result`,
    [writerCommandId, businessId, writerEventId, itemId, writerSourceId]
  );
  assert.equal(movementResult.rows[0].result.status, 'accepted');
  await writer.query('COMMIT');

  let countError;
  try {
    await countPromise;
  } catch (error) {
    countError = error;
  }
  assert.ok(countError, 'stale concurrent count must reject');
  assert.equal(countError.code, '40001', 'stale count uses serialization_failure');
  assert.match(countError.message, /Stock count is stale for item/i);

  await observer.query('SET ROLE authenticated');
  await observer.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [ownerId]);
  const snapshot = await observer.query(
    'SELECT public.get_inventory_item_snapshot($1::uuid, $2::text, $3::uuid) AS snapshot',
    [businessId, 'ingredient', itemId]
  );
  assert.equal(snapshot.rows[0].snapshot.systemQuantity, '1.000000');
  await observer.query('RESET ROLE');

  const audits = await admin.query(
    'SELECT count(*)::int AS count FROM public.stock_count_line_postings WHERE owner_id = $1 AND session_id = $2',
    [ownerId, sessionId]
  );
  assert.equal(audits.rows[0].count, 0, 'stale count leaves no accepted audit rows');

  console.log('PASS: count request waited behind the stock writer advisory lock');
  console.log('PASS: writer receipt committed and advanced item version to 1');
  console.log('PASS: stale count rejected with SQLSTATE 40001');
  console.log('PASS: stale count left no accepted count audit');
} catch (error) {
  try { await writer.query('ROLLBACK'); } catch {}
  console.error(error);
  process.exitCode = 1;
} finally {
  try { await admin.query('RESET ROLE'); } catch {}
  try { await writer.query('RESET ROLE'); } catch {}
  try { await counter.query('RESET ROLE'); } catch {}
  try { await observer.query('RESET ROLE'); } catch {}
  try {
    await admin.query('DELETE FROM auth.users WHERE id = $1', [ownerId]);
  } catch (cleanupError) {
    console.error('Cleanup warning:', cleanupError.message);
    process.exitCode = 1;
  }
  for (const client of clients) {
    try { await client.end(); } catch {}
  }
}
