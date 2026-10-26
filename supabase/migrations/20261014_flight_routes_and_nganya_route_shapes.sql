-- Live travel search results are sourced records, never frontend demo flights.
create table if not exists public.flight_routes (
  id text primary key,
  service_type text not null check (service_type in ('domestic','international')),
  airline text not null,
  flight_number text not null,
  origin_code text not null,
  origin_name text not null,
  destination_code text not null,
  destination_name text not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  fare_kes numeric(12,2),
  geometry jsonb not null,
  source_url text not null,
  source_updated_at timestamptz not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (arrival_at > departure_at),
  check (
    geometry->>'type' in ('LineString','MultiLineString')
    or (geometry->>'type' = 'Feature' and geometry->'geometry'->>'type' in ('LineString','MultiLineString'))
    or (geometry->>'type' = 'FeatureCollection' and jsonb_typeof(geometry->'features') = 'array')
  )
);
create index if not exists flight_routes_search_idx on public.flight_routes (service_type, departure_at) where active = true;
alter table public.flight_routes enable row level security;
grant select on public.flight_routes to anon, authenticated;
drop policy if exists "Anyone can read active sourced flight routes" on public.flight_routes;
create policy "Anyone can read active sourced flight routes" on public.flight_routes
  for select to anon, authenticated using (active = true and departure_at >= now() - interval '1 day');

-- One authoritative track per Nganya route; individual matatus inherit its route line.
create table if not exists public.nganya_route_shapes (
  route_code text primary key,
  route_label text not null,
  geometry jsonb not null,
  source_url text not null,
  source_updated_at timestamptz not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (
    geometry->>'type' in ('LineString','MultiLineString')
    or (geometry->>'type' = 'Feature' and geometry->'geometry'->>'type' in ('LineString','MultiLineString'))
    or (geometry->>'type' = 'FeatureCollection' and jsonb_typeof(geometry->'features') = 'array')
  )
);
alter table public.nganya_route_shapes enable row level security;
grant select on public.nganya_route_shapes to anon, authenticated;
drop policy if exists "Anyone can read active Nganya route shapes" on public.nganya_route_shapes;
create policy "Anyone can read active Nganya route shapes" on public.nganya_route_shapes
  for select to anon, authenticated using (active = true);

comment on table public.flight_routes is 'Sourced airline schedules and route GeoJSON; populate from an authorized feed or verified operator data.';
comment on column public.flight_routes.geometry is 'GeoJSON LineString/MultiLineString in [longitude, latitude] order, representing a sourced route, not an assumed straight-line shortcut.';
comment on table public.nganya_route_shapes is 'Sourced GeoJSON route lines keyed by the Nganya route_code shown in Mirth.';
