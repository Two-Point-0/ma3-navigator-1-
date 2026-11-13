-- Read-only public transit reference tables. Populate these from an archived or
-- currently licensed GTFS feed; never treat this snapshot as live service data.
create table if not exists public.ma3_routes (
  route_id text primary key,
  short_name text not null,
  long_name text not null,
  headsign text,
  color text,
  source_valid_until date,
  created_at timestamptz not null default now()
);

create table if not exists public.ma3_stops (
  stop_id text primary key,
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source_valid_until date,
  created_at timestamptz not null default now()
);
create index if not exists ma3_stops_name_idx on public.ma3_stops (lower(name));
create index if not exists ma3_stops_lat_lon_idx on public.ma3_stops (latitude, longitude);

create table if not exists public.ma3_route_stops (
  route_id text not null references public.ma3_routes(route_id) on delete cascade,
  stop_id text not null references public.ma3_stops(stop_id) on delete cascade,
  stop_sequence integer not null check (stop_sequence > 0),
  primary key (route_id, stop_sequence),
  unique (route_id, stop_id, stop_sequence)
);
create index if not exists ma3_route_stops_stop_idx on public.ma3_route_stops (stop_id, route_id);

-- coordinates are ordered [latitude, longitude] pairs, matching the archived
-- client snapshot; a map adapter must convert to [longitude, latitude] if needed.
create table if not exists public.ma3_route_shapes (
  route_id text primary key references public.ma3_routes(route_id) on delete cascade,
  coordinates jsonb not null check (jsonb_typeof(coordinates) = 'array'),
  source_valid_until date,
  created_at timestamptz not null default now()
);

alter table public.ma3_routes enable row level security;
alter table public.ma3_stops enable row level security;
alter table public.ma3_route_stops enable row level security;
alter table public.ma3_route_shapes enable row level security;
grant select on public.ma3_routes, public.ma3_stops, public.ma3_route_stops, public.ma3_route_shapes to anon, authenticated;

drop policy if exists "Anyone can read archived Ma3 routes" on public.ma3_routes;
create policy "Anyone can read archived Ma3 routes" on public.ma3_routes for select to anon, authenticated using (true);
drop policy if exists "Anyone can read archived Ma3 stops" on public.ma3_stops;
create policy "Anyone can read archived Ma3 stops" on public.ma3_stops for select to anon, authenticated using (true);
drop policy if exists "Anyone can read archived Ma3 route stops" on public.ma3_route_stops;
create policy "Anyone can read archived Ma3 route stops" on public.ma3_route_stops for select to anon, authenticated using (true);
drop policy if exists "Anyone can read archived Ma3 route shapes" on public.ma3_route_shapes;
create policy "Anyone can read archived Ma3 route shapes" on public.ma3_route_shapes for select to anon, authenticated using (true);
