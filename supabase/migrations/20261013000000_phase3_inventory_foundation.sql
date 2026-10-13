-- WP3.1 inventory data foundation. Write access is intentionally reserved for a
-- future trusted aggregate RPC; clients must not upsert stock events directly.
create table public.inventory_commands (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  primary key (owner_id, operation_id),
  constraint inventory_commands_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint inventory_commands_completion_pair check ((result is null) = (completed_at is null))
);
comment on table public.inventory_commands is
  'WP3.1 idempotency foundation. Only a future trusted atomic inventory RPC may write this table.';

create table public.stock_movements (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  event_id uuid not null,
  stock_class text not null check (stock_class in ('ingredient', 'finished')),
  stock_item_id uuid not null,
  kind text not null check (kind in (
    'opening_balance', 'purchase_receipt', 'production_consumption', 'production_output',
    'owner_consumption', 'giveaway', 'waste', 'count_adjustment', 'correction', 'reversal'
  )),
  direction text not null check (direction in ('in', 'out')),
  quantity numeric(24,6) not null check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'each')),
  source_type text not null check (char_length(btrim(source_type)) between 1 and 80),
  source_id uuid not null,
  related_event_id uuid,
  reason text,
  recorded_at timestamptz not null,
  effective_at timestamptz not null,
  primary key (owner_id, business_id, event_id),
  constraint stock_movements_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint stock_movements_related_event_fk foreign key (owner_id, business_id, related_event_id)
    references public.stock_movements(owner_id, business_id, event_id),
  constraint stock_movements_kind_direction check (
    (kind in ('opening_balance', 'purchase_receipt', 'production_output') and direction = 'in')
    or (kind in ('production_consumption', 'owner_consumption', 'giveaway', 'waste') and direction = 'out')
    or kind in ('count_adjustment', 'correction', 'reversal')
  ),
  constraint stock_movements_linked_correction check (
    (kind not in ('correction', 'reversal') or related_event_id is not null)
  ),
  constraint stock_movements_finished_each_integral check (
    not (stock_class = 'finished' and unit = 'each') or quantity = trunc(quantity)
  ),
  constraint stock_movements_reason_required check (
    kind not in ('waste', 'count_adjustment', 'correction') or char_length(btrim(coalesce(reason, ''))) > 0
  )
);
create index stock_movements_by_item_idx
  on public.stock_movements(owner_id, business_id, stock_class, stock_item_id, recorded_at);
create index stock_movements_by_source_idx
  on public.stock_movements(owner_id, business_id, source_type, source_id);
comment on table public.stock_movements is
  'Canonical append-only stock ledger. On-hand balances are derived projections, never independently editable truth.';

create table public.finished_lots (
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  lot_id uuid not null,
  menu_item_id uuid not null,
  batch_id uuid not null,
  output_event_id uuid not null,
  produced_quantity numeric(24,6) not null check (produced_quantity > 0 and produced_quantity < 'Infinity'::numeric),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'each')),
  produced_at timestamptz not null,
  primary key (owner_id, business_id, lot_id),
  constraint finished_lots_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint finished_lots_menu_item_fk foreign key (owner_id, business_id, menu_item_id)
    references public.menu_items(owner_id, business_id, id),
  constraint finished_lots_output_event_fk foreign key (owner_id, business_id, output_event_id)
    references public.stock_movements(owner_id, business_id, event_id),
  constraint finished_lots_output_kind check (unit <> 'each' or produced_quantity = trunc(produced_quantity)
  )
);
create index finished_lots_by_menu_item_idx on public.finished_lots(owner_id, business_id, menu_item_id);
create index finished_lots_by_batch_idx on public.finished_lots(owner_id, business_id, batch_id);
comment on table public.finished_lots is
  'Immutable identity/traceability for finished output. Remaining quantity is derived from stock movements.';

create or replace function public.reject_stock_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Stock movements are append-only; record a linked correction or reversal'
    using errcode = '55000';
end;
$$;
revoke all on function public.reject_stock_movement_mutation() from public, anon, authenticated;
create trigger stock_movements_append_only
before update or delete on public.stock_movements
for each row execute function public.reject_stock_movement_mutation();

alter table public.inventory_commands enable row level security;
alter table public.stock_movements enable row level security;
alter table public.finished_lots enable row level security;

create policy "Owners read their inventory commands" on public.inventory_commands
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners read their stock movements" on public.stock_movements
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners read their finished lots" on public.finished_lots
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.inventory_commands, public.stock_movements, public.finished_lots from anon, authenticated;
grant select on table public.inventory_commands, public.stock_movements, public.finished_lots to authenticated;
