-- Rail network (prototype data) so the Rail planner can read stations and lines from Supabase.
-- Everyone can read; only the service role (dashboard / import) can change it.
create table if not exists public.rail_lines (
  id text primary key, name text not null, color text not null default '#d97706',
  speed_kmh numeric not null default 35, wait_min numeric not null default 20,
  base_fare numeric not null default 30, per_km numeric not null default 2.5
);
create table if not exists public.rail_stations (
  id text primary key, name text not null, lat double precision not null, lon double precision not null,
  approx boolean not null default true
);
create table if not exists public.rail_line_stations (
  line_id text not null references public.rail_lines(id) on delete cascade,
  seq int not null, station_id text not null references public.rail_stations(id) on delete cascade,
  primary key (line_id, seq)
);
alter table public.rail_lines enable row level security;
alter table public.rail_stations enable row level security;
alter table public.rail_line_stations enable row level security;
drop policy if exists rail_lines_read on public.rail_lines;
create policy rail_lines_read on public.rail_lines for select using (true);
drop policy if exists rail_stations_read on public.rail_stations;
create policy rail_stations_read on public.rail_stations for select using (true);
drop policy if exists rail_line_stations_read on public.rail_line_stations;
create policy rail_line_stations_read on public.rail_line_stations for select using (true);
