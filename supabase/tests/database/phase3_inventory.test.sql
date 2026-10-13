begin;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('31111111-1111-4111-8111-111111111111','authenticated','authenticated','wp31-a@example.test','',now()),
       ('32222222-2222-4222-8222-222222222222','authenticated','authenticated','wp31-b@example.test','',now())
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '31111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id, name)
values ('a3111111-1111-4111-8111-111111111111','WP3.1 Owner A')
on conflict (owner_id) do nothing;
set local "request.jwt.claim.sub" = '32222222-2222-4222-8222-222222222222';
insert into public.business_profiles (id, name)
values ('a3222222-2222-4222-8222-222222222222','WP3.1 Owner B')
on conflict (owner_id) do nothing;
reset role;

select ok((select relrowsecurity from pg_class where oid='public.inventory_commands'::regclass), 'inventory command idempotency table has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.stock_movements'::regclass), 'stock movement ledger has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.finished_lots'::regclass), 'finished lots have RLS enabled');
select ok(not has_table_privilege('anon','public.stock_movements','select'), 'anonymous users cannot read stock movements');
select ok(not has_table_privilege('authenticated','public.stock_movements','insert'), 'clients cannot directly insert stock movements');
select ok(not has_table_privilege('authenticated','public.stock_movements','update'), 'clients cannot update stock movements');
select ok(not has_table_privilege('authenticated','public.stock_movements','delete'), 'clients cannot delete stock movements');
select ok(not has_table_privilege('authenticated','public.inventory_commands','select'), 'clients cannot read the trusted idempotency ledger');

insert into public.menu_items (id, owner_id, business_id, name, status)
select 'a4000000-0000-4000-8000-000000000001', owner_id, business_id, 'Kimbap', 'active'
from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111';

insert into public.stock_movements (
  owner_id,business_id,event_id,stock_class,stock_item_id,kind,direction,quantity,unit,
  source_type,source_id,recorded_at,effective_at
)
select owner_id,business_id,'a5000000-0000-4000-8000-000000000001','finished',
  'a4000000-0000-4000-8000-000000000001','production_output','in',10,'each',
  'production_batch','a7000000-0000-4000-8000-000000000001',now(),now()
from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111';

insert into public.finished_lots (
  owner_id,business_id,lot_id,menu_item_id,batch_id,output_event_id,produced_quantity,unit,produced_at
)
select owner_id,business_id,'a6000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',10,'each',now()
from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.stock_movements where event_id='a5000000-0000-4000-8000-000000000001'),1,'valid finished output is stored once');
select is((select count(*)::integer from public.finished_lots where lot_id='a6000000-0000-4000-8000-000000000001'),1,'finished lot links to its output event');
select throws_ok(
  $sql$insert into public.finished_lots (
    owner_id,business_id,lot_id,menu_item_id,batch_id,output_event_id,produced_quantity,unit,produced_at
  ) select owner_id,business_id,'a6000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',9,'each',now()
  from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111'$sql$,
  '23514','Finished lot must match its finished production output event','lot quantity must match output movement'
);
select throws_ok(
  $sql$update public.finished_lots set produced_quantity=9 where lot_id='a6000000-0000-4000-8000-000000000001'$sql$,
  '55000','Finished lots are immutable; record stock changes as movements','finished lot identity cannot be edited'
);
select throws_ok(
  $sql$update public.stock_movements set quantity=9 where event_id='a5000000-0000-4000-8000-000000000001'$sql$,
  '55000','Stock movements are append-only; record a linked correction or reversal','posted movement cannot be edited'
);
select throws_ok(
  $sql$delete from public.stock_movements where event_id='a5000000-0000-4000-8000-000000000001'$sql$,
  '55000','Stock movements are append-only; record a linked correction or reversal','posted movement cannot be deleted'
);
select throws_ok(
  $sql$insert into public.stock_movements (
    owner_id,business_id,event_id,stock_class,stock_item_id,kind,direction,quantity,unit,source_type,source_id,recorded_at,effective_at
  ) select owner_id,business_id,'a5000000-0000-4000-8000-000000000002','ingredient',
    'a8000000-0000-4000-8000-000000000001','purchase_receipt','in',0,'kg','receipt',
    'a7000000-0000-4000-8000-000000000002',now(),now()
  from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111'$sql$,
  '23514','new row for relation "stock_movements" violates check constraint "stock_movements_quantity_check"','zero quantity is rejected'
);
select throws_ok(
  $sql$insert into public.stock_movements (
    owner_id,business_id,event_id,stock_class,stock_item_id,kind,direction,quantity,unit,source_type,source_id,recorded_at,effective_at
  ) select owner_id,business_id,'a5000000-0000-4000-8000-000000000003','finished',
    'a8000000-0000-4000-8000-000000000002','production_output','in',1.5,'each','production_batch',
    'a7000000-0000-4000-8000-000000000003',now(),now()
  from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111'$sql$,
  '23514','new row for relation "stock_movements" violates check constraint "stock_movements_finished_each_integral"','finished each must be whole number'
);
select throws_ok(
  $sql$insert into public.stock_movements (
    owner_id,business_id,event_id,stock_class,stock_item_id,kind,direction,quantity,unit,source_type,source_id,recorded_at,effective_at
  ) select owner_id,business_id,'a5000000-0000-4000-8000-000000000004','ingredient',
    'a8000000-0000-4000-8000-000000000004','production_output','in',1,'each','production_batch',
    'a7000000-0000-4000-8000-000000000004',now(),now()
  from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111'$sql$,
  '23514','new row for relation "stock_movements" violates check constraint "stock_movements_production_stock_class"','production output must reference finished stock'
);
select throws_ok(
  $sql$insert into public.stock_movements (
    owner_id,business_id,event_id,stock_class,stock_item_id,kind,direction,quantity,unit,source_type,source_id,recorded_at,effective_at
  ) select owner_id,business_id,'a5000000-0000-4000-8000-000000000005','finished',
    'a8000000-0000-4000-8000-000000000005','production_consumption','out',1,'kg','production_batch',
    'a7000000-0000-4000-8000-000000000005',now(),now()
  from public.business_profiles where owner_id='31111111-1111-4111-8111-111111111111'$sql$,
  '23514','new row for relation "stock_movements" violates check constraint "stock_movements_production_stock_class"','production consumption must reference ingredient stock'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '31111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.stock_movements),1,'owner can read their own stock movement');
set local "request.jwt.claim.sub" = '32222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.stock_movements),0,'another owner cannot read the first owner stock movement');
reset role;

select * from finish();
rollback;
