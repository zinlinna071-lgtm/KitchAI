begin;
select no_plan();

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values
 ('53111111-1111-4111-8111-111111111111','authenticated','authenticated','wp35b-a@example.test','',now()),
 ('53222222-2222-4222-8222-222222222222','authenticated','authenticated','wp35b-b@example.test','',now())
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub"='53111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id,name)
values ('b5311111-1111-4111-8111-111111111111','WP3.5b Owner A')
on conflict (owner_id) do nothing;

insert into public.ingredients (id, owner_id, business_id, name)
select 'b5321111-1111-4111-8111-111111111111', owner_id, business_id, 'WP3.5b ingredient'
from public.business_profiles
where owner_id='53111111-1111-4111-8111-111111111111'
on conflict (id) do nothing;

select ok(
 has_function_privilege('authenticated','public.get_inventory_item_snapshot(uuid,text,uuid)','execute'),
 'authenticated owner can request an inventory snapshot'
);
select ok(
 not has_function_privilege('anon','public.get_inventory_item_snapshot(uuid,text,uuid)','execute'),
 'anonymous callers cannot request inventory snapshots'
);
select ok(
 not has_table_privilege('authenticated','public.stock_item_versions','select'),
 'clients cannot read internal version tokens directly'
);
select ok(
 not has_table_privilege('authenticated','public.stock_item_versions','insert'),
 'clients cannot write internal version tokens directly'
);

select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '0',
 'new stock item has a server-created version zero'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'systemQuantity',
 '0.000000',
 'empty ledger snapshot has exact zero balance'
);

select is(
 public.apply_inventory_command(
  'b5330000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'stock_receipt',
  jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
   'eventId','b5340000-0000-4000-8000-000000000001',
   'stockClass','ingredient','stockItemId','b5321111-1111-4111-8111-111111111111',
   'kind','purchase_receipt','direction','in','quantity','5.25','unit','g',
   'sourceType','purchase_receipt','sourceId','b5350000-0000-4000-8000-000000000001'
  )))
 ) ->> 'status',
 'accepted',
 'valid receipt is accepted through the shared inventory command'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '1',
 'each accepted stock movement advances the version exactly once'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'systemQuantity',
 '5.250000',
 'snapshot balance is derived from the append-only ledger'
);

select is(
 public.apply_inventory_command(
  'b5330000-0000-4000-8000-000000000001',
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'stock_receipt',
  jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
   'eventId','b5340000-0000-4000-8000-000000000001',
   'stockClass','ingredient','stockItemId','b5321111-1111-4111-8111-111111111111',
   'kind','purchase_receipt','direction','in','quantity','5.25','unit','g',
   'sourceType','purchase_receipt','sourceId','b5350000-0000-4000-8000-000000000001'
  )))
 ) ->> 'status',
 'accepted',
 'identical command retry returns the accepted result'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '1',
 'idempotent retry does not advance the version a second time'
);

select is(
 public.apply_inventory_command(
  'b5330000-0000-4000-8000-000000000002',
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'stock_movement',
  jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
   'eventId','b5340000-0000-4000-8000-000000000002',
   'stockClass','ingredient','stockItemId','b5321111-1111-4111-8111-111111111111',
   'kind','waste','direction','out','quantity','1','unit','g',
   'sourceType','waste','sourceId','b5350000-0000-4000-8000-000000000002','reason','WP3.5b test'
  )))
 ) ->> 'status',
 'accepted',
 'a second accepted movement advances the same item version'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '2',
 'version advances monotonically with each ledger movement'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'systemQuantity',
 '4.250000',
 'snapshot reflects the current signed ledger balance'
);

select throws_ok(
 $sql$select public.apply_inventory_command(
  'b5330000-0000-4000-8000-000000000003',
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'stock_movement',
  jsonb_build_object('movements',jsonb_build_array(jsonb_build_object(
   'eventId','b5340000-0000-4000-8000-000000000003',
   'stockClass','ingredient','stockItemId','b5321111-1111-4111-8111-111111111111',
   'kind','waste','direction','out','quantity','100','unit','g',
   'sourceType','waste','sourceId','b5350000-0000-4000-8000-000000000003','reason','invalid overdraw'
  )))
 )$sql$,
 '23514','Insufficient stock; negative stock is not allowed',
 'rejected command cannot overdraw stock'
);
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5321111-1111-4111-8111-111111111111'
 ) ->> 'version',
 '2',
 'rolled-back command does not advance the version'
);

select throws_ok(
 $sql$select public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'),
  'ingredient','b5329999-9999-4999-8999-999999999999'
 )$sql$,
 '42501','Stock item not found or not owned by caller',
 'unknown stock item cannot be snapshotted'
);

select set_config('test.wp35b_business_id',
 (select business_id::text from public.business_profiles where owner_id='53111111-1111-4111-8111-111111111111'), true);
reset role;
set local role authenticated;
set local "request.jwt.claim.sub"='53222222-2222-4222-8222-222222222222';
select throws_ok(
 $sql$select public.get_inventory_item_snapshot(
  pg_catalog.current_setting('test.wp35b_business_id')::uuid,
  'ingredient','b5321111-1111-4111-8111-111111111111'
 )$sql$,
 '42501','Business not found or not owned by caller',
 'cross-owner snapshot is rejected'
);

reset role;
select * from finish();
rollback;
