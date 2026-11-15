-- Mchongwano Live: friendly roast battles and tournaments, watched live, with the AUDIENCE voting for the winner.
-- Everything is written through functions (security definer); people can only read what the policies below allow.
-- Legal: nobody can play or watch until they accept the 18+ roast terms (see src/data/legalText.ts ROAST). Have a lawyer review those terms.

insert into public.app_settings (key, value) values
  ('roast_turn_seconds', '60'), ('roast_vote_seconds', '20'), ('roast_rounds', '3'), ('roast_terms_version', '2026-11-draft')
on conflict (key) do nothing;

create table if not exists public.roast_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  display_name text not null check (char_length(display_name) between 2 and 24),
  is_adult boolean not null check (is_adult),
  accepted_at timestamptz not null default now()
);
create table if not exists public.roast_tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open','running','finished','cancelled')),
  max_players integer not null default 16 check (max_players between 2 and 64),
  current_round integer not null default 0,
  winner_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.roast_entries (
  tournament_id uuid not null references public.roast_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  eliminated boolean not null default false,
  registered_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create table if not exists public.roast_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.roast_tournaments(id) on delete cascade,
  t_round integer not null default 1,
  title text not null default 'Friendly roast',
  a_id uuid not null references auth.users(id) on delete cascade,
  b_id uuid references auth.users(id) on delete cascade,
  a_name text not null,
  b_name text,
  a_ready boolean not null default true,
  b_ready boolean not null default false,
  status text not null default 'open' check (status in ('open','scheduled','live','finished','cancelled')),
  rounds_total integer not null default 3,
  cur_round integer not null default 1,
  turn_no integer not null default 1,
  phase text not null default 'waiting' check (phase in ('waiting','a_turn','b_turn','done')),
  phase_ends_at timestamptz,
  a_round_wins integer not null default 0,
  b_round_wins integer not null default 0,
  a_total_votes integer not null default 0,
  b_total_votes integer not null default 0,
  winner_id uuid,
  end_reason text,
  video_room text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
create index if not exists roast_matches_status_idx on public.roast_matches(status, created_at desc);
create table if not exists public.roast_lines (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.roast_matches(id) on delete cascade,
  round_no integer not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists roast_lines_match_idx on public.roast_lines(match_id, id);
create table if not exists public.roast_votes (
  match_id uuid not null references public.roast_matches(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  round_no integer not null,
  for_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id, round_no)
);
create table if not exists public.roast_reports (
  id bigint generated always as identity primary key,
  match_id uuid references public.roast_matches(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.roast_blocked_terms (term text primary key);
insert into public.roast_blocked_terms (term) values ('kill you'), ('nitakuua'), ('nitakuchoma'), ('rape you'), ('shoot you'), ('where you live') on conflict do nothing;

alter table public.roast_consents enable row level security;
alter table public.roast_tournaments enable row level security;
alter table public.roast_entries enable row level security;
alter table public.roast_matches enable row level security;
alter table public.roast_lines enable row level security;
alter table public.roast_votes enable row level security;
alter table public.roast_reports enable row level security;
alter table public.roast_blocked_terms enable row level security;
revoke all on public.roast_consents, public.roast_tournaments, public.roast_entries, public.roast_matches, public.roast_lines, public.roast_votes, public.roast_reports, public.roast_blocked_terms from anon, authenticated;
grant select on public.roast_consents, public.roast_tournaments, public.roast_entries, public.roast_matches, public.roast_lines to authenticated;

create or replace function public.has_roast_consent() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from roast_consents where user_id = auth.uid() and is_adult and terms_version = (select value from app_settings where key = 'roast_terms_version'));
$$;
-- Who may create tournaments and pair rounds. Add yourself with supabase/seed/make_roast_admin.sql.
create table if not exists public.roast_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.roast_admins enable row level security;
revoke all on public.roast_admins from anon, authenticated;
create or replace function public.roast_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from roast_admins where user_id = auth.uid());
$$;
grant execute on function public.has_roast_consent(), public.roast_is_admin() to authenticated;

drop policy if exists roast_consents_own on public.roast_consents;
create policy roast_consents_own on public.roast_consents for select to authenticated using (user_id = auth.uid());
drop policy if exists roast_tournaments_read on public.roast_tournaments;
create policy roast_tournaments_read on public.roast_tournaments for select to authenticated using (public.has_roast_consent());
drop policy if exists roast_entries_read on public.roast_entries;
create policy roast_entries_read on public.roast_entries for select to authenticated using (public.has_roast_consent());
drop policy if exists roast_matches_read on public.roast_matches;
create policy roast_matches_read on public.roast_matches for select to authenticated using (public.has_roast_consent());
drop policy if exists roast_lines_read on public.roast_lines;
create policy roast_lines_read on public.roast_lines for select to authenticated using (public.has_roast_consent());

-- helpers ------------------------------------------------------------------
create or replace function public.roast_need_user() returns void language plpgsql as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in with your phone or Google first'; end if;
end $$;

create or replace function public.roast_need_consent() returns void language plpgsql security definer set search_path = public as $$
begin
  perform roast_need_user();
  if not has_roast_consent() then raise exception 'Please accept the roast rules first'; end if;
end $$;

-- consent --------------------------------------------------------------------
create or replace function public.accept_roast_terms(p_name text, p_adult boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  perform roast_need_user();
  if not coalesce(p_adult, false) then raise exception 'Roast battles are for people aged 18 and over'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Choose a stage name (2 to 24 letters)'; end if;
  insert into roast_consents (user_id, terms_version, display_name, is_adult)
  values (auth.uid(), (select value from app_settings where key = 'roast_terms_version'), left(trim(p_name), 24), true)
  on conflict (user_id) do update set terms_version = excluded.terms_version, display_name = excluded.display_name, is_adult = true, accepted_at = now();
end $$;
grant execute on function public.accept_roast_terms(text, boolean) to authenticated;

-- starting matches -----------------------------------------------------------
create or replace function public.roast_create_challenge(p_title text default 'Friendly roast') returns uuid language plpgsql security definer set search_path = public as $$
declare me roast_consents; v uuid;
begin
  perform roast_need_consent();
  select * into me from roast_consents where user_id = auth.uid();
  update roast_matches set status = 'cancelled' where a_id = auth.uid() and status = 'open';
  if exists (select 1 from roast_matches where status = 'live' and (a_id = auth.uid() or b_id = auth.uid())) then raise exception 'You are already in a live battle'; end if;
  insert into roast_matches (title, a_id, a_name, rounds_total) values (left(coalesce(nullif(trim(p_title), ''), 'Friendly roast'), 60), auth.uid(), me.display_name, setting_int('roast_rounds', 3)) returning id into v;
  return v;
end $$;

create or replace function public.roast_start_live(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update roast_matches set status = 'live', cur_round = 1, turn_no = 1, phase = 'a_turn', phase_ends_at = now() + make_interval(secs => setting_int('roast_turn_seconds', 60) + 10) where id = p_match;
end $$;
revoke all on function public.roast_start_live(uuid) from public, anon, authenticated;

create or replace function public.roast_join_match(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches; me roast_consents;
begin
  perform roast_need_consent();
  select * into me from roast_consents where user_id = auth.uid();
  select * into m from roast_matches where id = p_match for update;
  if not found then raise exception 'Battle not found'; end if;
  if m.status = 'open' then
    if m.a_id = auth.uid() then raise exception 'You cannot battle yourself'; end if;
    update roast_matches set b_id = auth.uid(), b_name = me.display_name, b_ready = true where id = p_match;
    perform roast_start_live(p_match);
  elsif m.status = 'scheduled' and (m.a_id = auth.uid() or m.b_id = auth.uid()) then
    update roast_matches set a_ready = a_ready or a_id = auth.uid(), b_ready = b_ready or b_id = auth.uid() where id = p_match;
    if exists (select 1 from roast_matches where id = p_match and a_ready and b_ready) then perform roast_start_live(p_match); end if;
  else raise exception 'This battle is not open to join';
  end if;
end $$;

-- during a battle ------------------------------------------------------------
create or replace function public.roast_finish(p_match uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches; win uuid; lose uuid; left_count integer;
begin
  select * into m from roast_matches where id = p_match for update;
  if m.status <> 'live' then return; end if;
  win := case
    when m.a_round_wins > m.b_round_wins then m.a_id when m.b_round_wins > m.a_round_wins then m.b_id
    when m.a_total_votes > m.b_total_votes then m.a_id when m.b_total_votes > m.a_total_votes then m.b_id else null end;
  update roast_matches set status = 'finished', phase = 'done', winner_id = win, end_reason = p_reason where id = p_match;
  if m.tournament_id is not null then
    lose := case when win = m.a_id then m.b_id when win = m.b_id then m.a_id else null end;
    if lose is not null then update roast_entries set eliminated = true where tournament_id = m.tournament_id and user_id = lose; end if;
    select count(*) into left_count from roast_entries where tournament_id = m.tournament_id and not eliminated;
    if left_count = 1 and not exists (select 1 from roast_matches where tournament_id = m.tournament_id and status in ('open','scheduled','live')) then
      update roast_tournaments set status = 'finished', winner_id = (select user_id from roast_entries where tournament_id = m.tournament_id and not eliminated limit 1) where id = m.tournament_id;
    end if;
  end if;
end $$;
revoke all on function public.roast_finish(uuid, text) from public, anon, authenticated;

-- Anyone watching can call this. It only moves things on when the clock has really run out, so it is safe to call often.
create or replace function public.roast_tick(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches; ra integer; rb integer; turn_s integer := setting_int('roast_turn_seconds', 60); vote_s integer := setting_int('roast_vote_seconds', 20);
begin
  if not exists (select 1 from roast_matches where id = p_match and status = 'live' and phase_ends_at <= now()) then return; end if;
  select * into m from roast_matches where id = p_match for update;
  if not found or m.status <> 'live' or m.phase_ends_at is null or now() < m.phase_ends_at then return; end if;
  if m.turn_no = 1 then
    update roast_matches set turn_no = 2, phase = case when phase = 'a_turn' then 'b_turn' else 'a_turn' end, phase_ends_at = now() + make_interval(secs => turn_s) where id = p_match;
  elsif m.turn_no = 2 then
    -- final call for votes, shown as turn 3
    update roast_matches set turn_no = 3, phase_ends_at = now() + make_interval(secs => vote_s) where id = p_match;
  else
    select count(*) filter (where for_id = m.a_id), count(*) filter (where for_id = m.b_id) into ra, rb from roast_votes where match_id = p_match and round_no = m.cur_round;
    update roast_matches set a_total_votes = a_total_votes + ra, b_total_votes = b_total_votes + rb,
      a_round_wins = a_round_wins + case when ra > rb then 1 else 0 end, b_round_wins = b_round_wins + case when rb > ra then 1 else 0 end where id = p_match;
    if m.cur_round >= m.rounds_total then perform roast_finish(p_match, 'complete');
    else update roast_matches set cur_round = cur_round + 1, turn_no = 1, phase = case when (cur_round + 1) % 2 = 1 then 'a_turn' else 'b_turn' end, phase_ends_at = now() + make_interval(secs => turn_s) where id = p_match;
    end if;
  end if;
end $$;
grant execute on function public.roast_tick(uuid) to authenticated;

create or replace function public.roast_post_line(p_match uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches; body text := trim(coalesce(p_body, '')); t record; mine integer;
begin
  perform roast_need_consent();
  select * into m from roast_matches where id = p_match;
  if not found or m.status <> 'live' or m.turn_no > 2 then raise exception 'It is not a speaking turn right now'; end if;
  if not ((m.phase = 'a_turn' and m.a_id = auth.uid()) or (m.phase = 'b_turn' and m.b_id = auth.uid())) then raise exception 'Wait for your turn'; end if;
  if now() > m.phase_ends_at + interval '2 seconds' then raise exception 'Your time is up'; end if;
  if char_length(body) < 1 then raise exception 'Write something first'; end if;
  for t in select term from roast_blocked_terms loop
    if lower(body) like '%' || t.term || '%' then raise exception 'That line breaks the rules (threats are never allowed). Rewrite it.'; end if;
  end loop;
  select count(*) into mine from roast_lines where match_id = p_match and round_no = m.cur_round and author_id = auth.uid();
  if mine >= 8 then raise exception 'That is enough lines for this turn'; end if;
  insert into roast_lines (match_id, round_no, author_id, body) values (p_match, m.cur_round, auth.uid(), left(body, 280));
end $$;
grant execute on function public.roast_post_line(uuid, text) to authenticated;

create or replace function public.roast_end_turn(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches;
begin
  perform roast_need_consent();
  select * into m from roast_matches where id = p_match;
  if not found or m.status <> 'live' or m.turn_no > 2 then return; end if;
  if (m.phase = 'a_turn' and m.a_id = auth.uid()) or (m.phase = 'b_turn' and m.b_id = auth.uid()) then
    update roast_matches set phase_ends_at = now() where id = p_match;
    perform roast_tick(p_match);
  end if;
end $$;
grant execute on function public.roast_end_turn(uuid) to authenticated;

-- "Enough" button: a fighter can stop at any time. The other fighter wins and nothing more is said.
create or replace function public.roast_stop(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches;
begin
  perform roast_need_user();
  select * into m from roast_matches where id = p_match for update;
  if not found then raise exception 'Battle not found'; end if;
  if m.status = 'open' and m.a_id = auth.uid() then update roast_matches set status = 'cancelled' where id = p_match; return; end if;
  if m.status <> 'live' or auth.uid() not in (m.a_id, m.b_id) then raise exception 'You are not in a live battle here'; end if;
  update roast_matches set a_round_wins = a_round_wins + case when auth.uid() = b_id then 99 else 0 end, b_round_wins = b_round_wins + case when auth.uid() = a_id then 99 else 0 end where id = p_match;
  perform roast_finish(p_match, 'conceded');
end $$;
grant execute on function public.roast_stop(uuid) to authenticated;

create or replace function public.roast_vote(p_match uuid, p_for uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches;
begin
  perform roast_need_consent();
  select * into m from roast_matches where id = p_match;
  if not found or m.status <> 'live' then raise exception 'Voting is closed'; end if;
  if auth.uid() in (m.a_id, m.b_id) then raise exception 'Fighters cannot vote in their own battle'; end if;
  if p_for not in (m.a_id, m.b_id) then raise exception 'Pick one of the two fighters'; end if;
  insert into roast_votes (match_id, voter_id, round_no, for_id) values (p_match, auth.uid(), m.cur_round, p_for)
  on conflict (match_id, voter_id, round_no) do update set for_id = excluded.for_id, created_at = now();
end $$;
grant execute on function public.roast_vote(uuid, uuid) to authenticated;

create or replace function public.roast_report(p_match uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform roast_need_user();
  insert into roast_reports (match_id, reporter_id, reason) values (p_match, auth.uid(), left(coalesce(p_reason, 'No reason given'), 300));
end $$;
grant execute on function public.roast_report(uuid, text) to authenticated;

-- one call that gives the watcher everything on screen ---------------------------
create or replace function public.roast_state(p_match uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare m roast_matches; out jsonb;
begin
  perform roast_need_consent();
  perform roast_tick(p_match);
  select * into m from roast_matches where id = p_match;
  if not found then raise exception 'Battle not found'; end if;
  select jsonb_build_object(
    'match', jsonb_build_object('id', m.id, 'title', m.title, 'status', m.status, 'a_id', m.a_id, 'b_id', m.b_id, 'a_name', m.a_name, 'b_name', m.b_name,
      'cur_round', m.cur_round, 'rounds_total', m.rounds_total, 'turn_no', m.turn_no, 'phase', m.phase,
      'seconds_left', greatest(0, ceil(extract(epoch from (coalesce(m.phase_ends_at, now()) - now())))::int),
      'a_round_wins', m.a_round_wins, 'b_round_wins', m.b_round_wins, 'a_total_votes', m.a_total_votes, 'b_total_votes', m.b_total_votes,
      'winner_id', m.winner_id, 'end_reason', m.end_reason, 'video_room', m.video_room, 'tournament_id', m.tournament_id,
      'a_ready', m.a_ready, 'b_ready', m.b_ready),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'round_no', l.round_no, 'author_id', l.author_id, 'body', l.body, 'at', l.created_at) order by l.id) from roast_lines l where l.match_id = p_match), '[]'::jsonb),
    'votes_a', (select count(*) from roast_votes v where v.match_id = p_match and v.round_no = m.cur_round and v.for_id = m.a_id),
    'votes_b', (select count(*) from roast_votes v where v.match_id = p_match and v.round_no = m.cur_round and v.for_id = m.b_id),
    'my_vote', (select for_id from roast_votes v where v.match_id = p_match and v.round_no = m.cur_round and v.voter_id = auth.uid()),
    'me', auth.uid()
  ) into out;
  return out;
end $$;
grant execute on function public.roast_state(uuid) to authenticated;

-- lobby: open challenges, live battles, tournaments --------------------------------
create or replace function public.roast_lobby() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform roast_need_consent();
  return jsonb_build_object(
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'a_id', a_id, 'a_name', a_name, 'created_at', created_at) order by created_at desc) from roast_matches where status = 'open' and created_at > now() - interval '30 minutes'), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'a_name', a_name, 'b_name', b_name, 'cur_round', cur_round, 'rounds_total', rounds_total) order by created_at desc) from roast_matches where status = 'live'), '[]'::jsonb),
    'mine_waiting', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'a_name', a_name, 'b_name', b_name, 'a_ready', a_ready, 'b_ready', b_ready, 'a_id', a_id, 'b_id', b_id)) from roast_matches where status = 'scheduled' and auth.uid() in (a_id, b_id)), '[]'::jsonb),
    'tournaments', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'starts_at', t.starts_at, 'status', t.status, 'max_players', t.max_players, 'current_round', t.current_round,
        'entries', (select count(*) from roast_entries e where e.tournament_id = t.id), 'registered', exists (select 1 from roast_entries e where e.tournament_id = t.id and e.user_id = auth.uid()),
        'eliminated', coalesce((select e.eliminated from roast_entries e where e.tournament_id = t.id and e.user_id = auth.uid()), false),
        'winner', (select c.display_name from roast_consents c where c.user_id = t.winner_id)) order by t.created_at desc) from roast_tournaments t where t.status in ('open','running') or t.created_at > now() - interval '3 days'), '[]'::jsonb),
    'me', auth.uid()
  );
end $$;
grant execute on function public.roast_lobby() to authenticated;

-- tournaments -----------------------------------------------------------------
create or replace function public.roast_register(p_tournament uuid) returns void language plpgsql security definer set search_path = public as $$
declare t roast_tournaments; me roast_consents;
begin
  perform roast_need_consent();
  select * into me from roast_consents where user_id = auth.uid();
  select * into t from roast_tournaments where id = p_tournament for update;
  if not found or t.status <> 'open' then raise exception 'Registration is closed'; end if;
  if (select count(*) from roast_entries where tournament_id = p_tournament) >= t.max_players then raise exception 'This tournament is full'; end if;
  insert into roast_entries (tournament_id, user_id, display_name) values (p_tournament, auth.uid(), me.display_name) on conflict do nothing;
end $$;
grant execute on function public.roast_register(uuid) to authenticated;

create or replace function public.roast_unregister(p_tournament uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform roast_need_user();
  delete from roast_entries where tournament_id = p_tournament and user_id = auth.uid() and exists (select 1 from roast_tournaments where id = p_tournament and status = 'open');
end $$;
grant execute on function public.roast_unregister(uuid) to authenticated;

create or replace function public.roast_admin_create_tournament(p_title text, p_starts timestamptz, p_max integer default 16) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not roast_is_admin() then raise exception 'Admins only'; end if;
  insert into roast_tournaments (title, starts_at, max_players, created_by) values (p_title, p_starts, least(64, greatest(2, p_max)), auth.uid()) returning id into v;
  return v;
end $$;
grant execute on function public.roast_admin_create_tournament(text, timestamptz, integer) to authenticated;

-- Pairs everyone still in, at random, into scheduled battles. Players then press "I'm ready" and the battle goes live.
create or replace function public.roast_admin_next_round(p_tournament uuid) returns integer language plpgsql security definer set search_path = public as $$
declare t roast_tournaments; ids uuid[]; i integer; made integer := 0; na text; nb text;
begin
  if not roast_is_admin() then raise exception 'Admins only'; end if;
  select * into t from roast_tournaments where id = p_tournament for update;
  if not found or t.status not in ('open','running') then raise exception 'Tournament is not active'; end if;
  if exists (select 1 from roast_matches where tournament_id = p_tournament and status in ('open','scheduled','live')) then raise exception 'Finish the current round first'; end if;
  select array_agg(user_id order by random()) into ids from roast_entries where tournament_id = p_tournament and not eliminated;
  if ids is null or array_length(ids, 1) < 2 then raise exception 'Not enough players'; end if;
  update roast_tournaments set status = 'running', current_round = current_round + 1 where id = p_tournament;
  i := 1;
  while i + 1 <= array_length(ids, 1) loop
    select display_name into na from roast_entries where tournament_id = p_tournament and user_id = ids[i];
    select display_name into nb from roast_entries where tournament_id = p_tournament and user_id = ids[i + 1];
    insert into roast_matches (tournament_id, t_round, title, a_id, b_id, a_name, b_name, a_ready, b_ready, status, rounds_total)
    values (p_tournament, t.current_round + 1, t.title || ' · round ' || (t.current_round + 1), ids[i], ids[i + 1], na, nb, false, false, 'scheduled', setting_int('roast_rounds', 3));
    made := made + 1; i := i + 2;
  end loop;
  return made;
end $$;
grant execute on function public.roast_admin_next_round(uuid) to authenticated;

-- If a fighter does not turn up, an admin gives the match to the other fighter.
create or replace function public.roast_admin_forfeit(p_match uuid, p_absent uuid) returns void language plpgsql security definer set search_path = public as $$
declare m roast_matches;
begin
  if not roast_is_admin() then raise exception 'Admins only'; end if;
  select * into m from roast_matches where id = p_match for update;
  if not found or m.status not in ('scheduled','live') then raise exception 'Nothing to forfeit'; end if;
  update roast_matches set status = 'live', a_round_wins = case when p_absent = b_id then 99 else 0 end, b_round_wins = case when p_absent = a_id then 99 else 0 end where id = p_match;
  perform roast_finish(p_match, 'forfeit');
end $$;
grant execute on function public.roast_admin_forfeit(uuid, uuid) to authenticated;

-- live updates for watchers ------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.roast_matches; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.roast_lines; exception when duplicate_object then null; end;
  end if;
end $$;
