-- WP3.5b server-authoritative per-item versioning and serialized inventory writes.
-- Stock movements remain the source of truth; this table is a concurrency token only.
create table public.stock_item_versions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  stock_class text not null check (stock_class in ('ingredient', 'finished')),
  stock_item_id uuid not null,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, business_id, stock_class, stock_item_id),
  constraint stock_item_versions_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade
);
alter table public.stock_item_versions enable row level security;
revoke all on public.stock_item_versions from public, anon, authenticated;
comment on table public.stock_item_versions is
  'Server-only monotonic concurrency token per owner/business/stock item; not a stock balance or ledger replacement.';

-- Existing ledger rows seed each item's initial token. Each subsequent inserted
-- movement advances the token once. The migration is additive and preserves all
-- existing stock movements and lot allocations.
insert into public.stock_item_versions (
  owner_id, business_id, stock_class, stock_item_id, version
)
select sm.owner_id, sm.business_id, sm.stock_class, sm.stock_item_id, count(*)::bigint
from public.stock_movements sm
group by sm.owner_id, sm.business_id, sm.stock_class, sm.stock_item_id
on conflict (owner_id, business_id, stock_class, stock_item_id) do nothing;

create or replace function public.bump_stock_item_version_after_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock_item_versions (
    owner_id, business_id, stock_class, stock_item_id, version, updated_at
  ) values (
    new.owner_id, new.business_id, new.stock_class, new.stock_item_id, 1, pg_catalog.now()
  )
  on conflict (owner_id, business_id, stock_class, stock_item_id)
  do update set
    version = public.stock_item_versions.version + 1,
    updated_at = pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.bump_stock_item_version_after_movement() from public, anon, authenticated;

create trigger stock_movements_bump_item_version
after insert on public.stock_movements
for each row execute function public.bump_stock_item_version_after_movement();

create or replace function public.apply_inventory_command(
  p_command_id uuid,
  p_business_id uuid,
  p_command_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_request jsonb;
  v_existing_request jsonb;
  v_result jsonb;
  v_movements jsonb;
  v_lots jsonb;
  v_allocations jsonb;
  v_item jsonb;
  v_movement public.stock_movements%rowtype;
  v_original public.stock_movements%rowtype;
  v_lot public.finished_lots%rowtype;
  v_quantity numeric(24,6);
  v_balance numeric(24,6);
  v_lot_remaining numeric(24,6);
  v_command_event_ids jsonb := '[]'::jsonb;
  v_lock_item record;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_command_id is null or p_business_id is null then
    raise exception 'Command and business IDs are required' using errcode = '22023';
  end if;
  if p_command_type is null or p_command_type not in ('inventory_adjustment', 'stock_receipt', 'stock_movement', 'correction') then
    raise exception 'Unsupported inventory command type' using errcode = '22023';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Inventory payload must be an object' using errcode = '22023';
  end if;

  v_movements := p_payload -> 'movements';
  v_lots := coalesce(p_payload -> 'lots', '[]'::jsonb);
  v_allocations := coalesce(p_payload -> 'allocations', '[]'::jsonb);
  if v_movements is null or pg_catalog.jsonb_typeof(v_movements) is distinct from 'array'
     or v_lots is null or pg_catalog.jsonb_typeof(v_lots) is distinct from 'array'
     or v_allocations is null or pg_catalog.jsonb_typeof(v_allocations) is distinct from 'array' then
    raise exception 'Inventory command has invalid movement, lot, or allocation arrays' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(v_movements) < 1
     or pg_catalog.jsonb_array_length(v_movements) > 200
     or pg_catalog.jsonb_array_length(v_lots) > 200
     or pg_catalog.jsonb_array_length(v_allocations) > 500 then
    raise exception 'Inventory command has invalid movement, lot, or allocation arrays' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.business_profiles bp
    where bp.owner_id = v_owner and bp.business_id = p_business_id
  ) then
    raise exception 'Business not found or not owned by caller' using errcode = '42501';
  end if;

  -- Serialize commands per owner/business. This protects idempotency and the
  -- non-negative balance invariant from concurrent posting attempts.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text, 0)
  );

  v_request := pg_catalog.jsonb_build_object(
    'businessId', p_business_id,
    'commandType', p_command_type,
    'payload', p_payload
  );

  select request, result into v_existing_request, v_result
    from public.inventory_commands
    where owner_id = v_owner and operation_id = p_command_id
    for update;
  if found then
    if v_existing_request is distinct from v_request then
      raise exception 'Idempotency key reused with a different request' using errcode = '22023';
    end if;
    if v_result is null then
      raise exception 'Inventory command has an incomplete prior result' using errcode = '55000';
    end if;
    return v_result;
  end if;

  -- Lock all stock items in a deterministic order before writing any movement.
  -- Every current writer uses this RPC; the ledger trigger below also serializes
  -- any trusted insert that reaches the canonical ledger by another path.
  for v_lock_item in
    select distinct
      entry.value ->> 'stockClass' as stock_class,
      (entry.value ->> 'stockItemId')::uuid as stock_item_id
    from pg_catalog.jsonb_array_elements(v_movements) as entry(value)
    order by 1, 2
  loop
    insert into public.stock_item_versions (
      owner_id, business_id, stock_class, stock_item_id, version
    ) values (
      v_owner, p_business_id, v_lock_item.stock_class, v_lock_item.stock_item_id, 0
    ) on conflict (owner_id, business_id, stock_class, stock_item_id) do nothing;

    perform 1
      from public.stock_item_versions siv
      where siv.owner_id = v_owner
        and siv.business_id = p_business_id
        and siv.stock_class = v_lock_item.stock_class
        and siv.stock_item_id = v_lock_item.stock_item_id
      for update;
  end loop;

  -- Insert movements one at a time in payload order, checking the projected
  -- balance after each movement. Any error rolls the entire function call back.
  for v_item in
    select entry.value
    from pg_catalog.jsonb_array_elements(v_movements) with ordinality as entry(value, position)
    order by entry.position
  loop
    if pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'string'
       or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+([.][0-9]{1,6})?$' then
      raise exception 'Inventory quantity must be a plain decimal string with at most six fractional digits'
        using errcode = '22023';
    end if;
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity <= 0 or v_quantity >= 'Infinity'::numeric then
      raise exception 'Inventory quantity must be positive and finite' using errcode = '22023';
    end if;
    if v_item ->> 'kind' in ('correction', 'reversal') then
      select * into v_original
        from public.stock_movements sm
        where sm.owner_id = v_owner and sm.business_id = p_business_id
          and sm.event_id = (v_item ->> 'relatedEventId')::uuid;
      if not found
         or v_original.stock_class <> v_item ->> 'stockClass'
         or v_original.stock_item_id <> (v_item ->> 'stockItemId')::uuid
         or v_original.unit <> v_item ->> 'unit'
         or v_original.direction = v_item ->> 'direction'
         or v_original.quantity <> v_quantity
         or exists (
           select 1 from public.stock_movements prior_link
           where prior_link.owner_id = v_owner
             and prior_link.business_id = p_business_id
             and prior_link.related_event_id = v_original.event_id
             and prior_link.kind in ('correction', 'reversal')
         ) then
        raise exception 'Reversal or correction must exactly reverse one linked event for the same item and unit'
          using errcode = '23514';
      end if;
    end if;

    if exists (
      select 1 from public.stock_movements sm
      where sm.owner_id = v_owner and sm.business_id = p_business_id
        and sm.stock_class = v_item ->> 'stockClass'
        and sm.stock_item_id = (v_item ->> 'stockItemId')::uuid
        and sm.unit <> v_item ->> 'unit'
    ) then
      raise exception 'Stock unit mismatch for item; automatic unit conversion is not enabled'
        using errcode = '23514';
    end if;

    insert into public.stock_movements (
      owner_id, business_id, event_id, stock_class, stock_item_id, kind, direction,
      quantity, unit, source_type, source_id, related_event_id, reason, recorded_at, effective_at
    ) values (
      v_owner, p_business_id, (v_item ->> 'eventId')::uuid,
      v_item ->> 'stockClass', (v_item ->> 'stockItemId')::uuid, v_item ->> 'kind',
      v_item ->> 'direction', v_quantity, v_item ->> 'unit', v_item ->> 'sourceType',
      (v_item ->> 'sourceId')::uuid, nullif(v_item ->> 'relatedEventId', '')::uuid,
      nullif(v_item ->> 'reason', ''),
      coalesce(nullif(v_item ->> 'recordedAt', '')::timestamptz, pg_catalog.now()),
      coalesce(nullif(v_item ->> 'effectiveAt', '')::timestamptz, pg_catalog.now())
    ) returning * into v_movement;

    v_command_event_ids := v_command_event_ids || pg_catalog.jsonb_build_array(v_movement.event_id);

    if v_movement.direction = 'out' then
      select coalesce(sum(case when sm.direction = 'in' then sm.quantity else -sm.quantity end), 0)
        into v_balance
        from public.stock_movements sm
        where sm.owner_id = v_owner and sm.business_id = p_business_id
          and sm.stock_class = v_movement.stock_class and sm.stock_item_id = v_movement.stock_item_id;
      if v_balance < 0 then
        raise exception 'Insufficient stock; negative stock is not allowed' using errcode = '23514';
      end if;
    end if;
  end loop;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_lots)
  loop
    if pg_catalog.jsonb_typeof(v_item -> 'producedQuantity') is distinct from 'string'
       or coalesce(v_item ->> 'producedQuantity', '') !~ '^[0-9]+([.][0-9]{1,6})?$' then
      raise exception 'Lot quantity must be a plain decimal string with at most six fractional digits'
        using errcode = '22023';
    end if;
    insert into public.finished_lots (
      owner_id, business_id, lot_id, menu_item_id, batch_id, output_event_id,
      produced_quantity, unit, produced_at
    ) values (
      v_owner, p_business_id, (v_item ->> 'lotId')::uuid, (v_item ->> 'menuItemId')::uuid,
      (v_item ->> 'batchId')::uuid, (v_item ->> 'outputEventId')::uuid,
      (v_item ->> 'producedQuantity')::numeric, v_item ->> 'unit',
      coalesce(nullif(v_item ->> 'producedAt', '')::timestamptz, pg_catalog.now())
    ) returning * into v_lot;
  end loop;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_allocations)
  loop
    if pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'string'
       or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+([.][0-9]{1,6})?$' then
      raise exception 'Allocation quantity must be a plain decimal string with at most six fractional digits'
        using errcode = '22023';
    end if;
    v_quantity := (v_item ->> 'quantity')::numeric;
    insert into public.stock_movement_lot_allocations (
      owner_id, business_id, event_id, lot_id, quantity, unit
    ) values (
      v_owner, p_business_id, (v_item ->> 'eventId')::uuid, (v_item ->> 'lotId')::uuid,
      v_quantity, v_item ->> 'unit'
    );
    select fl.produced_quantity - coalesce(sum(smla.quantity), 0)
      into v_lot_remaining
      from public.finished_lots fl
      left join public.stock_movement_lot_allocations smla
        on smla.owner_id = fl.owner_id and smla.business_id = fl.business_id and smla.lot_id = fl.lot_id
      where fl.owner_id = v_owner and fl.business_id = p_business_id
        and fl.lot_id = (v_item ->> 'lotId')::uuid
      group by fl.produced_quantity;
    if v_lot_remaining < 0 then
      raise exception 'Finished lot has insufficient remaining quantity' using errcode = '23514';
    end if;
  end loop;

  -- A production output is not complete unless its finished lot is part
  -- of the same atomic command.
  for v_item in select value from pg_catalog.jsonb_array_elements(v_movements)
  loop
    if v_item ->> 'kind' = 'production_output'
       and not exists (
         select 1 from public.finished_lots fl
         where fl.owner_id = v_owner and fl.business_id = p_business_id
           and fl.output_event_id = (v_item ->> 'eventId')::uuid
       ) then
      raise exception 'Production output must include its finished lot in the same command'
        using errcode = '23514';
    end if;
    if v_item ->> 'stockClass' = 'finished' and v_item ->> 'direction' = 'out' then
      select coalesce(sum(smla.quantity), 0) into v_balance
        from public.stock_movement_lot_allocations smla
        where smla.owner_id = v_owner and smla.business_id = p_business_id
          and smla.event_id = (v_item ->> 'eventId')::uuid;
      if v_balance <> (v_item ->> 'quantity')::numeric then
        raise exception 'Finished-stock reduction must be allocated exactly across lots'
          using errcode = '23514';
      end if;
    end if;
  end loop;

  v_result := pg_catalog.jsonb_build_object(
    'status', 'accepted',
    'commandId', p_command_id,
    'movementCount', pg_catalog.jsonb_array_length(v_movements),
    'lotCount', pg_catalog.jsonb_array_length(v_lots),
    'allocationCount', pg_catalog.jsonb_array_length(v_allocations),
    'eventIds', v_command_event_ids
  );

  insert into public.inventory_commands (
    owner_id, business_id, operation_id, request, result, completed_at
  ) values (
    v_owner, p_business_id, p_command_id, v_request, v_result, pg_catalog.now()
  );

  return v_result;
end;
$$;

revoke all on function public.apply_inventory_command(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.apply_inventory_command(uuid, uuid, text, jsonb) to authenticated;

-- Read the current ledger balance and version under the same per-item lock.
-- An in-flight movement either commits before this snapshot (both balance and
-- version include it) or advances the version after the snapshot (making it stale).
create or replace function public.get_inventory_item_snapshot(
  p_business_id uuid,
  p_stock_class text,
  p_stock_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_version bigint;
  v_balance numeric(24,6);
  v_unit text;
  v_unit_count bigint;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_business_id is null or p_stock_item_id is null or p_stock_class is null
     or p_stock_class not in ('ingredient', 'finished') then
    raise exception 'Valid business, stock class, and stock item are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.business_profiles bp
    where bp.owner_id = v_owner and bp.business_id = p_business_id
  ) then
    raise exception 'Business not found or not owned by caller' using errcode = '42501';
  end if;

  if p_stock_class = 'ingredient' and not exists (
    select 1 from public.ingredients i
    where i.owner_id = v_owner and i.business_id = p_business_id and i.id = p_stock_item_id
  ) then
    raise exception 'Stock item not found or not owned by caller' using errcode = '42501';
  elsif p_stock_class = 'finished' and not exists (
    select 1 from public.menu_items mi
    where mi.owner_id = v_owner and mi.business_id = p_business_id and mi.id = p_stock_item_id
  ) then
    raise exception 'Stock item not found or not owned by caller' using errcode = '42501';
  end if;

  insert into public.stock_item_versions (
    owner_id, business_id, stock_class, stock_item_id, version
  ) values (v_owner, p_business_id, p_stock_class, p_stock_item_id, 0)
  on conflict (owner_id, business_id, stock_class, stock_item_id) do nothing;

  select siv.version into v_version
  from public.stock_item_versions siv
  where siv.owner_id = v_owner and siv.business_id = p_business_id
    and siv.stock_class = p_stock_class and siv.stock_item_id = p_stock_item_id
  for update;

  select
    coalesce(sum(case when sm.direction = 'in' then sm.quantity else -sm.quantity end), 0),
    min(sm.unit),
    count(distinct sm.unit)
  into v_balance, v_unit, v_unit_count
  from public.stock_movements sm
  where sm.owner_id = v_owner and sm.business_id = p_business_id
    and sm.stock_class = p_stock_class and sm.stock_item_id = p_stock_item_id;

  if v_unit_count > 1 then
    raise exception 'Stock item has inconsistent units in its ledger' using errcode = '23514';
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'snapshot',
    'stockClass', p_stock_class,
    'stockItemId', p_stock_item_id,
    'version', v_version::text,
    'systemQuantity', v_balance::text,
    'unit', v_unit
  );
end;
$$;
revoke all on function public.get_inventory_item_snapshot(uuid, text, uuid) from public, anon;
grant execute on function public.get_inventory_item_snapshot(uuid, text, uuid) to authenticated;

comment on function public.get_inventory_item_snapshot(uuid, text, uuid) is
  'WP3.5b server-authoritative balance/version snapshot for one owner-scoped stock item; no stock mutation.';
