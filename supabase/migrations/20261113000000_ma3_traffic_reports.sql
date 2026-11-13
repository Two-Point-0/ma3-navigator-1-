-- Driver-submitted short-lived road reports for approved routes.
-- The Realtime-published report row deliberately contains no reporter identity.
create table if not exists public.ma3_traffic_reports (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references public.ma3_routes(route_id) on delete cascade,
  issue_type text not null check (issue_type in (
    'pothole','collision','police_checkpoint','roadworks','flooding','obstruction','congestion','other'
  )),
  note text not null default '' check (char_length(note) <= 140),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 minutes'),
  status text not null default 'active' check (status in ('active','dismissed'))
);
create index if not exists ma3_traffic_reports_route_expiry_idx
  on public.ma3_traffic_reports(route_id, expires_at desc) where status = 'active';

-- Private anti-abuse audit: no client policies/grants and never added to Realtime.
create table if not exists public.ma3_traffic_report_owners (
  report_id uuid primary key references public.ma3_traffic_reports(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ma3_traffic_report_owners_reporter_recent_idx
  on public.ma3_traffic_report_owners(reporter_id, created_at desc);
alter table public.ma3_traffic_report_owners enable row level security;
revoke all on public.ma3_traffic_report_owners from public, anon, authenticated;

alter table public.ma3_traffic_reports enable row level security;
revoke all on public.ma3_traffic_reports from public, anon, authenticated;
grant select (id, route_id, issue_type, note, latitude, longitude, created_at, expires_at)
  on public.ma3_traffic_reports to authenticated;
grant insert (route_id, issue_type, note, latitude, longitude)
  on public.ma3_traffic_reports to authenticated;

-- Validate against the imported route polyline, not only against client-side map clicks.
-- Coordinates are stored as [latitude, longitude]. A local equirectangular projection is
-- accurate for these short road segments and avoids needing a PostGIS extension.
create or replace function public.ma3_traffic_point_on_route(
  p_route_id text, p_latitude double precision, p_longitude double precision
) returns boolean language plpgsql stable security definer set search_path = public, auth
as $$
declare
  v_coordinates jsonb;
  v_count integer;
  v_i integer;
  v_lat1 double precision; v_lon1 double precision;
  v_lat2 double precision; v_lon2 double precision;
  v_x1 double precision; v_y1 double precision;
  v_x2 double precision; v_y2 double precision;
  v_dx double precision; v_dy double precision;
  v_denominator double precision; v_t double precision; v_distance double precision;
  v_radius double precision := 6371000;
  v_cos_lat double precision := cos(radians(p_latitude));
begin
  select coordinates into v_coordinates from public.ma3_route_shapes where route_id = p_route_id;
  if v_coordinates is null or jsonb_typeof(v_coordinates) <> 'array' then return false; end if;
  v_count := jsonb_array_length(v_coordinates);
  if v_count < 2 then return false; end if;
  for v_i in 0..(v_count - 2) loop
    if jsonb_typeof(v_coordinates -> v_i) is distinct from 'array' then continue; end if;
    if jsonb_array_length(v_coordinates -> v_i) < 2 then continue; end if;
    if jsonb_typeof(v_coordinates -> (v_i + 1)) is distinct from 'array' then continue; end if;
    if jsonb_array_length(v_coordinates -> (v_i + 1)) < 2 then continue; end if;
    v_lat1 := (v_coordinates -> v_i ->> 0)::double precision;
    v_lon1 := (v_coordinates -> v_i ->> 1)::double precision;
    v_lat2 := (v_coordinates -> (v_i + 1) ->> 0)::double precision;
    v_lon2 := (v_coordinates -> (v_i + 1) ->> 1)::double precision;
    v_x1 := radians(v_lon1 - p_longitude) * v_radius * v_cos_lat;
    v_y1 := radians(v_lat1 - p_latitude) * v_radius;
    v_x2 := radians(v_lon2 - p_longitude) * v_radius * v_cos_lat;
    v_y2 := radians(v_lat2 - p_latitude) * v_radius;
    v_dx := v_x2 - v_x1;
    v_dy := v_y2 - v_y1;
    v_denominator := v_dx * v_dx + v_dy * v_dy;
    if v_denominator = 0 then
      v_distance := sqrt(v_x1 * v_x1 + v_y1 * v_y1);
    else
      v_t := greatest(0, least(1, -((v_x1 * v_dx + v_y1 * v_dy) / v_denominator)));
      v_distance := sqrt((v_x1 + v_t * v_dx)^2 + (v_y1 + v_t * v_dy)^2);
    end if;
    if v_distance <= 200 then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.ma3_traffic_point_on_route(text,double precision,double precision) from public, anon;
grant execute on function public.ma3_traffic_point_on_route(text,double precision,double precision) to authenticated;

drop policy if exists "Approved route drivers read current traffic reports" on public.ma3_traffic_reports;
create policy "Approved route drivers read current traffic reports" on public.ma3_traffic_reports
  for select to authenticated using (
    status = 'active' and expires_at > now()
    and public.ma3_has_verified_phone(auth.uid())
    and public.ma3_is_approved_driver_for_route(auth.uid(), route_id)
  );

drop policy if exists "Approved route drivers create traffic reports" on public.ma3_traffic_reports;
create policy "Approved route drivers create traffic reports" on public.ma3_traffic_reports
  for insert to authenticated with check (
    status = 'active' and expires_at > now()
    and public.ma3_has_verified_phone(auth.uid())
    and public.ma3_is_approved_driver_for_route(auth.uid(), route_id)
    and public.ma3_traffic_point_on_route(route_id, latitude, longitude)
  );

-- Trust the authenticated identity, enforce a modest rate limit, sanitize the note,
-- and choose category-specific visibility windows. Expiry hides reports from discovery;
-- configure a separate retention cleanup before launch if physical deletion is required.
create or replace function public.prepare_ma3_traffic_report()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare
  v_recent integer;
begin
  if auth.uid() is null then raise exception 'Sign in with a verified phone account to report a road issue'; end if;
  if not public.ma3_has_verified_phone(auth.uid()) then raise exception 'A verified phone account is required'; end if;
  if not public.ma3_is_approved_driver_for_route(auth.uid(), new.route_id) then
    raise exception 'An approved driver account for this route is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 721031));
  select count(*) into v_recent from public.ma3_traffic_report_owners
    where reporter_id = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent >= 12 then raise exception 'Traffic report limit reached; try again later'; end if;
  new.note := left(trim(coalesce(new.note, '')), 140);
  new.created_at := now();
  new.status := 'active';
  new.expires_at := now() + case new.issue_type
    when 'police_checkpoint' then interval '30 minutes'
    when 'pothole' then interval '24 hours'
    when 'collision' then interval '2 hours'
    when 'flooding' then interval '2 hours'
    else interval '90 minutes'
  end;
  return new;
end;
$$;
revoke all on function public.prepare_ma3_traffic_report() from public, anon, authenticated;
drop trigger if exists ma3_traffic_report_prepare on public.ma3_traffic_reports;
create trigger ma3_traffic_report_prepare before insert on public.ma3_traffic_reports
  for each row execute function public.prepare_ma3_traffic_report();

create or replace function public.record_ma3_traffic_report_owner()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.ma3_traffic_report_owners(report_id, reporter_id, created_at)
    values (new.id, auth.uid(), new.created_at);
  return new;
end;
$$;
revoke all on function public.record_ma3_traffic_report_owner() from public, anon, authenticated;
drop trigger if exists ma3_traffic_report_owner_audit on public.ma3_traffic_reports;
create trigger ma3_traffic_report_owner_audit after insert on public.ma3_traffic_reports
  for each row execute function public.record_ma3_traffic_report_owner();

alter table public.ma3_traffic_reports replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ma3_traffic_reports'
     ) then
    alter publication supabase_realtime add table public.ma3_traffic_reports;
  end if;
end;
$$;

comment on table public.ma3_traffic_reports is
  'Short-lived driver-submitted road reports scoped to approved routes. No reporter identity is stored in this Realtime-published table; exact issue points are visible only to verified drivers approved for the route.';
comment on table public.ma3_traffic_report_owners is
  'Private anti-abuse audit for Ma3 traffic reports; no client access or Realtime publication.';
