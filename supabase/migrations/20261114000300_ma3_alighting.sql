-- Passengers who are on board can tell the driver which stop they get off at.
-- Drivers only ever see anonymous COUNTS per stop (never a name, phone, account or GPS),
-- and only if they are a verified, approved driver for that route. Same privacy model as pickup demand.

create table if not exists public.ma3_stop_alighting (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_id text not null references public.ma3_routes(route_id) on delete cascade,
  stop_id text not null references public.ma3_stops(stop_id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, route_id)
);
create index if not exists ma3_stop_alighting_active_idx on public.ma3_stop_alighting (route_id, stop_id, expires_at);
alter table public.ma3_stop_alighting enable row level security;
grant select on public.ma3_stop_alighting to authenticated;
drop policy if exists "Passengers read only their own alighting marker" on public.ma3_stop_alighting;
create policy "Passengers read only their own alighting marker"
  on public.ma3_stop_alighting for select to authenticated using (auth.uid() = user_id);

create or replace function public.set_my_ma3_alighting(p_route_id text, p_stop_id text)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare expiration timestamptz := now() + interval '90 minutes';
begin
  if auth.uid() is null or not public.ma3_has_verified_phone(auth.uid()) then
    raise exception 'Verify your phone before telling the driver where you get off';
  end if;
  if not exists (select 1 from public.ma3_route_stops where route_id = p_route_id and stop_id = p_stop_id) then
    raise exception 'This stop is not on the selected route';
  end if;
  insert into public.ma3_stop_alighting (user_id, route_id, stop_id, expires_at, updated_at)
  values (auth.uid(), p_route_id, p_stop_id, expiration, now())
  on conflict (user_id, route_id) do update
    set stop_id = excluded.stop_id, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
  return expiration;
end;
$$;
revoke all on function public.set_my_ma3_alighting(text, text) from public, anon;
grant execute on function public.set_my_ma3_alighting(text, text) to authenticated;

create or replace function public.cancel_my_ma3_alighting(p_route_id text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.ma3_stop_alighting where user_id = auth.uid() and route_id = p_route_id;
end;
$$;
revoke all on function public.cancel_my_ma3_alighting(text) from public, anon;
grant execute on function public.cancel_my_ma3_alighting(text) to authenticated;

create or replace function public.get_ma3_alighting_counts(p_route_id text)
returns table (stop_id text, stop_name text, alighting_count integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.ma3_has_verified_phone(auth.uid()) then
    raise exception 'A verified phone account is required';
  end if;
  if not public.ma3_is_approved_driver_for_route(auth.uid(), p_route_id) then
    raise exception 'Driver approval for this route is required';
  end if;
  return query
    select a.stop_id, s.name, count(*)::integer
    from public.ma3_stop_alighting a
    join public.ma3_stops s on s.stop_id = a.stop_id
    join public.ma3_route_stops rs on rs.route_id = a.route_id and rs.stop_id = a.stop_id
    where a.route_id = p_route_id and a.expires_at > now()
    group by a.stop_id, s.name, rs.stop_sequence
    order by rs.stop_sequence;
end;
$$;
revoke all on function public.get_ma3_alighting_counts(text) from public, anon;
grant execute on function public.get_ma3_alighting_counts(text) to authenticated;
