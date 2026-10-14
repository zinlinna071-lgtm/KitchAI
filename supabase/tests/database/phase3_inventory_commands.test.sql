begin;
select no_plan();
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('41111111-1111-4111-8111-111111111111','authenticated','authenticated','wp32-a@example.test','',now()),
       ('42222222-2222-4222-8222-222222222222','authenticated','authenticated','wp32-b@example.test','',now())
on conflict (id) do nothing;
set local role authenticated;
set local "request.jwt.claim.sub"='41111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id,name) values ('a4111111-1111-4111-8111-111111111111','WP3.2 Owner A')
on conflict (owner_id) do nothing;
select ok(has_function_privilege('authenticated','public.apply_inventory_command(uuid,uuid,text,jsonb)','execute'),'authenticated owners can call inventory RPC');
select ok(not has_function_privilege('anon','public.apply_inventory_command(uuid,uuid,text,jsonb)','execute'),'anonymous users cannot call inventory RPC');
select ok(not has_table_privilege('authenticated','public.inventory_commands','insert'),'clients cannot write idempotency ledger directly');
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000001',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_receipt',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000001','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','purchase_receipt',
 'direction','in','quantity','5.25','unit','g','sourceType','purchase_receipt',
 'sourceId','a9300000-0000-4000-8000-000000000001')))
 ) ->> 'status','accepted','valid receipt is accepted');
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000001',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_receipt',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000001','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','purchase_receipt',
 'direction','in','quantity','5.25','unit','g','sourceType','purchase_receipt',
 'sourceId','a9300000-0000-4000-8000-000000000001')))
 ) ->> 'status','accepted','replay returns original result');
select is((select count(*)::integer from public.stock_movements where event_id='a9100000-0000-4000-8000-000000000001'),1,'replay does not duplicate movement');
-- Movement array order is part of the command contract: a receipt may fund
-- a later outflow in the same atomic command, but not the reverse.
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000012',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'inventory_adjustment',
 jsonb_build_object('movements',jsonb_build_array(
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000012','stockClass','ingredient',
   'stockItemId','a9200000-0000-4000-8000-000000000002','kind','purchase_receipt',
   'direction','in','quantity','3','unit','g','sourceType','purchase_receipt',
   'sourceId','a9300000-0000-4000-8000-000000000012'),
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000013','stockClass','ingredient',
   'stockItemId','a9200000-0000-4000-8000-000000000002','kind','waste',
   'direction','out','quantity','2','unit','g','sourceType','waste',
   'sourceId','a9300000-0000-4000-8000-000000000013','reason','ordered command test')
  ))
 ) ->> 'status','accepted','ordered receipt then outflow succeeds in one command');
select is(
 (select sum(case when direction='in' then quantity else -quantity end)
  from public.stock_movements
  where owner_id='41111111-1111-4111-8111-111111111111'
   and stock_item_id='a9200000-0000-4000-8000-000000000002'),
  1::numeric,'movement order leaves the expected non-negative balance');
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000001',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_receipt',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000001','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','purchase_receipt',
 'direction','in','quantity','6.25','unit','g','sourceType','purchase_receipt',
 'sourceId','a9300000-0000-4000-8000-000000000001'))))$sql$,
 '22023','Idempotency key reused with a different request','payload mismatch rejected');
-- A correction must exactly reverse its linked event, and an original event
-- cannot be reversed twice.
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000030',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'correction',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000030','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','correction',
 'direction','out','quantity','5.24','unit','g','sourceType','correction',
 'sourceId','a9300000-0000-4000-8000-000000000030','relatedEventId','a9100000-0000-4000-8000-000000000001',
 'reason','exact reversal required'))))$sql$,
 '23514','Reversal or correction must exactly reverse one linked event for the same item and unit',
 'correction quantity must equal linked event quantity');
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000031',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'correction',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000031','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','reversal',
 'direction','out','quantity','5.25','unit','g','sourceType','reversal',
 'sourceId','a9300000-0000-4000-8000-000000000031','relatedEventId','a9100000-0000-4000-8000-000000000001',
 'reason','reverse receipt')))) ->> 'status',
 'accepted','one exact linked reversal is accepted');
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000032',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'correction',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000032','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','reversal',
 'direction','out','quantity','5.25','unit','g','sourceType','reversal',
 'sourceId','a9300000-0000-4000-8000-000000000032','relatedEventId','a9100000-0000-4000-8000-000000000001',
 'reason','duplicate reversal'))))$sql$,
 '23514','Reversal or correction must exactly reverse one linked event for the same item and unit',
 'duplicate linked reversal is rejected');

select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000002',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000002','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','waste',
 'direction','out','quantity','100','unit','g','sourceType','waste',
 'sourceId','a9300000-0000-4000-8000-000000000002','reason','test'))))$sql$,
 '23514','Insufficient stock; negative stock is not allowed','negative stock rejected');
select is((select count(*)::integer from public.stock_movements where event_id='a9100000-0000-4000-8000-000000000002'),0,'failed command writes no movement');
-- A later invalid movement rolls back an earlier valid movement in the same command.
set local "request.jwt.claim.sub"='41111111-1111-4111-8111-111111111111';
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000010',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'inventory_adjustment',
 jsonb_build_object('movements',jsonb_build_array(
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000010',
   'stockClass','ingredient','stockItemId','a9200000-0000-4000-8000-000000000001',
   'kind','purchase_receipt','direction','in','quantity','1','unit','g',
   'sourceType','purchase_receipt','sourceId','a9300000-0000-4000-8000-000000000010'),
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000011',
   'stockClass','ingredient','stockItemId','a9200000-0000-4000-8000-000000000001',
   'kind','waste','direction','out','quantity','100','unit','g',
   'sourceType','waste','sourceId','a9300000-0000-4000-8000-000000000011','reason','atomicity test')
  )))$sql$,
 '23514','Insufficient stock; negative stock is not allowed','overdraw after an earlier row fails the whole command');
select is((select count(*)::integer from public.stock_movements
 where event_id in ('a9100000-0000-4000-8000-000000000010','a9100000-0000-4000-8000-000000000011')),
 0,'multi-row failure leaves no partial movements');
-- The idempotency ledger is intentionally unreadable to authenticated clients.
-- Temporarily reset to the migration/test runner role for this internal assertion.
reset role;
select is((select count(*)::integer from public.inventory_commands
 where operation_id='a9000000-0000-4000-8000-000000000010'),
 0,'multi-row failure leaves no command ledger entry');
set local role authenticated;
set local "request.jwt.claim.sub"='41111111-1111-4111-8111-111111111111';

-- A finished output and its immutable lot are created atomically; sale allocation
-- must identify that lot and match the reduction quantity exactly.
-- Seed the menu fixture with the privileged test role; then return to the
-- authenticated owner context for the actual RPC assertions.
reset role;
insert into public.menu_items (id,owner_id,business_id,name,status)
select 'a9400000-0000-4000-8000-000000000001',owner_id,business_id,'WP3.2 Kimbap','active'
from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'
on conflict (id) do nothing;
set local role authenticated;
set local "request.jwt.claim.sub"='41111111-1111-4111-8111-111111111111';
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000022',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
  'eventId','a9100000-0000-4000-8000-000000000022','stockClass','finished',
  'stockItemId','a9400000-0000-4000-8000-000000000001','kind','production_output',
  'direction','in','quantity','1','unit','each','sourceType','production_batch',
  'sourceId','a9500000-0000-4000-8000-000000000022'))))$sql$,
 '23514','Production output must include its finished lot in the same command',
 'output without a lot is rejected atomically');
select is((select count(*)::integer from public.stock_movements
 where event_id='a9100000-0000-4000-8000-000000000022'),0,'rejected output leaves no movement');

select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000020',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object(
  'movements',jsonb_build_array(jsonb_build_object(
   'eventId','a9100000-0000-4000-8000-000000000020','stockClass','finished',
   'stockItemId','a9400000-0000-4000-8000-000000000001','kind','production_output',
   'direction','in','quantity','10','unit','each','sourceType','production_batch',
   'sourceId','a9500000-0000-4000-8000-000000000001')),
  'lots',jsonb_build_array(jsonb_build_object(
   'lotId','a9600000-0000-4000-8000-000000000001',
   'menuItemId','a9400000-0000-4000-8000-000000000001',
   'batchId','a9500000-0000-4000-8000-000000000001',
   'outputEventId','a9100000-0000-4000-8000-000000000020',
   'producedQuantity','10','unit','each'))
 )
 ) ->> 'status','accepted','production output and lot are posted together');
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000021',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object(
  'movements',jsonb_build_array(jsonb_build_object(
   'eventId','a9100000-0000-4000-8000-000000000021','stockClass','finished',
   'stockItemId','a9400000-0000-4000-8000-000000000001','kind','sale',
   'direction','out','quantity','2','unit','each','sourceType','sale',
   'sourceId','a9500000-0000-4000-8000-000000000021')),
  'allocations',jsonb_build_array(jsonb_build_object(
   'eventId','a9100000-0000-4000-8000-000000000021',
   'lotId','a9600000-0000-4000-8000-000000000001','quantity','2','unit','each'))
 )
 ) ->> 'status','accepted','finished stock reduction and exact lot allocation are atomic');

-- WP3.3.3 production consumption, finished output, and lot share one atomic command.
select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000040',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_receipt',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
  'eventId','a9100000-0000-4000-8000-000000000040','stockClass','ingredient',
  'stockItemId','a9200000-0000-4000-8000-000000000003','kind','purchase_receipt',
  'direction','in','quantity','5','unit','kg','sourceType','purchase_receipt',
  'sourceId','a9300000-0000-4000-8000-000000000040')))
 ) ->> 'status','accepted','production fixture ingredient stock is available');

select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000041',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object('movements',jsonb_build_array(
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000041','stockClass','ingredient',
   'stockItemId','a9200000-0000-4000-8000-000000000003','kind','production_consumption',
   'direction','out','quantity','1.25','unit','kg','sourceType','production_batch',
   'sourceId','a9500000-0000-4000-8000-000000000002'),
  jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000042','stockClass','finished',
   'stockItemId','a9400000-0000-4000-8000-000000000001','kind','production_output',
   'direction','in','quantity','4','unit','each','sourceType','production_batch',
   'sourceId','a9500000-0000-4000-8000-000000000002')
  )))$sql$,
 '23514','Production output must include its finished lot in the same command',
 'production command without lot rolls back ingredient consumption and output');
select is((select sum(case when direction='in' then quantity else -quantity end)
 from public.stock_movements where stock_class='ingredient'
 and stock_item_id='a9200000-0000-4000-8000-000000000003'),
 5::numeric,'failed production command preserves ingredient stock');
select is((select count(*)::integer from public.stock_movements
 where event_id in ('a9100000-0000-4000-8000-000000000041','a9100000-0000-4000-8000-000000000042')),
 0,'failed production command leaves no ingredient or finished movement');

select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000043',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object(
  'movements',jsonb_build_array(
   jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000044','stockClass','ingredient',
    'stockItemId','a9200000-0000-4000-8000-000000000003','kind','production_consumption',
    'direction','out','quantity','1.25','unit','kg','sourceType','production_batch',
    'sourceId','a9500000-0000-4000-8000-000000000002'),
   jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000045','stockClass','finished',
    'stockItemId','a9400000-0000-4000-8000-000000000001','kind','production_output',
    'direction','in','quantity','4','unit','each','sourceType','production_batch',
    'sourceId','a9500000-0000-4000-8000-000000000002')
  ),
  'lots',jsonb_build_array(jsonb_build_object(
   'lotId','a9600000-0000-4000-8000-000000000002',
   'menuItemId','a9400000-0000-4000-8000-000000000001',
   'batchId','a9500000-0000-4000-8000-000000000002',
   'outputEventId','a9100000-0000-4000-8000-000000000045',
   'producedQuantity','4','unit','each')),
  'allocations','[]'::jsonb
 )
 ) ->> 'status','accepted','production consumption, output, and lot post together');

select is(
 public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000043',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
 'stock_movement',
 jsonb_build_object(
  'movements',jsonb_build_array(
   jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000044','stockClass','ingredient',
    'stockItemId','a9200000-0000-4000-8000-000000000003','kind','production_consumption',
    'direction','out','quantity','1.25','unit','kg','sourceType','production_batch',
    'sourceId','a9500000-0000-4000-8000-000000000002'),
   jsonb_build_object('eventId','a9100000-0000-4000-8000-000000000045','stockClass','finished',
    'stockItemId','a9400000-0000-4000-8000-000000000001','kind','production_output',
    'direction','in','quantity','4','unit','each','sourceType','production_batch',
    'sourceId','a9500000-0000-4000-8000-000000000002')
  ),
  'lots',jsonb_build_array(jsonb_build_object(
   'lotId','a9600000-0000-4000-8000-000000000002',
   'menuItemId','a9400000-0000-4000-8000-000000000001',
   'batchId','a9500000-0000-4000-8000-000000000002',
   'outputEventId','a9100000-0000-4000-8000-000000000045',
   'producedQuantity','4','unit','each')),
  'allocations','[]'::jsonb
 )
 ) ->> 'status','accepted','production command retry returns original result');
select is((select count(*)::integer from public.stock_movements
 where event_id in ('a9100000-0000-4000-8000-000000000044','a9100000-0000-4000-8000-000000000045')),
 2,'production retry does not duplicate movements');
select is((select count(*)::integer from public.finished_lots
 where lot_id='a9600000-0000-4000-8000-000000000002'),
 1,'production retry does not duplicate the finished lot');
select is((select sum(case when direction='in' then quantity else -quantity end)
 from public.stock_movements where stock_class='ingredient'
 and stock_item_id='a9200000-0000-4000-8000-000000000003'),
 3.75::numeric,'production posting consumes only the measured ingredient quantity');

select set_config('test.inventory_business_id',
 (select business_id::text from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'), true);
reset role;
set local role authenticated;
set local "request.jwt.claim.sub"='42222222-2222-4222-8222-222222222222';
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000003',
 pg_catalog.current_setting('test.inventory_business_id')::uuid,
 'stock_receipt',
 jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
 'eventId','a9100000-0000-4000-8000-000000000003','stockClass','ingredient',
 'stockItemId','a9200000-0000-4000-8000-000000000001','kind','purchase_receipt',
 'direction','in','quantity','1','unit','g','sourceType','purchase_receipt',
 'sourceId','a9300000-0000-4000-8000-000000000003'))))$sql$,
 '42501','Business not found or not owned by caller','cross-owner command rejected');
reset role;
select * from finish();
rollback;
