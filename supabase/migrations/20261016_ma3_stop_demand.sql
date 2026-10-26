-- Voluntary, short-lived requests for a matatu pickup. Drivers see only
-- anonymous counts, never passenger IDs, names, phone numbers or device GPS.
create table if not exists public.ma3_stop_waiting (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_id text not null references public.ma3_routes(route_id) on delete cascade,
  stop_id text not null references public.ma3_stops(stop_id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, route_id, stop_id)
);
create index if not exists ma3_stop_waiting_active_idx
  on public.ma3_stop_waiting (route_id, stop_id, expires_at);
alter table public.ma3_stop_waiting enable row level security;
grant select on public.ma3_stop_waiting to authenticated;
create policy "Passengers can read only their own waiting markers"
  on public.ma3_stop_waiting for select to authenticated using (auth.uid() = user_id);

create or replace function public.set_my_ma3_stop_waiting(p_route_id text, p_stop_id text)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare expiration timestamptz := now() + interval '30 minutes';
begin
  if auth.uid() is null then raise exception 'Sign in before sharing your stop'; end if;
  if not exists (
    select 1 from public.ma3_route_stops route_stop
    join public.ma3_routes route on route.route_id = route_stop.route_id
    join public.ma3_stops stop on stop.stop_id = route_stop.stop_id
    where route_stop.route_id = p_route_id and route_stop.stop_id = p_stop_id
  ) then raise exception 'This stop is not on the selected route'; end if;
  insert into public.ma3_stop_waiting (user_id, route_id, stop_id, expires_at, updated_at)
  values (auth.uid(), p_route_id, p_stop_id, expiration, now())
  on conflict (user_id, route_id, stop_id) do update set expires_at = excluded.expires_at, updated_at = excluded.updated_at;
  return expiration;
end;
$$;
revoke all on function public.set_my_ma3_stop_waiting(text, text) from public;
grant execute on function public.set_my_ma3_stop_waiting(text, text) to authenticated;

create or replace function public.cancel_my_ma3_stop_waiting(p_route_id text, p_stop_id text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in before changing your stop'; end if;
  delete from public.ma3_stop_waiting where user_id = auth.uid() and route_id = p_route_id and stop_id = p_stop_id;
end;
$$;
revoke all on function public.cancel_my_ma3_stop_waiting(text, text) from public;
grant execute on function public.cancel_my_ma3_stop_waiting(text, text) to authenticated;

create or replace function public.get_ma3_waiting_counts(p_route_id text)
returns table (stop_id text, stop_name text, waiting_count integer)
language sql stable security definer set search_path = public
as $$
  select waiting.stop_id, stops.name, count(*)::integer
  from public.ma3_stop_waiting waiting
  join public.ma3_stops stops on stops.stop_id = waiting.stop_id
  join public.ma3_route_stops route_stops on route_stops.route_id = waiting.route_id and route_stops.stop_id = waiting.stop_id
  where waiting.route_id = p_route_id and waiting.expires_at > now()
  group by waiting.stop_id, stops.name, route_stops.stop_sequence
  order by route_stops.stop_sequence
$$;
revoke all on function public.get_ma3_waiting_counts(text) from public;
grant execute on function public.get_ma3_waiting_counts(text) to authenticated;
