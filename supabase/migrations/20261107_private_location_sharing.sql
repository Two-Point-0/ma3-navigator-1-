-- Opt-in, pair-only current-location sharing for the user's own devices/testers.
-- This stores only the latest point (not a location history). A share token is returned once;
-- only its hash is stored. Either paired user can revoke the connection.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ma3_location_share_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_sha256 text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_by is null or accepted_by <> owner_id)
);
create index if not exists ma3_location_invites_owner_idx
  on public.ma3_location_share_invites(owner_id, created_at desc);
alter table public.ma3_location_share_invites enable row level security;
revoke all on public.ma3_location_share_invites from public, anon, authenticated;

create table if not exists public.ma3_location_share_pairs (
  id uuid primary key default extensions.gen_random_uuid(),
  member_one uuid not null references auth.users(id) on delete cascade,
  member_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_one <> member_two),
  check (member_one < member_two),
  unique (member_one, member_two)
);
create index if not exists ma3_location_share_pairs_member_one_idx
  on public.ma3_location_share_pairs(member_one);
create index if not exists ma3_location_share_pairs_member_two_idx
  on public.ma3_location_share_pairs(member_two);
alter table public.ma3_location_share_pairs enable row level security;
revoke all on public.ma3_location_share_pairs from public, anon, authenticated;
grant select on public.ma3_location_share_pairs to authenticated;
drop policy if exists "Pair members can see their connection" on public.ma3_location_share_pairs;
create policy "Pair members can see their connection" on public.ma3_location_share_pairs
  for select to authenticated
  using (auth.uid() = member_one or auth.uid() = member_two);

create table if not exists public.ma3_live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 100000),
  updated_at timestamptz not null default now()
);
alter table public.ma3_live_locations enable row level security;
revoke all on public.ma3_live_locations from public, anon, authenticated;
grant select, insert, update, delete on public.ma3_live_locations to authenticated;
drop policy if exists "Owner and paired user read current location" on public.ma3_live_locations;
create policy "Owner and paired user read current location" on public.ma3_live_locations
  for select to authenticated using (
    auth.uid() = user_id
    or (
      updated_at >= now() - interval '90 seconds'
      and exists (
        select 1 from public.ma3_location_share_pairs p
        where (p.member_one = auth.uid() and p.member_two = ma3_live_locations.user_id)
           or (p.member_two = auth.uid() and p.member_one = ma3_live_locations.user_id)
      )
    )
  );
drop policy if exists "Owner writes own current location" on public.ma3_live_locations;
create policy "Owner writes own current location" on public.ma3_live_locations
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Owner updates own current location" on public.ma3_live_locations;
create policy "Owner updates own current location" on public.ma3_live_locations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owner deletes own current location" on public.ma3_live_locations;
create policy "Owner deletes own current location" on public.ma3_live_locations
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_ma3_live_location()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ma3_live_location_updated_at on public.ma3_live_locations;
create trigger ma3_live_location_updated_at before insert or update on public.ma3_live_locations
  for each row execute function public.touch_ma3_live_location();

create or replace function public.create_ma3_location_share_invite()
returns text language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if exists (
    select 1 from public.ma3_location_share_invites
    where owner_id = auth.uid() and created_at > now() - interval '30 seconds'
  ) then raise exception 'Wait 30 seconds before creating another invite'; end if;
  delete from public.ma3_location_share_invites
    where expires_at < now() or (owner_id = auth.uid() and accepted_at is null);
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.ma3_location_share_invites(owner_id, token_sha256, expires_at)
    values (auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '15 minutes');
  return v_token;
end;
$$;

create or replace function public.accept_ma3_location_share_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_owner uuid; v_one uuid; v_two uuid; v_rows integer;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{48}$' then raise exception 'Invite code is invalid or expired'; end if;
  select owner_id into v_owner from public.ma3_location_share_invites
    where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and accepted_by is null and expires_at > now()
    for update;
  if not found then raise exception 'Invite code is invalid, expired or already used'; end if;
  if v_owner = auth.uid() then raise exception 'Open this invite on the other account'; end if;
  v_one := least(v_owner, auth.uid());
  v_two := greatest(v_owner, auth.uid());
  insert into public.ma3_location_share_pairs(member_one, member_two)
    values (v_one, v_two) on conflict (member_one, member_two) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'These accounts are already paired'; end if;
  update public.ma3_location_share_invites set accepted_by = auth.uid(), accepted_at = now()
    where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex');
  return v_owner;
end;
$$;

create or replace function public.revoke_ma3_location_share_pair(p_other_user_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_deleted integer;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_other_user_id is null or p_other_user_id = auth.uid() then raise exception 'Invalid paired account'; end if;
  delete from public.ma3_location_share_pairs
    where (member_one = least(auth.uid(), p_other_user_id) and member_two = greatest(auth.uid(), p_other_user_id));
  get diagnostics v_deleted = row_count;
  delete from public.ma3_live_locations where user_id = auth.uid();
  return v_deleted > 0;
end;
$$;

revoke all on function public.touch_ma3_live_location() from public, anon, authenticated;
revoke all on function public.create_ma3_location_share_invite() from public, anon;
revoke all on function public.accept_ma3_location_share_invite(text) from public, anon;
revoke all on function public.revoke_ma3_location_share_pair(uuid) from public, anon;
grant execute on function public.create_ma3_location_share_invite() to authenticated;
grant execute on function public.accept_ma3_location_share_invite(text) to authenticated;
grant execute on function public.revoke_ma3_location_share_pair(uuid) to authenticated;

alter table public.ma3_live_locations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ma3_live_locations'
     ) then
    alter publication supabase_realtime add table public.ma3_live_locations;
  end if;
end;
$$;

comment on table public.ma3_location_share_invites is 'One-use, 15-minute location-sharing invitations. Raw codes are never stored.';
comment on table public.ma3_location_share_pairs is 'Explicitly accepted two-account pairs allowed to see each other’s current location while sharing is active.';
comment on table public.ma3_live_locations is 'Latest opt-in point only; no history. Visible to the owner and explicitly paired account; peer rows expire from reads after 90 seconds.';
