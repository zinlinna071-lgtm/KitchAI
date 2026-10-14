-- WP3.3.4: persist safety/suitability carry-forward decisions separately from stock.
-- A carry-forward event is an append-only handling record; it never changes on-hand quantity.
create table public.finished_lot_handling_events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  event_id uuid not null,
  lot_id uuid not null,
  handling_type text not null check (handling_type = 'carry_forward'),
  quantity numeric(24,6) not null check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'each')),
  carry_forward_date date not null,
  confirmed_at timestamptz not null,
  reason text,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, business_id, event_id),
  constraint finished_lot_handling_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint finished_lot_handling_lot_fk foreign key (owner_id, business_id, lot_id)
    references public.finished_lots(owner_id, business_id, lot_id),
  constraint finished_lot_handling_each_integral check (unit <> 'each' or quantity = trunc(quantity))
);
create index finished_lot_handling_by_lot_idx
  on public.finished_lot_handling_events(owner_id, business_id, lot_id, confirmed_at);

create or replace function public.record_finished_lot_carry_forward(
  p_event_id uuid,
  p_business_id uuid,
  p_lot_id uuid,
  p_quantity text,
  p_unit text,
  p_carry_forward_date date,
  p_confirmed_at timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_lot public.finished_lots%rowtype;
  v_quantity numeric(24,6);
  v_remaining numeric(24,6);
  v_existing public.finished_lot_handling_events%rowtype;
  v_result jsonb;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_event_id is null or p_business_id is null or p_lot_id is null
     or p_carry_forward_date is null or p_confirmed_at is null then
    raise exception 'Carry-forward event fields are required' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity !~ '^(0|[1-9][0-9]*)([.][0-9]{1,6})?$' then
    raise exception 'Carry-forward quantity must be a plain decimal string' using errcode = '22023';
  end if;
  v_quantity := p_quantity::numeric;
  if v_quantity <= 0 or v_quantity >= 'Infinity'::numeric then
    raise exception 'Carry-forward quantity must be positive and finite' using errcode = '22023';
  end if;
  if p_unit not in ('g', 'kg', 'ml', 'l', 'each')
     or (p_unit = 'each' and v_quantity <> trunc(v_quantity)) then
    raise exception 'Carry-forward unit or quantity is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.business_profiles bp
    where bp.owner_id = v_owner and bp.business_id = p_business_id
  ) then
    raise exception 'Business not found or not owned by caller' using errcode = '42501';
  end if;

  -- Serialize against inventory commands and retries for this owner, matching
  -- apply_inventory_command's advisory lock so the snapshot cannot race a sale.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 0));

  select * into v_existing
    from public.finished_lot_handling_events
   where owner_id = v_owner and business_id = p_business_id and event_id = p_event_id
   for update;
  if found then
    if v_existing.lot_id <> p_lot_id or v_existing.handling_type <> 'carry_forward'
       or v_existing.quantity <> v_quantity or v_existing.unit <> p_unit
       or v_existing.carry_forward_date <> p_carry_forward_date
       or v_existing.confirmed_at <> p_confirmed_at
       or v_existing.reason is distinct from v_reason then
      raise exception 'Carry-forward event ID reused with a different request' using errcode = '22023';
    end if;
    return v_existing.result;
  end if;

  select * into v_lot
    from public.finished_lots
   where owner_id = v_owner and business_id = p_business_id and lot_id = p_lot_id
   for update;
  if not found then
    raise exception 'Finished lot not found or not owned by caller' using errcode = '42501';
  end if;
  if v_lot.unit <> p_unit then
    raise exception 'Carry-forward unit must match finished lot' using errcode = '23514';
  end if;
  select v_lot.produced_quantity - coalesce(sum(a.quantity), 0)
    into v_remaining
    from public.stock_movement_lot_allocations a
   where a.owner_id = v_owner and a.business_id = p_business_id and a.lot_id = p_lot_id;
  -- Aggregate query always returns a row; the lot's output is immutable.
  if v_remaining <> v_quantity then
    raise exception 'Carry-forward quantity must equal current lot remaining quantity' using errcode = '23514';
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'status', 'accepted', 'eventId', p_event_id, 'businessId', p_business_id,
    'lotId', p_lot_id, 'handlingType', 'carry_forward',
    'quantity', p_quantity, 'unit', p_unit,
    'carryForwardDate', p_carry_forward_date, 'confirmedAt', p_confirmed_at,
    'reason', v_reason, 'inventoryEffect', 'none'
  );
  insert into public.finished_lot_handling_events
    (owner_id, business_id, event_id, lot_id, handling_type, quantity, unit,
     carry_forward_date, confirmed_at, reason, result)
  values
    (v_owner, p_business_id, p_event_id, p_lot_id, 'carry_forward', v_quantity, p_unit,
     p_carry_forward_date, p_confirmed_at, v_reason, v_result);
  return v_result;
end;
$$;

create or replace function public.reject_finished_lot_handling_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Finished-lot handling events are append-only' using errcode = '55000';
end;
$$;
revoke all on function public.reject_finished_lot_handling_mutation() from public, anon, authenticated;
create trigger finished_lot_handling_events_append_only
before update or delete on public.finished_lot_handling_events
for each row execute function public.reject_finished_lot_handling_mutation();

alter table public.finished_lot_handling_events enable row level security;
create policy "Owners read their finished-lot handling events"
  on public.finished_lot_handling_events for select to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on table public.finished_lot_handling_events from anon, authenticated;
grant select on table public.finished_lot_handling_events to authenticated;
revoke all on function public.record_finished_lot_carry_forward(uuid,uuid,uuid,text,text,date,timestamptz,text)
  from public, anon;
grant execute on function public.record_finished_lot_carry_forward(uuid,uuid,uuid,text,text,date,timestamptz,text)
  to authenticated;
