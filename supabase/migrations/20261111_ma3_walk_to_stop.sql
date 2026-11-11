-- Anonymous stage-demand intent with an explicit one-time walking check-in.
-- Passenger coordinates are submitted transiently for distance validation and are never stored.
-- Drivers receive counts only and must be phone-verified and approved for the selected route.

alter table public.ma3_stop_waiting
  add column if not exists status text not null default 'waiting';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ma3_stop_waiting'::regclass
      and conname = 'ma3_stop_waiting_status_check'
  ) then
    alter table public.ma3_stop_waiting
      add constraint ma3_stop_waiting_status_check check (status in ('waiting', 'walking'));
  end if;
end;
$$;

create index if not exists ma3_stop_waiting_status_idx
  on public.ma3_stop_waiting (route_id, stop_id, status, expires_at);

-- Disable the former generic RPCs so old clients cannot bypass phone verification
-- or continue using the less-specific demand response.
revoke all on function public.set_my_ma3_stop_waiting(text, text) from public, anon, authenticated;
drop function if exists public.get_ma3_waiting_counts(text);

create or replace function public.set_my_ma3_stop_intent(
  p_route_id text,
  p_stop_id text,
  p_status text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  stop_lat double precision;
  stop_lon double precision;
  distance_m double precision;
  expiration timestamptz;
begin
  if auth.uid() is null or not public.ma3_has_verified_phone(auth.uid()) then
    raise exception 'Verify your phone before sharing pickup demand';
  end if;
  if p_status not in ('waiting', 'walking') then
    raise exception 'Choose waiting or walking status';
  end if;

  select s.latitude, s.longitude into stop_lat, stop_lon
  from public.ma3_route_stops rs
  join public.ma3_stops s on s.stop_id = rs.stop_id
  where rs.route_id = p_route_id and rs.stop_id = p_stop_id;
  if not found then raise exception 'This stop is not on the selected route'; end if;

  if p_status = 'walking' then
    if p_latitude is null or p_longitude is null or p_accuracy_m is null
       or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
       or p_accuracy_m < 0 or p_accuracy_m > 100 then
      raise exception 'A reliable one-time location fix is required';
    end if;
    distance_m := 6371000 * acos(least(1.0, greatest(-1.0,
      sin(radians(stop_lat)) * sin(radians(p_latitude))
      + cos(radians(stop_lat)) * cos(radians(p_latitude))
      * cos(radians(p_longitude - stop_lon))
    )));
    if distance_m > 800 then raise exception 'Move within 800 metres of the selected stage to share walking status'; end if;
    expiration := now() + interval '10 minutes';
  else
    expiration := now() + interval '30 minutes';
  end if;

  insert into public.ma3_stop_waiting (user_id, route_id, stop_id, status, expires_at, updated_at)
  values (auth.uid(), p_route_id, p_stop_id, p_status, expiration, now())
  on conflict (user_id, route_id, stop_id) do update
    set status = excluded.status, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
  return expiration;
end;
$$;
revoke all on function public.set_my_ma3_stop_intent(text, text, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.set_my_ma3_stop_intent(text, text, text, double precision, double precision, double precision) to authenticated;

create or replace function public.get_ma3_waiting_counts(p_route_id text)
returns table (stop_id text, stop_name text, waiting_count integer, walking_count integer)
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
    select waiting.stop_id, stops.name,
      count(*) filter (where waiting.status = 'waiting')::integer,
      count(*) filter (where waiting.status = 'walking')::integer
    from public.ma3_stop_waiting waiting
    join public.ma3_stops stops on stops.stop_id = waiting.stop_id
    join public.ma3_route_stops route_stops on route_stops.route_id = waiting.route_id and route_stops.stop_id = waiting.stop_id
    where waiting.route_id = p_route_id and waiting.expires_at > now()
    group by waiting.stop_id, stops.name, route_stops.stop_sequence
    order by route_stops.stop_sequence;
end;
$$;
revoke all on function public.get_ma3_waiting_counts(text) from public, anon;
grant execute on function public.get_ma3_waiting_counts(text) to authenticated;

comment on column public.ma3_stop_waiting.status is 'Self-reported waiting or walking intent. Walking status is checked once against an 800 m straight-line radius and expires after 10 minutes; exact passenger GPS is not persisted.';
