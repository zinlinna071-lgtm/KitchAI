-- WP3.5d: optimistic physical stock-count posting.
-- Count audit, optional ledger adjustment, and idempotency result commit atomically.
-- The owner-scoped advisory lock is intentionally shared with apply_inventory_command.
create table public.stock_count_sessions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  session_id uuid not null,
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  primary key (owner_id, business_id, session_id),
  constraint stock_count_sessions_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint stock_count_sessions_completion_pair check ((status = 'completed') = (completed_at is not null))
);
alter table public.stock_count_sessions enable row level security;
revoke all on public.stock_count_sessions from public, anon, authenticated;
comment on table public.stock_count_sessions is
  'Server-owned lifecycle gate for physical stock counts; created only when a reviewed subset is first posted.';

create table public.stock_count_commands (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  command_id uuid not null,
  session_id uuid not null,
  request jsonb not null,
  result jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  primary key (owner_id, command_id),
  constraint stock_count_commands_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint stock_count_commands_session_fk foreign key (owner_id, business_id, session_id)
    references public.stock_count_sessions(owner_id, business_id, session_id) on delete cascade,
  constraint stock_count_commands_completion_pair check ((result is null) = (completed_at is null))
);
alter table public.stock_count_commands enable row level security;
revoke all on public.stock_count_commands from public, anon, authenticated;

create table public.stock_count_line_postings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  session_id uuid not null,
  line_id uuid not null,
  command_id uuid not null,
  stock_class text not null check (stock_class in ('ingredient', 'finished')),
  stock_item_id uuid not null,
  expected_version bigint not null check (expected_version >= 0),
  system_quantity numeric(24,6) not null check (system_quantity >= 0 and system_quantity < 'Infinity'::numeric),
  counted_quantity numeric(24,6) not null check (counted_quantity >= 0 and counted_quantity < 'Infinity'::numeric),
  variance numeric(24,6) not null,
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'each')),
  reason text not null default '',
  movement_event_id uuid,
  counted_at timestamptz not null,
  reviewed_at timestamptz not null,
  recorded_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, business_id, session_id, line_id),
  unique (owner_id, business_id, session_id, stock_class, stock_item_id),
  unique (owner_id, business_id, movement_event_id),
  constraint stock_count_line_postings_session_fk foreign key (owner_id, business_id, session_id)
    references public.stock_count_sessions(owner_id, business_id, session_id) on delete cascade,
  constraint stock_count_line_postings_command_fk foreign key (owner_id, command_id)
    references public.stock_count_commands(owner_id, command_id) on delete cascade,
  constraint stock_count_line_postings_variance check (variance = counted_quantity - system_quantity),
  constraint stock_count_line_postings_zero_movement check ((variance = 0) = (movement_event_id is null)),
  constraint stock_count_line_postings_reason check (variance = 0 or char_length(btrim(reason)) > 0),
  constraint stock_count_line_postings_each_whole check (unit <> 'each' or counted_quantity = trunc(counted_quantity))
);
alter table public.stock_count_line_postings enable row level security;
revoke all on public.stock_count_line_postings from public, anon, authenticated;
comment on table public.stock_count_line_postings is
  'Immutable server audit for accepted count lines, including zero-variance lines that intentionally create no stock movement.';

create or replace function public.post_stock_count_subset(
  p_command_id uuid,
  p_business_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_complete_session boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_request jsonb;
  v_prior_request jsonb;
  v_result jsonb;
  v_line jsonb;
  v_lock_item record;
  v_version bigint;
  v_expected_version bigint;
  v_balance numeric(24,6);
  v_counted numeric(24,6);
  v_variance numeric(24,6);
  v_unit text;
  v_unit_count bigint;
  v_event_id uuid;
  v_line_id uuid;
  v_stock_class text;
  v_stock_item_id uuid;
  v_reason text;
  v_counted_at timestamptz;
  v_reviewed_at timestamptz;
  v_movement_count integer := 0;
  v_zero_variance_count integer := 0;
  v_posted_line_ids jsonb := '[]'::jsonb;
  v_event_ids jsonb := '[]'::jsonb;
  v_session_status text;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_command_id is null or p_business_id is null or p_session_id is null then
    raise exception 'Count command, business, and session IDs are required' using errcode = '22023';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_lines) < 1
     or pg_catalog.jsonb_array_length(p_lines) > 200
     or p_complete_session is null then
    raise exception 'A count posting must contain 1 to 200 lines and a completion flag' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.business_profiles bp
    where bp.owner_id = v_owner and bp.business_id = p_business_id
  ) then
    raise exception 'Business not found or not owned by caller' using errcode = '42501';
  end if;

  -- Same serialization boundary as all existing inventory commands.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 0));

  v_request := pg_catalog.jsonb_build_object(
    'businessId', p_business_id,
    'sessionId', p_session_id,
    'lines', p_lines,
    'completeSession', p_complete_session
  );

  -- Idempotency must be checked before session state or version validation:
  -- a retry after a successful post returns the accepted result, not "stale".
  select request, result into v_prior_request, v_result
  from public.stock_count_commands
  where owner_id = v_owner and command_id = p_command_id
  for update;
  if found then
    if v_prior_request is distinct from v_request then
      raise exception 'Count command ID reused with a different request' using errcode = '22023';
    end if;
    if v_result is null then
      raise exception 'Stock-count command has an incomplete prior result' using errcode = '55000';
    end if;
    return v_result;
  end if;

  -- Reject duplicate item/line/event IDs inside a submitted atomic subset.
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) e(value)
    group by e.value ->> 'lineId' having count(*) > 1
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) e(value)
    group by e.value ->> 'stockClass', e.value ->> 'stockItemId' having count(*) > 1
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) e(value)
    where coalesce(e.value ->> 'varianceEventId', '') <> ''
    group by e.value ->> 'varianceEventId' having count(*) > 1
  ) then
    raise exception 'A count subset cannot repeat a line, stock item, or variance event ID' using errcode = '22023';
  end if;

  insert into public.stock_count_sessions(owner_id, business_id, session_id)
  values (v_owner, p_business_id, p_session_id)
  on conflict (owner_id, business_id, session_id) do nothing;

  select status into v_session_status
  from public.stock_count_sessions
  where owner_id = v_owner and business_id = p_business_id and session_id = p_session_id
  for update;
  if v_session_status <> 'open' then
    raise exception 'Stock-count session is already completed' using errcode = '55000';
  end if;

  -- Validate identifiers/quantities before casting, then lock all versions in
  -- deterministic order. apply_inventory_command takes the same owner lock.
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines)
  loop
    if coalesce(v_line ->> 'stockClass', '') not in ('ingredient', 'finished')
       or coalesce(v_line ->> 'stockItemId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_line ->> 'lineId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_line ->> 'expectedVersion', '') !~ '^[0-9]+$'
       or pg_catalog.jsonb_typeof(v_line -> 'countedQuantity') is distinct from 'string'
       or coalesce(v_line ->> 'countedQuantity', '') !~ '^(0|[1-9][0-9]*)([.][0-9]{1,6})?$'
       or coalesce(v_line ->> 'unit', '') not in ('g', 'kg', 'ml', 'l', 'each')
       or coalesce(v_line ->> 'countedAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
       or coalesce(v_line ->> 'reviewedAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then
      raise exception 'Count line contains invalid IDs, version, quantity, unit, or timestamps' using errcode = '22023';
    end if;
    if coalesce(v_line ->> 'varianceEventId', '') <> ''
       and (v_line ->> 'varianceEventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Variance movement event ID must be a UUID' using errcode = '22023';
    end if;
    if coalesce(v_line ->> 'reason', '') <> '' and char_length(v_line ->> 'reason') > 500 then
      raise exception 'Count variance reason must not exceed 500 characters' using errcode = '22023';
    end if;
  end loop;

  for v_lock_item in
    select distinct e.value ->> 'stockClass' as stock_class,
      (e.value ->> 'stockItemId')::uuid as stock_item_id
    from pg_catalog.jsonb_array_elements(p_lines) e(value)
    order by 1, 2
  loop
    if (v_lock_item.stock_class = 'ingredient' and not exists (
      select 1 from public.ingredients i where i.owner_id = v_owner and i.business_id = p_business_id and i.id = v_lock_item.stock_item_id
    )) or (v_lock_item.stock_class = 'finished' and not exists (
      select 1 from public.menu_items mi where mi.owner_id = v_owner and mi.business_id = p_business_id and mi.id = v_lock_item.stock_item_id
    )) then
      raise exception 'Stock item not found or not owned by caller' using errcode = '42501';
    end if;
    insert into public.stock_item_versions(owner_id, business_id, stock_class, stock_item_id, version)
    values (v_owner, p_business_id, v_lock_item.stock_class, v_lock_item.stock_item_id, 0)
    on conflict (owner_id, business_id, stock_class, stock_item_id) do nothing;
    perform 1 from public.stock_item_versions siv
    where siv.owner_id = v_owner and siv.business_id = p_business_id
      and siv.stock_class = v_lock_item.stock_class and siv.stock_item_id = v_lock_item.stock_item_id
    for update;
  end loop;

  -- Check every expected version before inserting any audit or ledger row.
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines)
  loop
    v_stock_class := v_line ->> 'stockClass';
    v_stock_item_id := (v_line ->> 'stockItemId')::uuid;
    v_expected_version := (v_line ->> 'expectedVersion')::bigint;
    select version into v_version from public.stock_item_versions siv
    where siv.owner_id = v_owner and siv.business_id = p_business_id
      and siv.stock_class = v_stock_class and siv.stock_item_id = v_stock_item_id;
    if v_version <> v_expected_version then
      raise exception 'Stock count is stale for item %: expected version %, current version %. Refresh the snapshot and recount/review this line.',
        v_stock_item_id, v_expected_version, v_version using errcode = '40001';
    end if;
    select coalesce(sum(case when sm.direction = 'in' then sm.quantity else -sm.quantity end), 0),
      min(sm.unit), count(distinct sm.unit)
    into v_balance, v_unit, v_unit_count
    from public.stock_movements sm
    where sm.owner_id = v_owner and sm.business_id = p_business_id
      and sm.stock_class = v_stock_class and sm.stock_item_id = v_stock_item_id;
    if v_unit_count > 1 then
      raise exception 'Stock item has inconsistent units in its ledger' using errcode = '23514';
    end if;
    if v_unit is not null and v_unit <> v_line ->> 'unit' then
      raise exception 'Count unit differs from the stock ledger unit; automatic conversion is disabled' using errcode = '23514';
    end if;
    v_counted := (v_line ->> 'countedQuantity')::numeric;
    if v_counted >= 'Infinity'::numeric or v_counted < 0 then
      raise exception 'Counted quantity must be finite and non-negative' using errcode = '22023';
    end if;
    if v_line ->> 'unit' = 'each' and v_counted <> trunc(v_counted) then
      raise exception 'Counts in each must be whole numbers' using errcode = '22023';
    end if;
    v_variance := v_counted - v_balance;
    if v_variance <> 0 and char_length(btrim(coalesce(v_line ->> 'reason', ''))) = 0 then
      raise exception 'A non-zero stock-count variance requires a reason' using errcode = '23514';
    end if;
    if v_variance <> 0 and coalesce(v_line ->> 'varianceEventId', '') = '' then
      raise exception 'A non-zero variance requires a stable movement event ID' using errcode = '22023';
    end if;
    if v_variance = 0 and coalesce(v_line ->> 'varianceEventId', '') <> '' then
      raise exception 'Zero variance must not create a stock movement event' using errcode = '22023';
    end if;
  end loop;

  insert into public.stock_count_commands(owner_id, business_id, command_id, session_id, request)
  values (v_owner, p_business_id, p_command_id, p_session_id, v_request);

  -- Re-read and apply each line while all affected item versions remain locked.
  -- Any failure rolls back the whole submitted subset, including zero-variance audit.
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines)
  loop
    v_stock_class := v_line ->> 'stockClass';
    v_stock_item_id := (v_line ->> 'stockItemId')::uuid;
    v_line_id := (v_line ->> 'lineId')::uuid;
    v_expected_version := (v_line ->> 'expectedVersion')::bigint;
    v_counted := (v_line ->> 'countedQuantity')::numeric;
    v_unit := v_line ->> 'unit';
    v_reason := btrim(coalesce(v_line ->> 'reason', ''));
    v_counted_at := (v_line ->> 'countedAt')::timestamptz;
    v_reviewed_at := (v_line ->> 'reviewedAt')::timestamptz;
    select coalesce(sum(case when sm.direction = 'in' then sm.quantity else -sm.quantity end), 0)
    into v_balance from public.stock_movements sm
    where sm.owner_id = v_owner and sm.business_id = p_business_id
      and sm.stock_class = v_stock_class and sm.stock_item_id = v_stock_item_id;
    v_variance := v_counted - v_balance;
    v_event_id := null;
    if v_variance <> 0 then
      v_event_id := (v_line ->> 'varianceEventId')::uuid;
      insert into public.stock_movements(
        owner_id, business_id, event_id, stock_class, stock_item_id, kind, direction,
        quantity, unit, source_type, source_id, related_event_id, reason, recorded_at, effective_at
      ) values (
        v_owner, p_business_id, v_event_id, v_stock_class, v_stock_item_id, 'count_adjustment',
        case when v_variance > 0 then 'in' else 'out' end, pg_catalog.abs(v_variance), v_unit,
        'stock_count', p_session_id, null, v_reason, pg_catalog.now(), v_reviewed_at
      );
      v_movement_count := v_movement_count + 1;
      v_event_ids := v_event_ids || pg_catalog.jsonb_build_array(v_event_id);
    else
      v_zero_variance_count := v_zero_variance_count + 1;
    end if;
    insert into public.stock_count_line_postings(
      owner_id, business_id, session_id, line_id, command_id, stock_class, stock_item_id,
      expected_version, system_quantity, counted_quantity, variance, unit, reason,
      movement_event_id, counted_at, reviewed_at
    ) values (
      v_owner, p_business_id, p_session_id, v_line_id, p_command_id, v_stock_class, v_stock_item_id,
      v_expected_version, v_balance, v_counted, v_variance, v_unit, v_reason,
      v_event_id, v_counted_at, v_reviewed_at
    );
    v_posted_line_ids := v_posted_line_ids || pg_catalog.jsonb_build_array(v_line_id);
  end loop;

  if p_complete_session then
    update public.stock_count_sessions set status = 'completed', completed_at = pg_catalog.now()
    where owner_id = v_owner and business_id = p_business_id and session_id = p_session_id;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'status', 'accepted',
    'commandId', p_command_id,
    'sessionId', p_session_id,
    'postedLineIds', v_posted_line_ids,
    'eventIds', v_event_ids,
    'movementCount', v_movement_count,
    'zeroVarianceCount', v_zero_variance_count,
    'sessionStatus', case when p_complete_session then 'completed' else 'open' end
  );
  update public.stock_count_commands set result = v_result, completed_at = pg_catalog.now()
  where owner_id = v_owner and command_id = p_command_id;
  return v_result;
end;
$$;
revoke all on function public.post_stock_count_subset(uuid, uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.post_stock_count_subset(uuid, uuid, uuid, jsonb, boolean) to authenticated;
comment on function public.post_stock_count_subset(uuid, uuid, uuid, jsonb, boolean) is
  'Atomically posts one reviewed stock-count subset using server versions, shared inventory serialization, append-only count audit, and idempotent retries.';
