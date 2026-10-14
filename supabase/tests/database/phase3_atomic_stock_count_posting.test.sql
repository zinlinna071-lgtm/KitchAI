begin;
select no_plan();

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('54111111-1111-4111-8111-111111111111','authenticated','authenticated','wp35d-a@example.test','',now())
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub"='54111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id,name)
values ('b5411111-1111-4111-8111-111111111111','WP3.5d count owner')
on conflict (owner_id) do nothing;

select public.apply_phase2_entity_operation(
 'b5420000-0000-4000-8000-000000000001','ingredient',
 'b5421111-1111-4111-8111-111111111111','create',null,
 '{"name":"WP3.5d item one","description":"Atomic count test","status":"active"}'::jsonb
);
select public.apply_phase2_entity_operation(
 'b5420000-0000-4000-8000-000000000002','ingredient',
 'b5422222-2222-4222-8222-222222222222','create',null,
 '{"name":"WP3.5d item two","description":"Atomic count test","status":"active"}'::jsonb
);

select ok(has_function_privilege('authenticated','public.post_stock_count_subset(uuid,uuid,uuid,jsonb,boolean)','execute'),
 'authenticated owner can post a reviewed count subset');
select ok(not has_function_privilege('anon','public.post_stock_count_subset(uuid,uuid,uuid,jsonb,boolean)','execute'),
 'anonymous caller cannot post count adjustments');
select ok(not has_table_privilege('authenticated','public.stock_count_line_postings','select'),
 'clients cannot mutate or directly read trusted count audit rows');

select is(
 public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000001',
  '[{"lineId":"b5450000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b5421111-1111-4111-8111-111111111111","expectedVersion":"0","countedQuantity":"5","unit":"g","reason":"opening physical count","varianceEventId":"b5460000-0000-4000-8000-000000000001","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 ) ->> 'status',
 'accepted',
 'non-zero reviewed count posts through the atomic RPC'
);
select is(
 (select count(*)::integer from public.stock_movements
  where owner_id='54111111-1111-4111-8111-111111111111'
    and event_id='b5460000-0000-4000-8000-000000000001'),
  1,
 'count variance creates one append-only stock movement'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'ingredient','b5421111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '1',
 'count adjustment advances the shared item version once'
);
select is(
 (select variance::text from public.stock_count_line_postings
  where owner_id='54111111-1111-4111-8111-111111111111'
    and session_id='b5440000-0000-4000-8000-000000000001'
    and line_id='b5450000-0000-4000-8000-000000000001'),
 '5.000000',
 'server records variance derived from the canonical ledger, not client-supplied system quantity'
);

select is(
 public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000001',
  '[{"lineId":"b5450000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b5421111-1111-4111-8111-111111111111","expectedVersion":"0","countedQuantity":"5","unit":"g","reason":"opening physical count","varianceEventId":"b5460000-0000-4000-8000-000000000001","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 ) ->> 'status',
 'accepted',
 'identical retry returns accepted result before stale-version validation'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'ingredient','b5421111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '1',
 'idempotent retry does not post a second movement'
);

select throws_ok(
 $sql$select public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000002',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000002',
  '[{"lineId":"b5450000-0000-4000-8000-000000000002","stockClass":"ingredient","stockItemId":"b5421111-1111-4111-8111-111111111111","expectedVersion":"0","countedQuantity":"6","unit":"g","reason":"stale recount","varianceEventId":"b5460000-0000-4000-8000-000000000002","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 )$sql$,
 '40001',
 'Stock count is stale for item b5421111-1111-4111-8111-111111111111: expected version 0, current version 1. Refresh the snapshot and recount/review this line.',
 'stale snapshot is rejected and requires recount/review'
);

select is(
 public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000003',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000003',
  '[{"lineId":"b5450000-0000-4000-8000-000000000003","stockClass":"ingredient","stockItemId":"b5422222-2222-4222-8222-222222222222","expectedVersion":"0","countedQuantity":"0","unit":"g","reason":"","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 ) ->> 'zeroVarianceCount',
 '1',
 'zero-variance line is audited without a stock movement'
);
select is(
 (select count(*)::integer from public.stock_movements
  where owner_id='54111111-1111-4111-8111-111111111111'
    and source_type='stock_count' and source_id='b5440000-0000-4000-8000-000000000003'),
  0,
 'zero-variance audit creates no zero-quantity ledger movement'
);
select is(
 (select variance::text from public.stock_count_line_postings
  where owner_id='54111111-1111-4111-8111-111111111111'
    and session_id='b5440000-0000-4000-8000-000000000003'),
 '0.000000',
 'zero variance is retained in the immutable count audit'
);

select throws_ok(
 $sql$select public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000004',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000004',
  '[{"lineId":"b5450000-0000-4000-8000-000000000004","stockClass":"ingredient","stockItemId":"b5422222-2222-4222-8222-222222222222","expectedVersion":"0","countedQuantity":"1","unit":"g","reason":"should roll back","varianceEventId":"b5460000-0000-4000-8000-000000000004","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"},{"lineId":"b5450000-0000-4000-8000-000000000005","stockClass":"ingredient","stockItemId":"b5421111-1111-4111-8111-111111111111","expectedVersion":"0","countedQuantity":"6","unit":"g","reason":"stale second line","varianceEventId":"b5460000-0000-4000-8000-000000000005","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 )$sql$,
 '40001',
 'Stock count is stale for item b5421111-1111-4111-8111-111111111111: expected version 0, current version 1. Refresh the snapshot and recount/review this line.',
 'a stale line rejects the entire submitted subset atomically'
);
select is(
 (select count(*)::integer from public.stock_count_line_postings
  where owner_id='54111111-1111-4111-8111-111111111111'
    and session_id='b5440000-0000-4000-8000-000000000004'),
  0,
 'atomic subset failure leaves no earlier line audit behind'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'ingredient','b5422222-2222-4222-8222-222222222222'
 ) ->> 'version',
 '0',
 'atomic subset failure leaves stock versions unchanged'
);

select is(
 public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000005',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000003',
  '[{"lineId":"b5450000-0000-4000-8000-000000000006","stockClass":"ingredient","stockItemId":"b5421111-1111-4111-8111-111111111111","expectedVersion":"1","countedQuantity":"5","unit":"g","reason":"","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb,
  true
 ) ->> 'sessionStatus',
 'completed',
 'final reviewed subset can complete a partial session'
);
select throws_ok(
 $sql$select public.post_stock_count_subset(
  'b5430000-0000-4000-8000-000000000006',
  (select business_id from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'),
  'b5440000-0000-4000-8000-000000000003',
  '[{"lineId":"b5450000-0000-4000-8000-000000000007","stockClass":"ingredient","stockItemId":"b5422222-2222-4222-8222-222222222222","expectedVersion":"0","countedQuantity":"0","unit":"g","reason":"","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]'::jsonb
 )$sql$,
 '55000',
 'Stock-count session is already completed',
 'completed session rejects additional distinct commands'
);

select set_config('test.wp35d_business_id',
 (select business_id::text from public.business_profiles where owner_id='54111111-1111-4111-8111-111111111111'), true);
reset role;
select * from finish();
rollback;
