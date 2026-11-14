-- Route King, server-checked version. Replaces the simple score function from the earlier migration.
-- Anti-cheat: a game must be STARTED on the server, and a score is only accepted after a minimum play time, once per session.
-- Crowns: the holder of a crown is shielded for 15 minutes. A "challenge" can break the shield. Beaten kings get a rematch window.

alter table public.route_game_scores add column if not exists bonus boolean not null default false;
alter table public.route_game_scores add column if not exists session_id uuid;

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id in ('trivia','chess','ludo','draughts')),
  started_at timestamptz not null default now(),
  used boolean not null default false
);
create index if not exists game_sessions_user_idx on public.game_sessions(user_id, started_at desc);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from anon, authenticated;

create table if not exists public.route_crowns (
  route_id text not null,
  game_id text not null,
  holder_id uuid not null references auth.users(id) on delete cascade,
  prev_holder_id uuid,
  crowned_at timestamptz not null default now(),
  shield_until timestamptz not null default now() + interval '15 minutes',
  rematch_until timestamptz,
  primary key (route_id, game_id)
);
alter table public.route_crowns enable row level security;
revoke all on public.route_crowns from anon, authenticated;

insert into public.app_settings (key, value) values
  ('king_shield_minutes', '15'), ('king_rematch_hours', '24'), ('king_window_days', '5'),
  ('king_bonus_crown', '10'), ('king_bonus_comeback', '15'), ('king_bonus_challenge_win', '25'), ('king_bonus_defend', '10'),
  ('min_seconds_trivia', '25'), ('min_seconds_chess', '90'), ('min_seconds_ludo', '90')
on conflict (key) do nothing;

create or replace function public.start_game_session(p_game text) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select count(*) from game_sessions where user_id = auth.uid() and started_at > now() - interval '1 hour') > 60 then raise exception 'Too many games this hour'; end if;
  insert into game_sessions (user_id, game_id) values (auth.uid(), p_game) returning id into v;
  return v;
end $$;
revoke all on function public.start_game_session(text) from public, anon;
grant execute on function public.start_game_session(text) to authenticated;

-- Works out who leads a route+game (last N days, weekend points double) and updates the crown.
create or replace function public.route_crown_refresh(p_route text, p_game text) returns void language plpgsql security definer set search_path = public as $$
declare leader uuid; c route_crowns; shield int := setting_int('king_shield_minutes', 15);
begin
  select user_id into leader from (
    select user_id, sum(points * case when extract(isodow from played_at at time zone 'Africa/Nairobi') >= 6 then 2 else 1 end) as pts
    from route_game_scores where route_id = p_route and game_id = p_game and played_at > now() - make_interval(days => setting_int('king_window_days', 5))
    group by user_id order by pts desc limit 1) t;
  if leader is null then return; end if;
  select * into c from route_crowns where route_id = p_route and game_id = p_game;
  if not found then
    insert into route_crowns (route_id, game_id, holder_id, shield_until) values (p_route, p_game, leader, now() + make_interval(mins => shield));
  elsif c.holder_id <> leader and c.shield_until <= now() then
    update route_crowns set prev_holder_id = c.holder_id, holder_id = leader, crowned_at = now(), shield_until = now() + make_interval(mins => shield), rematch_until = now() + make_interval(hours => setting_int('king_rematch_hours', 24))
      where route_id = p_route and game_id = p_game;
    -- crown bonus, or a bigger comeback bonus when a beaten king wins it back inside the rematch window
    insert into route_game_scores (user_id, route_id, game_id, points, bonus)
      values (leader, p_route, p_game, case when leader = c.prev_holder_id and c.rematch_until is not null and c.rematch_until > now() then setting_int('king_bonus_comeback', 15) else setting_int('king_bonus_crown', 10) end, true);
  end if;
end $$;
revoke all on function public.route_crown_refresh(text, text) from public, anon, authenticated;

drop function if exists public.submit_route_game_score(text, text, integer);
-- p_mode: 'normal', 'challenge' (try to take the crown straight away, even during the shield) or 'defend' (the king plays again for a bonus)
create or replace function public.submit_route_game_score(p_route text, p_game text, p_points integer, p_session uuid, p_mode text default 'normal')
returns text language plpgsql security definer set search_path = public as $$
declare s game_sessions; c route_crowns; best integer; message text := 'Score saved.';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_points < 0 or p_points > 100 then raise exception 'Bad score'; end if;
  select * into s from game_sessions where id = p_session and user_id = auth.uid() and game_id = p_game;
  if not found or s.used then raise exception 'This game was not started properly. Start a new game.'; end if;
  if now() - s.started_at < make_interval(secs => setting_int('min_seconds_' || p_game, 30)) then raise exception 'That game was too quick to count.'; end if;
  update game_sessions set used = true where id = p_session;
  insert into route_game_scores (user_id, route_id, game_id, points, session_id) values (auth.uid(), p_route, p_game, p_points, p_session);

  select * into c from route_crowns where route_id = p_route and game_id = p_game;
  if found and p_mode = 'challenge' and c.holder_id <> auth.uid() then
    select coalesce(max(points), 0) into best from route_game_scores where user_id = c.holder_id and route_id = p_route and game_id = p_game and not bonus and played_at > now() - make_interval(days => setting_int('king_window_days', 5));
    if p_points > best then
      update route_crowns set prev_holder_id = holder_id, holder_id = auth.uid(), crowned_at = now(), shield_until = now() + make_interval(mins => setting_int('king_shield_minutes', 15)), rematch_until = now() + make_interval(hours => setting_int('king_rematch_hours', 24)) where route_id = p_route and game_id = p_game;
      insert into route_game_scores (user_id, route_id, game_id, points, bonus) values (auth.uid(), p_route, p_game, setting_int('king_bonus_challenge_win', 25), true);
      message := 'You beat the king and took the crown! Bonus points added.';
    else
      message := 'The king held on this time (their best single game is ' || best || '). Try again.';
    end if;
  elsif found and p_mode = 'defend' and c.holder_id = auth.uid() and p_points >= 60 then
    insert into route_game_scores (user_id, route_id, game_id, points, bonus) values (auth.uid(), p_route, p_game, setting_int('king_bonus_defend', 10), true);
    message := 'Crown defended. Bonus points added.';
  end if;
  perform route_crown_refresh(p_route, p_game);
  return message;
end $$;
revoke all on function public.submit_route_game_score(text, text, integer, uuid, text) from public, anon;
grant execute on function public.submit_route_game_score(text, text, integer, uuid, text) to authenticated;

drop function if exists public.route_king_board(text);
create or replace function public.route_king_board(p_route text)
returns table (player text, total_points numeric, games_led integer, medal text, is_you boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform route_crown_refresh(p_route, g) from unnest(array['trivia','chess','ludo','draughts']) g;
  return query
  with recent as (
    select user_id, sum(points * case when extract(isodow from played_at at time zone 'Africa/Nairobi') >= 6 then 2 else 1 end) as pts
    from route_game_scores where route_id = p_route and played_at > now() - make_interval(days => setting_int('king_window_days', 5)) group by user_id),
  led as (select holder_id as user_id, count(*)::int as n from route_crowns where route_id = p_route group by holder_id)
  select 'Player ' || upper(right(r.user_id::text, 4)), r.pts::numeric, coalesce(l.n, 0),
         case when coalesce(l.n, 0) >= 3 then 'gold' when l.n = 2 then 'silver' when l.n = 1 then 'bronze' else null end,
         r.user_id = auth.uid()
  from recent r left join led l on l.user_id = r.user_id order by r.pts desc limit 20;
end $$;
grant execute on function public.route_king_board(text) to authenticated;

-- Who holds each game's crown on this route, how long the shield lasts, and whether you have a rematch open.
create or replace function public.route_crowns_view(p_route text)
returns table (game_id text, holder text, is_you boolean, shield_left_seconds integer, you_can_rematch boolean)
language sql security definer set search_path = public as $$
  select c.game_id, 'Player ' || upper(right(c.holder_id::text, 4)), c.holder_id = auth.uid(),
         greatest(0, extract(epoch from (c.shield_until - now()))::int),
         (c.prev_holder_id = auth.uid() and c.rematch_until > now())
  from route_crowns c where c.route_id = p_route order by c.game_id;
$$;
grant execute on function public.route_crowns_view(text) to authenticated;
