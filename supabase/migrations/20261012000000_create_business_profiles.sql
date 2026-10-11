create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  constraint business_profiles_one_per_owner unique (owner_id)
);

comment on table public.business_profiles is
  'Minimal Phase 1 Business Profile. Owner and revision are server-controlled; client drafts remain local until authenticated.';

create or replace function public.enforce_business_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authenticated owner required' using errcode = '42501';
  end if;

  new.name := pg_catalog.btrim(new.name);

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.business_id := pg_catalog.gen_random_uuid();
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();
    new.revision := 1;
  else
    if old.owner_id is distinct from auth.uid() then
      raise exception 'Cannot change a profile owned by another user' using errcode = '42501';
    end if;
    new.owner_id := old.owner_id;
    new.business_id := old.business_id;
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.now();
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_business_profile_fields() from public;

create trigger business_profiles_enforce_fields
before insert or update on public.business_profiles
for each row execute function public.enforce_business_profile_fields();

alter table public.business_profiles enable row level security;

create policy "Owners read their own business profile"
on public.business_profiles for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners insert their own business profile"
on public.business_profiles for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners update their own business profile"
on public.business_profiles for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

revoke all on table public.business_profiles from anon, authenticated;
grant select, insert, update on table public.business_profiles to authenticated;
