-- Public, read-only map data; catalogue writes remain a trusted admin operation.
alter table public.price_observations
  add column if not exists import_key text unique;

-- An OSM element ID makes repeat HOTOSM imports safe to upsert.
create table if not exists public.explore_pois (
  osm_id text primary key,
  name text not null,
  category text not null default 'other',
  subtype text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  county text,
  locality text,
  opening_hours text,
  source_snapshot date,
  created_at timestamptz not null default now()
);
create index if not exists explore_pois_lat_lon_idx on public.explore_pois (latitude, longitude);
create index if not exists explore_pois_category_idx on public.explore_pois (category);
alter table public.explore_pois enable row level security;
grant select on public.explore_pois to anon, authenticated;
create policy "Anyone can read Kenya POIs" on public.explore_pois
  for select to anon, authenticated using (true);

-- Five approved/imported matatu details are loaded by a trusted CSV import script.
-- Do not put personal phone numbers, vehicle plates, or live driver locations here.
create table if not exists public.nganya_matatus (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  sacco text,
  route_code text not null,
  route_label text,
  image_url text,
  import_key text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists nganya_matatus_route_idx on public.nganya_matatus (route_code, active);
alter table public.nganya_matatus enable row level security;
grant select on public.nganya_matatus to anon, authenticated;
create policy "Anyone can read active Nganyas" on public.nganya_matatus
  for select to anon, authenticated using (active = true);

-- One authenticated Supabase account gets one vote per Nganya; identities stay private.
create table if not exists public.nganya_votes (
  id uuid primary key default gen_random_uuid(),
  matatu_id uuid not null references public.nganya_matatus(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (matatu_id, user_id)
);
alter table public.nganya_votes enable row level security;
grant select, insert, delete on public.nganya_votes to authenticated;
create policy "Users can read their Nganya votes" on public.nganya_votes
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can vote for themselves" on public.nganya_votes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove their own Nganya vote" on public.nganya_votes
  for delete to authenticated using (auth.uid() = user_id);

-- Expose only aggregate totals, never voter identities, to the public app.
create or replace function public.get_nganya_vote_totals()
returns table (matatu_id uuid, vote_count bigint)
language sql
security definer
set search_path = public
as $$
  select votes.matatu_id, count(*)::bigint
  from public.nganya_votes as votes
  group by votes.matatu_id;
$$;
revoke all on function public.get_nganya_vote_totals() from public;
grant execute on function public.get_nganya_vote_totals() to anon, authenticated;

-- Let non-logged-in users see only public demo/manual observations; do not leak
-- partner data or verified/private prices through the browser API.
drop policy if exists "public reads demo prices" on public.price_observations;
create policy "Public reads unverified catalogue prices" on public.price_observations
  for select to anon, authenticated
  using (verified = false and source_type in ('seeded_demo', 'manual_entry', 'user_submitted'));
grant select on public.retailers, public.products, public.price_observations to anon, authenticated;

-- One vote per route per account per Nairobi calendar day. Store the route on
-- the vote so later catalogue edits cannot rewrite the historical route tally.
alter table public.nganya_votes add column if not exists route_code text;
alter table public.nganya_votes add column if not exists vote_date date not null default current_date;
update public.nganya_votes as votes set route_code = matatus.route_code
  from public.nganya_matatus as matatus where votes.matatu_id = matatus.id and votes.route_code is null;
alter table public.nganya_votes alter column route_code set not null;
alter table public.nganya_votes drop constraint if exists nganya_votes_matatu_id_user_id_key;
create unique index if not exists nganya_votes_user_route_day_uidx on public.nganya_votes (user_id, route_code, vote_date);
revoke delete on public.nganya_votes from authenticated;
drop policy if exists "Users can remove their own Nganya vote" on public.nganya_votes;

create or replace function public.set_nganya_vote_route()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select route_code into new.route_code from public.nganya_matatus
    where id = new.matatu_id and active = true;
  if new.route_code is null then raise exception 'This Nganya is not active'; end if;
  new.vote_date := (now() at time zone 'Africa/Nairobi')::date;
  return new;
end;
$$;
drop trigger if exists set_nganya_vote_route_before_insert on public.nganya_votes;
create trigger set_nganya_vote_route_before_insert before insert on public.nganya_votes
  for each row execute function public.set_nganya_vote_route();

-- Points are a non-cash engagement score. Clients can read their own ledger;
-- only trusted triggers/functions can award them.
create table if not exists public.nganya_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null default ((now() at time zone 'Africa/Nairobi')::date),
  activity text not null check (activity in ('nganya_vote', 'poi_navigation')),
  reference_key text not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_date, activity, reference_key)
);
alter table public.nganya_point_events enable row level security;
grant select on public.nganya_point_events to authenticated;
create policy "Users read their own challenge points" on public.nganya_point_events
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.award_nganya_vote_points()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.nganya_point_events (user_id, event_date, activity, reference_key, points)
  values (new.user_id, new.vote_date, 'nganya_vote', new.route_code, 10)
  on conflict (user_id, event_date, activity, reference_key) do nothing;
  return new;
end;
$$;
drop trigger if exists award_nganya_vote_points_after_insert on public.nganya_votes;
create trigger award_nganya_vote_points_after_insert after insert on public.nganya_votes
  for each row execute function public.award_nganya_vote_points();

create or replace function public.record_nganya_poi_navigation(p_osm_id text)
returns integer language plpgsql security definer set search_path = public
as $$
declare awarded integer := 0; today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if auth.uid() is null then raise exception 'Sign in to record a daily challenge'; end if;
  if not exists (select 1 from public.explore_pois where osm_id = p_osm_id) then
    raise exception 'Only a mapped public POI can count for this challenge';
  end if;
  insert into public.nganya_point_events (user_id, event_date, activity, reference_key, points)
  values (auth.uid(), today, 'poi_navigation', p_osm_id, 5)
  on conflict (user_id, event_date, activity, reference_key) do nothing;
  if found then awarded := 5; end if;
  return awarded;
end;
$$;
revoke all on function public.record_nganya_poi_navigation(text) from public;
grant execute on function public.record_nganya_poi_navigation(text) to authenticated;

-- Community style scores (1–5) are explicitly subjective, not safety claims.
create table if not exists public.nganya_ratings (
  matatu_id uuid not null references public.nganya_matatus(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artwork smallint not null check (artwork between 1 and 5),
  sound smallint not null check (sound between 1 and 5),
  lighting smallint not null check (lighting between 1 and 5),
  comfort smallint not null check (comfort between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (matatu_id, user_id)
);
alter table public.nganya_ratings enable row level security;
grant select, insert, update on public.nganya_ratings to authenticated;
create policy "Users read own style ratings" on public.nganya_ratings
  for select to authenticated using (auth.uid() = user_id);
create policy "Users create their own style ratings" on public.nganya_ratings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update their own style ratings" on public.nganya_ratings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.get_nganya_style_averages(p_matatu_id uuid default null)
returns table (matatu_id uuid, artwork numeric, sound numeric, lighting numeric, comfort numeric, rating_count bigint)
language sql security definer set search_path = public
as $$
  select r.matatu_id, round(avg(r.artwork)::numeric, 1), round(avg(r.sound)::numeric, 1),
         round(avg(r.lighting)::numeric, 1), round(avg(r.comfort)::numeric, 1), count(*)
  from public.nganya_ratings r
  join public.nganya_matatus m on m.id = r.matatu_id and m.active = true
  where p_matatu_id is null or r.matatu_id = p_matatu_id
  group by r.matatu_id;
$$;
revoke all on function public.get_nganya_style_averages(uuid) from public;
grant execute on function public.get_nganya_style_averages(uuid) to anon, authenticated;

-- A yearly, non-cash community contest. Advancing finalists is a trusted,
-- auditable admin operation; do not automate irreversible elimination without
-- publishing the round dates, vote rules and tie-breaks first.
create table if not exists public.nganya_seasons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  season_year integer not null,
  status text not null default 'draft' check (status in ('draft','open','finalists','closed')),
  opens_on date not null,
  closes_on date not null,
  finalist_limit integer not null default 30 check (finalist_limit = 30),
  created_at timestamptz not null default now(),
  check (closes_on > opens_on)
);
create table if not exists public.nganya_season_entries (
  season_id uuid not null references public.nganya_seasons(id) on delete cascade,
  matatu_id uuid not null references public.nganya_matatus(id) on delete cascade,
  route_code text not null,
  vote_total bigint not null default 0 check (vote_total >= 0),
  finalist boolean not null default false,
  primary key (season_id, matatu_id)
);
create table if not exists public.nganya_season_picks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.nganya_seasons(id) on delete cascade,
  matatu_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (season_id, user_id),
  foreign key (season_id, matatu_id) references public.nganya_season_entries(season_id, matatu_id) on delete cascade
);
alter table public.nganya_seasons enable row level security;
alter table public.nganya_season_entries enable row level security;
alter table public.nganya_season_picks enable row level security;
grant select on public.nganya_seasons, public.nganya_season_entries to anon, authenticated;
grant select, insert on public.nganya_season_picks to authenticated;
create policy "Public can read published seasons" on public.nganya_seasons
  for select to anon, authenticated using (status <> 'draft');
create policy "Public can read published season entries" on public.nganya_season_entries
  for select to anon, authenticated using (exists (select 1 from public.nganya_seasons s where s.id = season_id and s.status <> 'draft'));
create policy "Users read their own season pick" on public.nganya_season_picks
  for select to authenticated using (auth.uid() = user_id);
create policy "Users place one non-cash season pick" on public.nganya_season_picks
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.nganya_seasons s where s.id = season_id and s.status in ('open','finalists'))
    and exists (select 1 from public.nganya_season_entries e where e.season_id = nganya_season_picks.season_id and e.matatu_id = nganya_season_picks.matatu_id and (not (select s.status = 'finalists' from public.nganya_seasons s where s.id = nganya_season_picks.season_id) or e.finalist))
  );

create or replace function public.get_nganya_season_vote_totals(p_opens_on date, p_closes_on date)
returns table (matatu_id uuid, vote_count bigint)
language sql security definer set search_path = public
as $$
  select votes.matatu_id, count(*)::bigint
  from public.nganya_votes votes
  where votes.vote_date between p_opens_on and p_closes_on
  group by votes.matatu_id;
$$;
revoke all on function public.get_nganya_season_vote_totals(date, date) from public;
grant execute on function public.get_nganya_season_vote_totals(date, date) to anon, authenticated;
