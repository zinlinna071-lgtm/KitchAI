begin;
select no_plan();

-- WP3.6 synthetic server-side composition test. No hosted resources or real data.
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('68111111-1111-4111-8111-111111111111','authenticated','authenticated','wp36-flow@example.test','',now())
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub"='68111111-1111-4111-8111-111111111111';

insert into public.business_profiles (id,name)
values ('b6811111-1111-4111-8111-111111111111','WP3.6 Cross Workflow Kitchen')
on conflict (owner_id) do nothing;

select public.apply_phase2_entity_operation(
 'b6840000-0000-4000-8000-000000000001','ingredient',
 'b6821111-1111-4111-8111-111111111111','create',null,
 '{"name":"WP3.6 Rice","description":"Synthetic cross-workflow fixture","status":"active"}'::jsonb
);
select public.apply_phase2_entity_operation(
 'b6840000-0000-4000-8000-000000000002','menu_item',
 'b6831111-1111-4111-8111-111111111111','create',null,
 '{"name":"WP3.6 Rice Bowl","description":"Synthetic cross-workflow fixture","status":"active"}'::jsonb
);

-- 1. Accepted purchase receipt creates ingredient stock.
select is(
 public.apply_inventory_command(
  'b6850000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'stock_receipt',
  jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
   'eventId','b6860000-0000-4000-8000-000000000001',
   'stockClass','ingredient','stockItemId','b6821111-1111-4111-8111-111111111111',
   'kind','purchase_receipt','direction','in','quantity','10000','unit','g',
   'sourceType','purchase_receipt','sourceId','b6870000-0000-4000-8000-000000000001'
  )))
 ) ->> 'status',
 'accepted','purchase receipt is accepted');
select is(
 (select sum(case when direction='in' then quantity else -quantity end)
  from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_item_id='b6821111-1111-4111-8111-111111111111'),
  10000::numeric,'receipt creates exactly 10000 g of ingredient stock');

-- 2. Production atomically consumes 2500 g and creates one traceable 4-each lot.
select is(
 public.apply_inventory_command(
  'b6890000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'stock_movement',
  jsonb_build_object(
   'movements',jsonb_build_array(
    jsonb_build_object(
     'eventId','b68a0000-0000-4000-8000-000000000001',
     'stockClass','ingredient','stockItemId','b6821111-1111-4111-8111-111111111111',
     'kind','production_consumption','direction','out','quantity','2500','unit','g',
     'sourceType','production_batch','sourceId','b6880000-0000-4000-8000-000000000001'
    ),
    jsonb_build_object(
     'eventId','b68a0000-0000-4000-8000-000000000002',
     'stockClass','finished','stockItemId','b6831111-1111-4111-8111-111111111111',
     'kind','production_output','direction','in','quantity','4','unit','each',
     'sourceType','production_batch','sourceId','b6880000-0000-4000-8000-000000000001'
    )
   ),
   'lots',jsonb_build_array(jsonb_build_object(
    'lotId','b68b0000-0000-4000-8000-000000000001',
    'menuItemId','b6831111-1111-4111-8111-111111111111',
    'batchId','b6880000-0000-4000-8000-000000000001',
    'outputEventId','b68a0000-0000-4000-8000-000000000002',
    'producedQuantity','4','unit','each'
   )),
   'allocations','[]'::jsonb
  )
 ) ->> 'status',
 'accepted','production consumption, output, and lot are accepted atomically');
select is(
 (select sum(case when direction='in' then quantity else -quantity end)
  from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_item_id='b6821111-1111-4111-8111-111111111111'),
  7500::numeric,'production consumes exactly 2500 g');
select is(
 (select produced_quantity from public.finished_lots where lot_id='b68b0000-0000-4000-8000-000000000001'),
  4::numeric,'production creates one 4-each finished lot');

-- 3. A giveaway is a non-revenue disposition and allocates one unit to the lot.
select is(
 public.apply_inventory_command(
  'b68c0000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'stock_movement',
  jsonb_build_object(
   'movements',jsonb_build_array(jsonb_build_object(
    'eventId','b68d0000-0000-4000-8000-000000000001',
    'stockClass','finished','stockItemId','b6831111-1111-4111-8111-111111111111',
    'kind','giveaway','direction','out','quantity','1','unit','each',
    'sourceType','giveaway','sourceId','b68e0000-0000-4000-8000-000000000001',
    'reason','Safe unsold portion donated'
   )),
   'allocations',jsonb_build_array(jsonb_build_object(
    'eventId','b68d0000-0000-4000-8000-000000000001',
    'lotId','b68b0000-0000-4000-8000-000000000001',
    'quantity','1','unit','each'
   ))
  )
 ) ->> 'status',
 'accepted','giveaway disposition is accepted with lot allocation');
select is(
 (select sum(case when direction='in' then quantity else -quantity end)
  from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_class='finished'
    and stock_item_id='b6831111-1111-4111-8111-111111111111'),
  3::numeric,'finished stock balance reflects the giveaway');
select is(
 (select sum(quantity) from public.stock_movement_lot_allocations
  where event_id='b68d0000-0000-4000-8000-000000000001'
    and lot_id='b68b0000-0000-4000-8000-000000000001'),
  1::numeric,'giveaway is allocated to the produced lot');

-- 4. A physical count uses the current server version and atomically corrects
-- ingredient stock from 7500 g to the observed 7400 g.
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'ingredient','b6821111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '2','server snapshot reflects receipt and production movement versions');

select is(
 public.post_stock_count_subset(
  'b6920000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'b68f0000-0000-4000-8000-000000000001',
  '[{"lineId":"b6900000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b6821111-1111-4111-8111-111111111111","expectedVersion":"2","countedQuantity":"7400","unit":"g","reason":"Physical count confirmed 7400 g","varianceEventId":"b6910000-0000-4000-8000-000000000001","countedAt":"2026-10-15T12:00:00Z","reviewedAt":"2026-10-15T12:01:00Z"}]'::jsonb
 ) ->> 'status',
 'accepted','reviewed stock count posts against the current server version');

-- WP3.6.2 reliability: model a lost acknowledgement by replaying the exact
-- accepted count command, then prove a changed request cannot reuse its key.
select is(
 public.post_stock_count_subset(
  'b6920000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'b68f0000-0000-4000-8000-000000000001',
  '[{"lineId":"b6900000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b6821111-1111-4111-8111-111111111111","expectedVersion":"2","countedQuantity":"7400","unit":"g","reason":"Physical count confirmed 7400 g","varianceEventId":"b6910000-0000-4000-8000-000000000001","countedAt":"2026-10-15T12:00:00Z","reviewedAt":"2026-10-15T12:01:00Z"}]'::jsonb
 ) ->> 'status',
 'accepted','retry after an uncertain acknowledgement returns the original accepted result');

select throws_ok(
 $sql$select public.post_stock_count_subset(
  'b6920000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'b68f0000-0000-4000-8000-000000000001',
  '[{"lineId":"b6900000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b6821111-1111-4111-8111-111111111111","expectedVersion":"2","countedQuantity":"7300","unit":"g","reason":"Changed request must not be accepted","varianceEventId":"b6910000-0000-4000-8000-000000000001","countedAt":"2026-10-15T12:00:00Z","reviewedAt":"2026-10-15T12:01:00Z"}]'::jsonb
 )$sql$,
 '22023',
 'Count command ID reused with a different request',
 'same command key with changed count payload is rejected');

select is(
 (select sum(case when direction='in' then quantity else -quantity end)
  from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_item_id='b6821111-1111-4111-8111-111111111111'),
  7400::numeric,'final ingredient balance matches the posted physical count');
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='68111111-1111-4111-8111-111111111111'),
  'ingredient','b6821111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '3','count posting advances the ingredient version once');
select is(
 (select count(*)::integer from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_item_id='b6821111-1111-4111-8111-111111111111'),
  3,'receipt, production consumption, and count correction remain separate ledger events');
select is(
 (select count(*)::integer from public.stock_movements
  where owner_id='68111111-1111-4111-8111-111111111111'
    and stock_class='finished'
    and stock_item_id='b6831111-1111-4111-8111-111111111111'),
  2,'finished output and giveaway remain separate ledger events');

reset role;
select is(
 (select variance from public.stock_count_line_postings
  where owner_id='68111111-1111-4111-8111-111111111111'
    and session_id='b68f0000-0000-4000-8000-000000000001'
    and line_id='b6900000-0000-4000-8000-000000000001'),
 -100::numeric,'count audit records server-derived negative variance');
select is(
 (select count(*)::integer from public.stock_count_line_postings
  where owner_id='68111111-1111-4111-8111-111111111111'
    and session_id='b68f0000-0000-4000-8000-000000000001'),
 1,'count posting creates one audit row');
select is(
 (select count(*)::integer from public.stock_movement_lot_allocations
  where event_id='b68d0000-0000-4000-8000-000000000001'),
 1,'finished disposition allocation remains in immutable history');

select * from finish();
rollback;
