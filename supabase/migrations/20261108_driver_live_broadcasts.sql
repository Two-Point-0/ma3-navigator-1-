-- Approved, active-shift driver locations for route-specific rider maps.
-- This exposes no phone number or personal profile data. Rows are the latest point only;
-- rider discovery hides them after 45 seconds without a fresh GPS update.

create table if not exists public.ma3_driver_live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  route_id text not null references public.ma3_routes(route_id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 100000),
  seats_available integer not null default 0 check (seats_available between 0 and 100),
  last_seen timestamptz not null default now()
);
create index if not exists ma3_driver_live_route_fresh_idx
  on public.ma3_driver_live_locations(route_id, last_seen desc);
alter table public.ma3_driver_live_locations enable row level security;
revoke all on public.ma3_driver_live_locations from public, anon, authenticated;
grant select, delete on public.ma3_driver_live_locations to authenticated;
grant insert (user_id, route_id, latitude, longitude, accuracy_m, seats_available)
  on public.ma3_driver_live_locations to authenticated;
grant update (route_id, latitude, longitude, accuracy_m, seats_available)
  on public.ma3_driver_live_locations to authenticated;

-- SECURITY DEFINER is used because ordinary drivers may read only their own approval row.
-- This returns only whether a driver is approved for a route, not their verification documents.
create or replace function public.ma3_is_approved_driver_for_route(p_driver_id uuid, p_route_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ma3_driver_profiles p
    where p.user_id = p_driver_id and p.status = 'approved' and p_route_id = any(p.route_ids)
  );
$$;
revoke all on function public.ma3_is_approved_driver_for_route(uuid,text) from public, anon;
grant execute on function public.ma3_is_approved_driver_for_route(uuid,text) to authenticated;

drop policy if exists "Riders see fresh approved drivers only" on public.ma3_driver_live_locations;
create policy "Riders see fresh approved drivers only" on public.ma3_driver_live_locations
  for select to authenticated using (
    auth.uid() = user_id
    or (
      last_seen >= now() - interval '45 seconds'
      and public.ma3_is_approved_driver_for_route(user_id, route_id)
    )
  );
drop policy if exists "Approved driver publishes own route location" on public.ma3_driver_live_locations;
create policy "Approved driver publishes own route location" on public.ma3_driver_live_locations
  for insert to authenticated with check (
    auth.uid() = user_id and public.ma3_is_approved_driver_for_route(auth.uid(), route_id)
  );
drop policy if exists "Approved driver updates own route location" on public.ma3_driver_live_locations;
create policy "Approved driver updates own route location" on public.ma3_driver_live_locations
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.ma3_is_approved_driver_for_route(auth.uid(), route_id));
drop policy if exists "Driver removes own live location" on public.ma3_driver_live_locations;
create policy "Driver removes own live location" on public.ma3_driver_live_locations
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_ma3_driver_live_location()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.last_seen := now();
  return new;
end;
$$;
revoke all on function public.touch_ma3_driver_live_location() from public, anon, authenticated;
drop trigger if exists ma3_driver_live_location_touch on public.ma3_driver_live_locations;
create trigger ma3_driver_live_location_touch before insert or update on public.ma3_driver_live_locations
  for each row execute function public.touch_ma3_driver_live_location();

alter table public.ma3_driver_live_locations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ma3_driver_live_locations'
     ) then
    alter publication supabase_realtime add table public.ma3_driver_live_locations;
  end if;
end;
$$;

comment on table public.ma3_driver_live_locations is 'Latest GPS point for an approved driver who explicitly went online; only fresh route, point, accuracy and seats are visible to authenticated riders. No location history or contact details.';
