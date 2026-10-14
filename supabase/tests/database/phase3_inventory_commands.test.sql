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
reset role;
set local role authenticated;
set local "request.jwt.claim.sub"='42222222-2222-4222-8222-222222222222';
select throws_ok(
 $sql$select public.apply_inventory_command(
 'a9000000-0000-4000-8000-000000000003',
 (select business_id from public.business_profiles where owner_id='41111111-1111-4111-8111-111111111111'),
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
