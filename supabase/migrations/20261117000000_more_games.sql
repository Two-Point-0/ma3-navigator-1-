-- More quick games for Route King. Each still scores 0-100 and uses the same server-started session rules.
do $$
declare t text; c record;
begin
  foreach t in array array['route_game_scores','game_sessions'] loop
    for c in select conname from pg_constraint where conrelid = ('public.' || t)::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%game_id%' loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
    execute format('alter table public.%I add constraint %I check (game_id in (''trivia'',''chess'',''ludo'',''draughts'',''memory'',''g2048'',''snake'',''whack''))', t, t || '_game_id_check');
  end loop;
end $$;

insert into public.app_settings (key, value) values
  ('min_seconds_memory', '20'), ('min_seconds_g2048', '30'), ('min_seconds_snake', '12'), ('min_seconds_whack', '28')
on conflict (key) do nothing;

drop function if exists public.route_king_board(text);
create or replace function public.route_king_board(p_route text)
returns table (player text, total_points numeric, games_led integer, medal text, is_you boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform route_crown_refresh(p_route, g) from unnest(array['trivia','chess','ludo','draughts','memory','g2048','snake','whack']) g;
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
