-- WP3.2 trusted atomic inventory command boundary.
-- All inventory ledger writes go through this SECURITY DEFINER function. The
-- caller's owner identity is derived from auth.uid(); client-supplied owner IDs
-- are deliberately not accepted.
create unique index if not exists finished_lots_one_lot_per_output_idx
  on public.finished_lots(owner_id, business_id, output_event_id);

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

comment on function public.apply_inventory_command(uuid, uuid, text, jsonb) is
  'WP3.2 atomic inventory ledger command; derives owner from auth.uid(), rejects negative stock, and is idempotent per owner/command ID.';
