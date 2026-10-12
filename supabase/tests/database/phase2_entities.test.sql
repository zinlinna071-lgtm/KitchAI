begin;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'phase2-a@example.test', '', now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'phase2-b@example.test', '', now())
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id, name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Phase 2 Owner A')
on conflict (owner_id) do nothing;
set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
insert into public.business_profiles (id, name)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Phase 2 Owner B')
on conflict (owner_id) do nothing;

reset role;
select ok((select relrowsecurity from pg_class where oid='public.ingredients'::regclass), 'ingredients has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.menu_items'::regclass), 'menu items has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.recipes'::regclass), 'recipes has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.recipe_lines'::regclass), 'recipe lines has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.phase2_entity_operations'::regclass), 'idempotency ledger has RLS enabled');
select ok(not has_table_privilege('anon','public.ingredients','select'), 'anonymous users cannot read ingredients');
select ok(not has_table_privilege('authenticated','public.ingredients','insert'), 'clients cannot directly insert ingredients');
select ok(not has_table_privilege('authenticated','public.ingredients','update'), 'clients cannot directly update ingredients');
select ok(not has_table_privilege('authenticated','public.ingredients','delete'), 'clients cannot delete ingredients');
select ok(not has_table_privilege('authenticated','public.phase2_entity_operations','select'), 'clients cannot read the idempotency ledger');
select ok(not has_function_privilege('anon','public.apply_phase2_entity_operation(uuid,text,uuid,text,bigint,jsonb)','execute'), 'anonymous users cannot call the write RPC');
select ok(has_function_privilege('authenticated','public.apply_phase2_entity_operation(uuid,text,uuid,text,bigint,jsonb)','execute'), 'authenticated users can call the write RPC');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000001','ingredient',
    '10000000-0000-4000-8000-000000000101','create',null,
    '{"name":"  Flour  ","description":"Plain flour","status":"active","owner_id":"22222222-2222-4222-8222-222222222222","business_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'::jsonb
  )->>'status',
  'accepted','authenticated owner creates an ingredient'
);
select is(
  (select name from public.ingredients where id='10000000-0000-4000-8000-000000000101'),
  'Flour','server trims ingredient names'
);
select is(
  (select owner_id::text from public.ingredients where id='10000000-0000-4000-8000-000000000101'),
  '11111111-1111-4111-8111-111111111111','server derives owner instead of trusting payload'
);
select is(
  (select business_id from public.ingredients where id='10000000-0000-4000-8000-000000000101'),
  (select business_id from public.business_profiles where owner_id=auth.uid()),
  'server derives remote business from authenticated owner profile'
);
select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000001','ingredient',
    '10000000-0000-4000-8000-000000000101','create',null,
    '{"name":"  Flour  ","description":"Plain flour","status":"active","owner_id":"22222222-2222-4222-8222-222222222222","business_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'::jsonb
  )->>'status',
  'accepted','identical operation replay returns original accepted result'
);
select is((select count(*)::integer from public.ingredients where id='10000000-0000-4000-8000-000000000101'),1,'replay does not duplicate ingredient');
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000001','ingredient',
    '10000000-0000-4000-8000-000000000101','create',null,'{"name":"Different"}'::jsonb
  )$sql$,
  '22023','Idempotency key reused with a different request','operation ID cannot be reused for a different payload'
);

select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000002','menu_item',
    '10000000-0000-4000-8000-000000000102','create',null,
    '{"name":"Bread","description":"House loaf","status":"active"}'::jsonb
  )->>'status','accepted','owner creates a menu item'
);
select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000003','recipe',
    '10000000-0000-4000-8000-000000000103','create',null,
    '{"menuItemId":"10000000-0000-4000-8000-000000000102","name":"Bread recipe","yieldPortions":1,"status":"draft"}'::jsonb
  )->>'status','accepted','owner creates a draft recipe linked to same-business menu item'
);
select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000004','recipe_line',
    '10000000-0000-4000-8000-000000000104','create',null,
    '{"recipeId":"10000000-0000-4000-8000-000000000103","ingredientId":"10000000-0000-4000-8000-000000000101","quantity":250,"unit":"g","position":0,"note":"sift first"}'::jsonb
  )->>'status','accepted','owner creates a valid recipe ingredient line'
);
select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000005','recipe',
    '10000000-0000-4000-8000-000000000103','update',1,
    '{"menuItemId":"10000000-0000-4000-8000-000000000102","name":"Bread recipe","yieldPortions":1,"status":"active"}'::jsonb
  )->>'status','accepted','recipe can become active with positive yield and a valid ingredient line'
);
select is(
  (select status from public.recipes where id='10000000-0000-4000-8000-000000000103'),
  'active','recipe status is persisted'
);

select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000006','ingredient',
    '10000000-0000-4000-8000-000000000101','update',1,
    '{"name":"Bread flour","description":"Updated","status":"active"}'::jsonb
  )->>'status','accepted','update with current revision is accepted'
);
select is((select revision from public.ingredients where id='10000000-0000-4000-8000-000000000101'),2::bigint,'revision increments on update');
select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000007','ingredient',
    '10000000-0000-4000-8000-000000000101','update',1,
    '{"name":"Stale write","status":"active"}'::jsonb
  )->>'status','conflict','stale base revision returns conflict instead of overwriting'
);
select is(
  (public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000007','ingredient',
    '10000000-0000-4000-8000-000000000101','update',1,
    '{"name":"Stale write","status":"active"}'::jsonb
  )->'remoteRecord'->>'revision')::bigint,
  2::bigint,'conflict result includes current remote revision'
);
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000008','ingredient',
    '10000000-0000-4000-8000-000000000101','update',2,'{"name":"bad unit","unit":"cup","status":"active"}'::jsonb
  )$sql$,
  '22023','Idempotency key reused with a different request',
  'a used operation ID cannot be reused for another request'
);

select is(
  public.apply_phase2_entity_operation(
    '10000000-0000-4000-8000-000000000009','ingredient',
    '10000000-0000-4000-8000-000000000101','archive',2,'{}'::jsonb
  )->>'status','accepted','ingredient can be archived without hard deletion'
);
select is((select status from public.ingredients where id='10000000-0000-4000-8000-000000000101'),'archived','archive preserves the record');

set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.ingredients where id='10000000-0000-4000-8000-000000000101'),0,'owner B cannot read owner A ingredient');
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '20000000-0000-4000-8000-000000000001','ingredient',
    '10000000-0000-4000-8000-000000000101','update',2,'{"name":"Cross owner","status":"active"}'::jsonb
  )$sql$,
  '42501','Record not found or not owned by caller','RPC rejects cross-owner mutation'
);
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '20000000-0000-4000-8000-000000000002','recipe',
    '20000000-0000-4000-8000-000000000103','create',null,
    '{"menuItemId":"10000000-0000-4000-8000-000000000102","name":"Cross business","yieldPortions":1,"status":"draft"}'::jsonb
  )$sql$,
  '42501','Menu item not found in this business','RPC rejects cross-business relationship'
);
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '20000000-0000-4000-8000-000000000003','ingredient',
    '20000000-0000-4000-8000-000000000104','create',null,'{"name":"   "}'::jsonb
  )$sql$,
  '22023','Name must contain 1 to 120 characters','RPC rejects blank names'
);
select throws_ok(
  $sql$select public.apply_phase2_entity_operation(
    '20000000-0000-4000-8000-000000000004','recipe_line',
    '20000000-0000-4000-8000-000000000104','create',null,
    '{"recipeId":"10000000-0000-4000-8000-000000000103","ingredientId":"20000000-0000-4000-8000-000000000001","quantity":1,"unit":"cup","position":0}'::jsonb
  )$sql$,
  '22023','Unsupported unit','RPC rejects units outside the explicit allowlist'
);
reset role;
select is(
  (select count(*)::integer from public.phase2_entity_operations where owner_id='11111111-1111-4111-8111-111111111111'),
  9,'accepted and conflict results are durably recorded once per operation'
);

select * from finish();
rollback;
