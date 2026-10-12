-- Phase 2 remote entities. Apply only to isolated local Supabase until hosted
-- environment and cost boundaries are explicitly approved.
alter table public.business_profiles
  add constraint business_profiles_owner_business_unique unique (owner_id, business_id);

create table public.ingredients (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint ingredients_description_length check (description is null or char_length(description) <= 2000),
  constraint ingredients_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint ingredients_owner_business_id_unique unique (owner_id, business_id, id)
);

create table public.menu_items (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint menu_items_description_length check (description is null or char_length(description) <= 2000),
  constraint menu_items_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint menu_items_owner_business_id_unique unique (owner_id, business_id, id)
);

create table public.recipes (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  menu_item_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  instructions text,
  yield_portions numeric,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint recipes_description_length check (description is null or char_length(description) <= 2000),
  constraint recipes_instructions_length check (instructions is null or char_length(instructions) <= 10000),
  constraint recipes_yield_positive check (yield_portions is null or (yield_portions > 0 and yield_portions < 'Infinity'::numeric)),
  constraint recipes_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint recipes_menu_item_same_business_fk foreign key (owner_id, business_id, menu_item_id)
    references public.menu_items(owner_id, business_id, id),
  constraint recipes_owner_business_id_unique unique (owner_id, business_id, id)
);

create unique index recipes_one_current_per_menu_item
  on public.recipes(owner_id, business_id, menu_item_id)
  where status <> 'archived';

create table public.recipe_lines (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  recipe_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric not null check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'each')),
  position integer not null check (position >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint recipe_lines_note_length check (note is null or char_length(note) <= 500),
  constraint recipe_lines_owner_business_fk foreign key (owner_id, business_id)
    references public.business_profiles(owner_id, business_id) on delete cascade,
  constraint recipe_lines_recipe_same_business_fk foreign key (owner_id, business_id, recipe_id)
    references public.recipes(owner_id, business_id, id),
  constraint recipe_lines_ingredient_same_business_fk foreign key (owner_id, business_id, ingredient_id)
    references public.ingredients(owner_id, business_id, id),
  constraint recipe_lines_owner_business_id_unique unique (owner_id, business_id, id)
);

create index ingredients_business_status_idx on public.ingredients(owner_id, business_id, status);
create index menu_items_business_status_idx on public.menu_items(owner_id, business_id, status);
create index recipes_business_status_idx on public.recipes(owner_id, business_id, status);
create index recipe_lines_recipe_position_idx on public.recipe_lines(owner_id, business_id, recipe_id, position);

comment on table public.ingredients is 'Phase 2 ingredient catalog; owner/business scope is server-derived.';
comment on table public.menu_items is 'Phase 2 menu items; archive instead of hard delete.';
comment on table public.recipes is 'Phase 2 recipes; at most one non-archived recipe per menu item.';
comment on table public.recipe_lines is 'Phase 2 recipe ingredient lines; units are identifiers, not conversion instructions.';

alter table public.ingredients enable row level security;
alter table public.menu_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_lines enable row level security;

create policy "Owners read their ingredients" on public.ingredients
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners read their menu items" on public.menu_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners read their recipes" on public.recipes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners read their recipe lines" on public.recipe_lines
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.ingredients, public.menu_items, public.recipes, public.recipe_lines from anon, authenticated;
grant select on table public.ingredients, public.menu_items, public.recipes, public.recipe_lines to authenticated;

create table public.phase2_entity_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, operation_id)
);
alter table public.phase2_entity_operations enable row level security;
revoke all on table public.phase2_entity_operations from anon, authenticated;

create or replace function public.apply_phase2_entity_operation(
  p_operation_id uuid,
  p_entity_type text,
  p_record_id uuid,
  p_operation text,
  p_base_revision bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_business uuid;
  v_request jsonb;
  v_existing_request jsonb;
  v_result jsonb;
  v_row jsonb;
  v_revision bigint;
  v_status text;
  v_name text;
  v_description text;
  v_instructions text;
  v_menu_item uuid;
  v_recipe uuid;
  v_ingredient uuid;
  v_quantity numeric;
  v_yield numeric;
  v_unit text;
  v_position integer;
  v_note text;
  v_line_count bigint;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_record_id is null then
    raise exception 'Operation and record IDs are required' using errcode = '22023';
  end if;
  if p_entity_type not in ('ingredient', 'menu_item', 'recipe', 'recipe_line') then
    raise exception 'Unsupported Phase 2 entity type' using errcode = '22023';
  end if;
  if p_operation not in ('create', 'update', 'archive') then
    raise exception 'Unsupported Phase 2 operation' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Payload must be a JSON object' using errcode = '22023';
  end if;
  if (p_operation = 'create' and p_base_revision is not null)
     or (p_operation in ('update', 'archive') and (p_base_revision is null or p_base_revision < 1)) then
    raise exception 'Invalid base revision for operation' using errcode = '22023';
  end if;
  if p_entity_type = 'recipe_line' and p_operation = 'archive' then
    raise exception 'Recipe line deletion is not supported; preserve the record' using errcode = '22023';
  end if;

  select business_id into v_business
    from public.business_profiles where owner_id = v_owner for update;
  if not found then
    raise exception 'Business profile not found for authenticated owner' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'entityType', p_entity_type, 'recordId', p_record_id,
    'operation', p_operation, 'baseRevision', p_base_revision, 'payload', p_payload
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  select request, result into v_existing_request, v_result
    from public.phase2_entity_operations
    where owner_id = v_owner and operation_id = p_operation_id;
  if found then
    if v_existing_request is distinct from v_request then
      raise exception 'Idempotency key reused with a different request' using errcode = '22023';
    end if;
    return v_result;
  end if;

  if p_operation <> 'create' then
    case p_entity_type
      when 'ingredient' then
        select revision into v_revision from public.ingredients
          where id = p_record_id and owner_id = v_owner and business_id = v_business for update;
      when 'menu_item' then
        select revision into v_revision from public.menu_items
          where id = p_record_id and owner_id = v_owner and business_id = v_business for update;
      when 'recipe' then
        select revision into v_revision from public.recipes
          where id = p_record_id and owner_id = v_owner and business_id = v_business for update;
      when 'recipe_line' then
        select revision into v_revision from public.recipe_lines
          where id = p_record_id and owner_id = v_owner and business_id = v_business for update;
    end case;
    if not found then
      raise exception 'Record not found or not owned by caller' using errcode = '42501';
    end if;
    if v_revision <> p_base_revision then
      case p_entity_type
        when 'ingredient' then select to_jsonb(t) into v_row from public.ingredients t where id=p_record_id and owner_id=v_owner;
        when 'menu_item' then select to_jsonb(t) into v_row from public.menu_items t where id=p_record_id and owner_id=v_owner;
        when 'recipe' then select to_jsonb(t) into v_row from public.recipes t where id=p_record_id and owner_id=v_owner;
        when 'recipe_line' then select to_jsonb(t) into v_row from public.recipe_lines t where id=p_record_id and owner_id=v_owner;
      end case;
      v_result := pg_catalog.jsonb_build_object('status','conflict','remoteRecord',v_row);
      insert into public.phase2_entity_operations(owner_id,operation_id,request,result)
        values(v_owner,p_operation_id,v_request,v_result);
      return v_result;
    end if;
  end if;

  if p_operation = 'archive' then
    if p_entity_type not in ('ingredient', 'menu_item', 'recipe') then
      raise exception 'Archive is not supported for this entity' using errcode = '22023';
    end if;
    if p_entity_type = 'ingredient' then
      update public.ingredients set status='archived', updated_at=pg_catalog.now(), revision=revision+1
        where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(ingredients) into v_row;
    elsif p_entity_type = 'menu_item' then
      update public.menu_items set status='archived', updated_at=pg_catalog.now(), revision=revision+1
        where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(menu_items) into v_row;
    else
      update public.recipes set status='archived', updated_at=pg_catalog.now(), revision=revision+1
        where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(recipes) into v_row;
    end if;
  else
    if p_entity_type in ('ingredient','menu_item','recipe') then
      v_name := pg_catalog.btrim(p_payload->>'name');
      v_description := nullif(pg_catalog.btrim(p_payload->>'description'), '');
      v_status := coalesce(p_payload->>'status', case when p_entity_type='recipe' then 'draft' else 'active' end);
      if v_name is null or pg_catalog.char_length(v_name) > 120 then
        raise exception 'Name must contain 1 to 120 characters' using errcode = '22023';
      end if;
      if v_description is not null and pg_catalog.char_length(v_description) > 2000 then
        raise exception 'Description must not exceed 2000 characters' using errcode = '22023';
      end if;
      if p_entity_type in ('ingredient','menu_item') and v_status not in ('active','archived') then
        raise exception 'Invalid entity status' using errcode = '22023';
      end if;
      if p_entity_type='recipe' and v_status not in ('draft','active','archived') then
        raise exception 'Invalid recipe status' using errcode = '22023';
      end if;

      if p_entity_type='ingredient' then
        if p_operation='create' then
          insert into public.ingredients(id,owner_id,business_id,name,description,status)
            values(p_record_id,v_owner,v_business,v_name,v_description,v_status) returning to_jsonb(ingredients) into v_row;
        else
          update public.ingredients set name=v_name,description=v_description,status=v_status,updated_at=pg_catalog.now(),revision=revision+1
            where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(ingredients) into v_row;
        end if;
      elsif p_entity_type='menu_item' then
        if p_operation='create' then
          insert into public.menu_items(id,owner_id,business_id,name,description,status)
            values(p_record_id,v_owner,v_business,v_name,v_description,v_status) returning to_jsonb(menu_items) into v_row;
        else
          update public.menu_items set name=v_name,description=v_description,status=v_status,updated_at=pg_catalog.now(),revision=revision+1
            where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(menu_items) into v_row;
        end if;
      else
        begin
          v_menu_item := nullif(p_payload->>'menuItemId','')::uuid;
        exception when others then
          raise exception 'menuItemId must be a UUID' using errcode = '22023';
        end;
        if v_menu_item is null then raise exception 'menuItemId is required' using errcode = '22023'; end if;
        begin
          v_yield := nullif(p_payload->>'yieldPortions','')::numeric;
        exception when others then
          raise exception 'yieldPortions must be numeric' using errcode = '22023';
        end;
        v_instructions := nullif(p_payload->>'instructions','');
        if v_instructions is not null and pg_catalog.char_length(v_instructions)>10000 then
          raise exception 'Instructions must not exceed 10000 characters' using errcode = '22023';
        end if;
        if v_yield is not null and not (v_yield > 0 and v_yield < 'Infinity'::numeric) then
          raise exception 'yieldPortions must be finite and positive' using errcode = '22023';
        end if;
        if v_status='active' and (v_yield is null or v_yield <= 0) then
          raise exception 'An active recipe requires a positive yield' using errcode = '22023';
        end if;
        perform 1 from public.menu_items
          where id=v_menu_item and owner_id=v_owner and business_id=v_business;
        if not found then raise exception 'Menu item not found in this business' using errcode = '42501'; end if;
        if v_status='active' then
          select count(*) into v_line_count from public.recipe_lines
            where recipe_id=p_record_id and owner_id=v_owner and business_id=v_business;
          if v_line_count=0 then raise exception 'An active recipe requires at least one ingredient line' using errcode = '22023'; end if;
        end if;
        if p_operation='create' then
          insert into public.recipes(id,owner_id,business_id,menu_item_id,name,description,instructions,yield_portions,status)
            values(p_record_id,v_owner,v_business,v_menu_item,v_name,v_description,v_instructions,v_yield,v_status)
            returning to_jsonb(recipes) into v_row;
        else
          update public.recipes set menu_item_id=v_menu_item,name=v_name,description=v_description,instructions=v_instructions,
            yield_portions=v_yield,status=v_status,updated_at=pg_catalog.now(),revision=revision+1
            where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(recipes) into v_row;
        end if;
      end if;
    else
      begin
        v_recipe := nullif(p_payload->>'recipeId','')::uuid;
        v_ingredient := nullif(p_payload->>'ingredientId','')::uuid;
        v_quantity := nullif(p_payload->>'quantity','')::numeric;
        v_position := nullif(p_payload->>'position','')::integer;
      exception when others then
        raise exception 'Recipe line references, quantity, and position must be valid' using errcode = '22023';
      end;
      v_unit := p_payload->>'unit';
      v_note := nullif(p_payload->>'note','');
      if v_recipe is null or v_ingredient is null then raise exception 'recipeId and ingredientId are required' using errcode = '22023'; end if;
      if v_quantity is null or not (v_quantity > 0 and v_quantity < 'Infinity'::numeric) then
        raise exception 'Quantity must be finite and positive' using errcode = '22023';
      end if;
      if v_unit not in ('g','kg','ml','l','each') then raise exception 'Unsupported unit' using errcode = '22023'; end if;
      if v_position is null or v_position < 0 then raise exception 'Position must be a non-negative integer' using errcode = '22023'; end if;
      if v_note is not null and pg_catalog.char_length(v_note)>500 then raise exception 'Note must not exceed 500 characters' using errcode = '22023'; end if;
      perform 1 from public.recipes where id=v_recipe and owner_id=v_owner and business_id=v_business;
      if not found then raise exception 'Recipe not found in this business' using errcode = '42501'; end if;
      perform 1 from public.ingredients where id=v_ingredient and owner_id=v_owner and business_id=v_business
        and (status='active' or exists(select 1 from public.recipes r where r.id=v_recipe and r.status<>'active'));
      if not found then raise exception 'Ingredient not found, archived, or outside this business' using errcode = '42501'; end if;
      if p_operation='create' then
        insert into public.recipe_lines(id,owner_id,business_id,recipe_id,ingredient_id,quantity,unit,position,note)
          values(p_record_id,v_owner,v_business,v_recipe,v_ingredient,v_quantity,v_unit,v_position,v_note)
          returning to_jsonb(recipe_lines) into v_row;
      else
        update public.recipe_lines set recipe_id=v_recipe,ingredient_id=v_ingredient,quantity=v_quantity,unit=v_unit,
          position=v_position,note=v_note,updated_at=pg_catalog.now(),revision=revision+1
          where id=p_record_id and owner_id=v_owner and business_id=v_business returning to_jsonb(recipe_lines) into v_row;
      end if;
    end if;
  end if;

  v_result := pg_catalog.jsonb_build_object('status','accepted','record',v_row);
  insert into public.phase2_entity_operations(owner_id,operation_id,request,result)
    values(v_owner,p_operation_id,v_request,v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_phase2_entity_operation(uuid,text,uuid,text,bigint,jsonb) from public, anon;
grant execute on function public.apply_phase2_entity_operation(uuid,text,uuid,text,bigint,jsonb) to authenticated;
