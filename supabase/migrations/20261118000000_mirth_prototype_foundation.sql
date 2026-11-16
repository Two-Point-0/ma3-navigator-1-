-- Mirth prototype foundations. Rail corridor sequences are explicitly sample data.
-- Room state is intentionally not writable by browser clients; validated multiplayer
-- moves need a trusted server/Edge Function before the room tables can power live play.

create table if not exists public.rail_prototype_lines (
  id text primary key,
  name text not null,
  station_names text[] not null,
  notes text not null,
  is_prototype boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint rail_prototype_lines_sample_only check (is_prototype = true)
);
alter table public.rail_prototype_lines enable row level security;
drop policy if exists "Read prototype rail lines" on public.rail_prototype_lines;
create policy "Read prototype rail lines" on public.rail_prototype_lines for select to anon, authenticated using (is_prototype);
grant select on public.rail_prototype_lines to anon, authenticated;

insert into public.rail_prototype_lines (id, name, station_names, notes, is_prototype) values
('kikuyu-limuru-sample', 'Kikuyu–Limuru sample corridor', array['Nairobi Central (prototype)','Dagoretti Market','Kibera','Jamuhuri railways','Satellite','Mutuini','Thogoto','Kikuyu','Gitaru','Muguga','Limuru Train Station'], 'Sample station order and interchange; not a verified timetable or live service.', true),
('nairobi-ruiru-sample', 'Nairobi–Ruiru sample corridor', array['Nairobi Central (prototype)','Kariobangi South','Umoja/ Mutindwa','Mwiki','Membley/ Gitambaya','Ruiru'], 'Sample station order and interchange; confirm operating service before travel.', true),
('nairobi-mgr-sample', 'Nairobi–Athi River MGR sample corridor', array['Nairobi Central (prototype)','Imara Daima','Athi River (MGR)'], 'Sample station order; service and stop pattern are not verified.', true),
('sgr-south-sample', 'Nairobi Terminus–Lukenya SGR sample corridor', array['Nairobi Terminus','Mlolongo','Athi River (SGR)','Lukenya'], 'Sample station order; does not imply that every mapped point is a passenger stop.', true)
on conflict (id) do update set name = excluded.name, station_names = excluded.station_names, notes = excluded.notes, is_prototype = true, updated_at = now();

-- Add Tycoon to the existing server-checked game IDs without editing old migrations.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.game_sessions'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%game_id%'
  loop execute format('alter table public.game_sessions drop constraint %I', c.conname); end loop;
  for c in select conname from pg_constraint where conrelid = 'public.route_game_scores'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%game_id%'
  loop execute format('alter table public.route_game_scores drop constraint %I', c.conname); end loop;
end $$;
alter table public.game_sessions add constraint game_sessions_game_id_check check (game_id in ('trivia','chess','ludo','draughts','memory','g2048','snake','whack','tycoon'));
alter table public.route_game_scores add constraint route_game_scores_game_id_check check (game_id in ('trivia','chess','ludo','draughts','memory','g2048','snake','whack','tycoon'));
insert into public.app_settings (key, value) values ('min_seconds_tycoon', '20') on conflict (key) do update set value = excluded.value;

create table if not exists public.mirth_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null check (char_length(handle) between 2 and 24),
  xp integer not null default 0 check (xp >= 0),
  avatar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mirth_players_handle_lower_idx on public.mirth_players (lower(handle));
alter table public.mirth_players enable row level security;
drop policy if exists "Signed-in users can read Mirth profiles" on public.mirth_players;
create policy "Signed-in users can read Mirth profiles" on public.mirth_players for select to authenticated using (true);
drop policy if exists "Players manage their own Mirth profile" on public.mirth_players;
create policy "Players manage their own Mirth profile" on public.mirth_players for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.mirth_players from anon, authenticated;
grant select on public.mirth_players to authenticated;
grant insert (user_id, handle, avatar), update (handle, avatar, updated_at) on public.mirth_players to authenticated;

create or replace function public.award_mirth_xp_from_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare earned integer;
begin
  if coalesce(new.bonus, false) = false then
    earned := greatest(0, least(100, coalesce(new.points, 0)));
    insert into public.mirth_players (user_id, handle, xp, avatar)
      values (new.user_id, 'Player-' || upper(left(new.user_id::text, 8)), earned, '{}'::jsonb)
    on conflict (user_id) do update set xp = public.mirth_players.xp + earned, updated_at = now();
  end if;
  return new;
end $$;
drop trigger if exists route_game_score_awards_mirth_xp on public.route_game_scores;
create trigger route_game_score_awards_mirth_xp after insert on public.route_game_scores
  for each row execute function public.award_mirth_xp_from_score();

create or replace function public.mirth_weekly_leaderboard(p_game text default null)
returns table (game_id text, player text, best_score integer, games_played bigint)
language sql stable security definer set search_path = public as $$
  with weekly as (
    select s.user_id, s.game_id, max(s.points)::integer as best_score, count(*)::bigint as games_played
    from public.route_game_scores s
    where s.played_at >= now() - interval '7 days'
      and (p_game is null or s.game_id = p_game)
      and coalesce(s.bonus, false) = false
    group by s.user_id, s.game_id
  ), ranked as (
    select w.game_id, w.user_id, w.best_score, w.games_played from weekly w
    where p_game is null or (p_game <> 'overall' and w.game_id = p_game)
    union all
    select 'overall'::text, w.user_id, sum(w.best_score)::integer, sum(w.games_played)::bigint
    from weekly w where p_game = 'overall' group by w.user_id
  )
  select r.game_id,
         coalesce(p.handle, 'Player ' || upper(right(r.user_id::text, 4))),
         r.best_score, r.games_played
  from ranked r left join public.mirth_players p on p.user_id = r.user_id
  order by r.best_score desc, r.games_played desc, r.game_id
  limit 100;
$$;
revoke all on function public.mirth_weekly_leaderboard(text) from public, anon;
grant execute on function public.mirth_weekly_leaderboard(text) to authenticated;

create table if not exists public.mirth_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{5}$'),
  game_id text not null check (game_id in ('tycoon','chess','ludo','trivia','memory','snake','whack')),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','active','finished','closed')),
  max_players integer not null default 4 check (max_players between 2 and 4),
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now()
);
create index if not exists mirth_rooms_created_idx on public.mirth_rooms (created_at desc);
alter table public.mirth_rooms enable row level security;
revoke all on public.mirth_rooms from anon, authenticated;
grant select on public.mirth_rooms to authenticated;
drop policy if exists "Room members can read their room" on public.mirth_rooms;

create table if not exists public.mirth_room_players (
  room_id uuid not null references public.mirth_rooms(id) on delete cascade,
  seat integer not null check (seat between 1 and 4),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (room_id, seat),
  unique (room_id, user_id)
);
alter table public.mirth_room_players enable row level security;
revoke all on public.mirth_room_players from anon, authenticated;
grant select on public.mirth_room_players to authenticated;
create or replace function public.is_mirth_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mirth_room_players p where p.room_id = p_room and p.user_id = auth.uid());
$$;
revoke all on function public.is_mirth_room_member(uuid) from public, anon;
grant execute on function public.is_mirth_room_member(uuid) to authenticated;
drop policy if exists "Room members can see room participants" on public.mirth_room_players;
create policy "Room members can see room participants" on public.mirth_room_players for select to authenticated
  using (public.is_mirth_room_member(room_id));
create policy "Room members can read their room" on public.mirth_rooms for select to authenticated
  using (public.is_mirth_room_member(id));

create or replace function public.create_mirth_room(p_game_id text)
returns table (room_id uuid, room_code text)
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_id not in ('tycoon','chess','ludo','trivia','memory','snake','whack') then raise exception 'Unsupported game'; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5));
    exit when not exists (select 1 from public.mirth_rooms r where r.code = v_code);
  end loop;
  insert into public.mirth_rooms(code, game_id, host_id) values (v_code, p_game_id, auth.uid()) returning id into v_room;
  insert into public.mirth_room_players(room_id, seat, user_id) values (v_room, 1, auth.uid());
  return query select v_room, v_code;
end $$;
revoke all on function public.create_mirth_room(text) from public, anon;
grant execute on function public.create_mirth_room(text) to authenticated;

create or replace function public.join_mirth_room(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.mirth_rooms; next_seat integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.mirth_rooms where code = upper(trim(p_code)) and status = 'lobby' for update;
  if not found then raise exception 'Room not found or no longer open'; end if;
  if exists (select 1 from public.mirth_room_players where room_id = r.id and user_id = auth.uid()) then return r.id; end if;
  select coalesce(min(candidate), 0) into next_seat from generate_series(1, r.max_players) as seats(candidate)
    where not exists (select 1 from public.mirth_room_players p where p.room_id = r.id and p.seat = candidate);
  if next_seat = 0 then raise exception 'Room is full'; end if;
  insert into public.mirth_room_players(room_id, seat, user_id) values (r.id, next_seat, auth.uid());
  return r.id;
end $$;
revoke all on function public.join_mirth_room(text) from public, anon;
grant execute on function public.join_mirth_room(text) to authenticated;

-- Prevent direct browser writes to room state. A server-validated Edge Function
-- must be added before enabling real-time multiplayer moves.
comment on table public.mirth_rooms is 'Prototype room registry. Browser clients can read rooms they joined but cannot update state; implement server-validated moves before public multiplayer.';
comment on table public.rail_prototype_lines is 'Sample rail connections for UI prototyping only. Replace with authoritative, verified station and service data before launch.';
