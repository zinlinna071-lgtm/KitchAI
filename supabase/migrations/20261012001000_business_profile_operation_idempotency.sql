create table public.business_profile_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, operation_id)
);

comment on table public.business_profile_operations is
  'Private idempotency ledger for Business Profile writes. Results are returned only through the authenticated RPC.';

alter table public.business_profile_operations enable row level security;
revoke all on table public.business_profile_operations from anon, authenticated;

create or replace function public.apply_business_profile_operation(
  p_operation_id uuid,
  p_record_id uuid,
  p_operation text,
  p_base_revision bigint,
  p_name text
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
  v_profile public.business_profiles%rowtype;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_record_id is null then
    raise exception 'Operation and record IDs are required' using errcode = '22023';
  end if;
  if p_operation is null or p_operation not in ('create', 'update') then
    raise exception 'Unsupported Business Profile operation' using errcode = '22023';
  end if;
  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 80 then
    raise exception 'Business name must contain 1 to 80 characters' using errcode = '22023';
  end if;
  if (p_operation = 'create' and p_base_revision is not null)
    or (p_operation = 'update' and (p_base_revision is null or p_base_revision < 1)) then
    raise exception 'Invalid base revision for operation' using errcode = '22023';
  end if;

  -- Serialize writes per owner so concurrent retries observe the same idempotency result.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 0));

  v_request := pg_catalog.jsonb_build_object(
    'recordId', p_record_id,
    'operation', p_operation,
    'baseRevision', p_base_revision,
    'name', pg_catalog.btrim(p_name)
  );

  select request, result
    into v_existing_request, v_result
    from public.business_profile_operations
    where owner_id = v_owner and operation_id = p_operation_id;

  if found then
    if v_existing_request is distinct from v_request then
      raise exception 'Idempotency key reused with a different request' using errcode = '22023';
    end if;
    return v_result;
  end if;

  if p_operation = 'create' then
    select * into v_profile
      from public.business_profiles
      where owner_id = v_owner
      for update;

    if found then
      -- A device may create a local draft while offline before it knows that this
      -- owner already has a remote profile. Preserve both candidates for review.
      v_result := pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'remoteProfile', pg_catalog.to_jsonb(v_profile)
      );
    else
      insert into public.business_profiles (id, name)
        values (p_record_id, pg_catalog.btrim(p_name))
        returning * into v_profile;
      v_result := pg_catalog.jsonb_build_object(
        'status', 'accepted',
        'profile', pg_catalog.to_jsonb(v_profile)
      );
    end if;
  else
    select * into v_profile
      from public.business_profiles
      where id = p_record_id and owner_id = v_owner
      for update;

    if not found then
      raise exception 'Profile not found or not owned by caller' using errcode = '42501';
    end if;

    if v_profile.revision <> p_base_revision then
      v_result := pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'remoteProfile', pg_catalog.to_jsonb(v_profile)
      );
    else
      update public.business_profiles
        set name = pg_catalog.btrim(p_name)
        where id = p_record_id and owner_id = v_owner
        returning * into v_profile;
      v_result := pg_catalog.jsonb_build_object(
        'status', 'accepted',
        'profile', pg_catalog.to_jsonb(v_profile)
      );
    end if;
  end if;

  insert into public.business_profile_operations (owner_id, operation_id, request, result)
    values (v_owner, p_operation_id, v_request, v_result);

  return v_result;
end;
$$;

revoke all on function public.apply_business_profile_operation(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.apply_business_profile_operation(uuid, uuid, text, bigint, text) to authenticated;
