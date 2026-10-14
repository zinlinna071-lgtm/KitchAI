-- dblink runs inside the Postgres container, so use its internal 5432 port (not the host-mapped 54322).
-- Two-session regression: hold the shared owner lock in an ordinary stock writer,
-- start a count post using the captured version, then commit the writer first.
-- The waiting count must see the advanced version and reject without any count audit.
create extension if not exists dblink with schema extensions;
alter extension dblink set schema extensions;

select no_plan();

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('55111111-1111-4111-8111-111111111111','authenticated','authenticated','wp35d-race@example.test','',now())
on conflict (id) do nothing;

set role authenticated;
set "request.jwt.claim.sub"='55111111-1111-4111-8111-111111111111';
insert into public.business_profiles (id,name)
values ('b5511111-1111-4111-8111-111111111111','WP3.5d concurrency owner')
on conflict (owner_id) do nothing;
select public.apply_phase2_entity_operation(
 'b5520000-0000-4000-8000-000000000001','ingredient',
 'b5521111-1111-4111-8111-111111111111','create',null,
 '{"name":"WP3.5d race ingredient","description":"Two-session stale-count test","status":"active"}'::jsonb
);
reset role;

create or replace function public.wp35d_test_count_wrapper(
 p_command_id uuid, p_business_id uuid, p_session_id uuid, p_lines jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.post_stock_count_subset(p_command_id, p_business_id, p_session_id, p_lines, false);
  return 'accepted:' || (v_result ->> 'status');
exception when serialization_failure then
  return 'stale:' || sqlerrm;
end;
$$;

select extensions.dblink_connect(
 'wp35d_writer',
 'dbname=postgres'
);
select extensions.dblink_connect(
 'wp35d_count',
 'dbname=postgres'
);
select extensions.dblink_exec('wp35d_writer', 'begin');
select extensions.dblink_exec('wp35d_writer', 'set role authenticated');
select extensions.dblink_exec('wp35d_writer', 'set "request.jwt.claim.sub"=''55111111-1111-4111-8111-111111111111''');
select extensions.dblink_exec('wp35d_count', 'set role authenticated');
select extensions.dblink_exec('wp35d_count', 'set "request.jwt.claim.sub"=''55111111-1111-4111-8111-111111111111'');

-- Acquire the same transaction-scoped owner lock that apply_inventory_command uses.
select locked from extensions.dblink(
 'wp35d_writer',
 'select 1 from (select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''55111111-1111-4111-8111-111111111111'', 0))) lock_holder'
) as t(locked integer);

select is(
 extensions.dblink_send_query(
  'wp35d_count',
  'select public.wp35d_test_count_wrapper(''b5530000-0000-4000-8000-000000000001''::uuid, (select business_id from public.business_profiles where owner_id=''55111111-1111-4111-8111-111111111111''), ''b5540000-0000-4000-8000-000000000001''::uuid, ''[{"lineId":"b5550000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b5521111-1111-4111-8111-111111111111","expectedVersion":"0","countedQuantity":"0","unit":"g","reason":"","countedAt":"2026-10-14T12:00:00Z","reviewedAt":"2026-10-14T12:01:00Z"}]''::jsonb)'
 ),
 1,
 'second database session successfully starts a count post while the writer holds the shared lock'
);

do $$
declare
  v_waiting boolean := false;
  v_attempt integer;
begin
  for v_attempt in 1..50 loop
    select exists (
      select 1 from pg_catalog.pg_stat_activity
      where wait_event_type = 'Lock' and wait_event = 'advisory'
        and query like '%wp35d_test_count_wrapper%'
    ) into v_waiting;
    exit when v_waiting;
    perform pg_catalog.pg_sleep(0.1);
  end loop;
  if not v_waiting then
    raise exception 'Concurrent count request never waited on the shared owner advisory lock';
  end if;
end;
$$;

select is(
 (select result ->> 'status' from extensions.dblink(
  'wp35d_writer',
  $$select public.apply_inventory_command(
    'b5560000-0000-4000-8000-000000000001'::uuid,
    (select business_id from public.business_profiles where owner_id='55111111-1111-4111-8111-111111111111'),
    'stock_receipt',
    '{"movements":[{"eventId":"b5570000-0000-4000-8000-000000000001","stockClass":"ingredient","stockItemId":"b5521111-1111-4111-8111-111111111111","kind":"purchase_receipt","direction":"in","quantity":"1","unit":"g","sourceType":"purchase_receipt","sourceId":"b5580000-0000-4000-8000-000000000001"}]}'::jsonb
  )$$
 ) as t(result jsonb)),
 'accepted',
 'ordinary stock writer commits its receipt while holding the shared lock'
);
select extensions.dblink_exec('wp35d_writer', 'commit');

select is(
 (select result from extensions.dblink_get_result('wp35d_count') as t(result text)),
 'stale:Stock count is stale for item b5521111-1111-4111-8111-111111111111: expected version 0, current version 1. Refresh the snapshot and recount/review this line.',
 'count that waited behind a concurrent stock movement is rejected as stale'
);
-- libpq requires one final empty result read to return the async connection to idle.
select count(*) from extensions.dblink_get_result('wp35d_count') as t(result text);

set role authenticated;
set "request.jwt.claim.sub"='55111111-1111-4111-8111-111111111111';
select is(
 public.get_inventory_item_snapshot(
  (select business_id from public.business_profiles where owner_id='55111111-1111-4111-8111-111111111111'),
  'ingredient','b5521111-1111-4111-8111-111111111111'
 ) ->> 'systemQuantity',
 '1.000000',
 'concurrent rejection preserves the ordinary receipt as the only stock effect'
);
reset role;
select is(
 (select count(*)::integer from public.stock_count_line_postings
  where owner_id='55111111-1111-4111-8111-111111111111'
    and session_id='b5540000-0000-4000-8000-000000000001'),
  0,
 'stale concurrent count leaves no accepted count audit'
);
reset role;

select extensions.dblink_disconnect('wp35d_count');
select extensions.dblink_disconnect('wp35d_writer');
drop function public.wp35d_test_count_wrapper(uuid, uuid, uuid, jsonb);
delete from auth.users where id='55111111-1111-4111-8111-111111111111';
select * from finish();
