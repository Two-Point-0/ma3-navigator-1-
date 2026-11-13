-- Annual Nganya rankings persist all vehicles and show each year's full vote totals.
-- Existing route/day voting remains the guard against repeat votes.
create or replace function public.get_nganya_annual_leaderboard(p_year integer)
returns table (
  matatu_id uuid,
  display_name text,
  sacco text,
  route_code text,
  route_label text,
  image_url text,
  active boolean,
  vote_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    matatus.id,
    matatus.display_name,
    matatus.sacco,
    matatus.route_code,
    matatus.route_label,
    matatus.image_url,
    matatus.active,
    count(votes.id)::bigint as vote_count
  from public.nganya_matatus as matatus
  left join public.nganya_votes as votes
    on votes.matatu_id = matatus.id
    and votes.vote_date >= make_date(p_year, 1, 1)
    and votes.vote_date < make_date(p_year + 1, 1, 1)
  group by matatus.id
  order by vote_count desc, lower(matatus.display_name), matatus.id;
$$;
revoke all on function public.get_nganya_annual_leaderboard(integer) from public;
grant execute on function public.get_nganya_annual_leaderboard(integer) to anon, authenticated;

-- Drivers/users can suggest a vehicle and its route. Submissions are private to
-- their submitter until an administrator verifies and publishes them.
create table if not exists public.nganya_route_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  sacco text,
  route_code text not null check (length(trim(route_code)) between 1 and 32),
  route_label text,
  route_via text not null check (length(trim(route_via)) between 3 and 1200),
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists nganya_route_submissions_owner_idx on public.nganya_route_submissions (user_id, created_at desc);
alter table public.nganya_route_submissions enable row level security;
grant select, insert on public.nganya_route_submissions to authenticated;
drop policy if exists "Users create own Nganya route submissions" on public.nganya_route_submissions;
create policy "Users create own Nganya route submissions" on public.nganya_route_submissions
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "Users read own Nganya route submissions" on public.nganya_route_submissions;
create policy "Users read own Nganya route submissions" on public.nganya_route_submissions
  for select to authenticated using (auth.uid() = user_id);

-- User profile pictures: each signed-in account can manage only its own
-- <uid>/avatar.<ext> object. Public read allows rendering a selected avatar.
alter table public.profiles add column if not exists avatar_url text;
grant select, insert, update on public.profiles to authenticated;
drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Public can view profile photos" on storage.objects;
create policy "Public can view profile photos" on storage.objects for select to public using (bucket_id = 'profile-photos');
drop policy if exists "Users upload own profile photos" on storage.objects;
create policy "Users upload own profile photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own profile photos" on storage.objects;
create policy "Users update own profile photos" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own profile photos" on storage.objects;
create policy "Users delete own profile photos" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- SGR geometry, stations and operational times are kept on the backend. Import
-- source/updated_at are retained so the UI can identify the authoritative feed.
create table if not exists public.sgr_routes (
  id text primary key,
  name text not null,
  operator text not null default 'Kenya Railways',
  geometry jsonb not null,
  source_url text,
  source_updated_at timestamptz,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(geometry) in ('LineString','MultiLineString') or geometry ? 'coordinates')
);
create table if not exists public.sgr_stations (
  id text primary key,
  name text not null,
  route_id text references public.sgr_routes(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sequence_number integer,
  source_url text,
  source_updated_at timestamptz,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.sgr_schedules (
  id uuid primary key default gen_random_uuid(),
  train_code text not null,
  route_id text not null references public.sgr_routes(id) on delete cascade,
  origin_station_id text not null references public.sgr_stations(id) on delete restrict,
  destination_station_id text not null references public.sgr_stations(id) on delete restrict,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  fare_kes numeric(12,2),
  source_url text not null,
  source_updated_at timestamptz not null,
  active boolean not null default true,
  check (arrival_at > departure_at)
);
create index if not exists sgr_schedules_departure_idx on public.sgr_schedules (departure_at) where active = true;
create index if not exists sgr_stations_route_order_idx on public.sgr_stations (route_id, sequence_number);
alter table public.sgr_routes enable row level security;
alter table public.sgr_stations enable row level security;
alter table public.sgr_schedules enable row level security;
grant select on public.sgr_routes, public.sgr_stations, public.sgr_schedules to anon, authenticated;
drop policy if exists "Anyone can read active SGR routes" on public.sgr_routes;
create policy "Anyone can read active SGR routes" on public.sgr_routes for select to anon, authenticated using (active = true);
drop policy if exists "Anyone can read active SGR stations" on public.sgr_stations;
create policy "Anyone can read active SGR stations" on public.sgr_stations for select to anon, authenticated using (active = true);
drop policy if exists "Anyone can read upcoming SGR schedules" on public.sgr_schedules;
create policy "Anyone can read upcoming SGR schedules" on public.sgr_schedules for select to anon, authenticated using (active = true and departure_at >= now() - interval '1 day');
