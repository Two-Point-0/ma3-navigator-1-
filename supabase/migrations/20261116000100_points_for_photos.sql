-- Game points can pay for an Explore place photo. Points have no cash value and cannot be cashed out.
-- >>> OWNER DECISION NEEDED: the numbers below are my starting guesses. Change them any time in Table Editor > app_settings. <<<
--   photo_points_7 / _30 / _90 : points a 7, 30 or 90 day photo costs
--   points_daily_cap          : most points that count toward spending per player per day (stops all-night grinding)
-- With the cap at 2,000 a day, a 7-day photo (10,000 points) takes at least 5 days of play, roughly 10+ hours of games.
insert into public.app_settings (key, value) values
  ('photo_points_7', '10000'), ('photo_points_30', '30000'), ('photo_points_90', '80000'), ('points_daily_cap', '2000')
on conflict (key) do nothing;

create table if not exists public.points_spent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.points_spent enable row level security;
revoke all on public.points_spent from anon, authenticated;

create or replace function public.setting_int(p_key text, p_default integer) returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select value::integer from public.app_settings where key = p_key), p_default);
$$;
revoke all on function public.setting_int(text, integer) from public, anon, authenticated;

create or replace function public.my_spendable_points() returns integer language sql security definer set search_path = public as $$
  select greatest(0,
    coalesce((select sum(least(day_total, public.setting_int('points_daily_cap', 2000)))
              from (select sum(points) as day_total from public.route_game_scores where user_id = auth.uid()
                    group by (played_at at time zone 'Africa/Nairobi')::date) d), 0)::integer
    - coalesce((select sum(amount) from public.points_spent where user_id = auth.uid()), 0)::integer);
$$;
revoke all on function public.my_spendable_points() from public, anon;
grant execute on function public.my_spendable_points() to authenticated;

create or replace function public.activate_place_photo_with_points(p_id uuid, p_days integer) returns integer
language plpgsql security definer set search_path = public as $$
declare cost integer; have integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_days not in (7, 30, 90) then raise exception 'Choose 7, 30 or 90 days'; end if;
  cost := public.setting_int('photo_points_' || p_days, 10000);
  have := public.my_spendable_points();
  if have < cost then raise exception 'You need % points but have %', cost, have; end if;
  update public.place_photos set status = 'active', paid_until = now() + make_interval(days => p_days) where id = p_id and owner_id = auth.uid() and status = 'pending_payment';
  if not found then raise exception 'Photo not found or already live'; end if;
  insert into public.points_spent (user_id, amount, reason) values (auth.uid(), cost, 'place photo ' || p_days || ' days');
  return have - cost;
end $$;
revoke all on function public.activate_place_photo_with_points(uuid, integer) from public, anon;
grant execute on function public.activate_place_photo_with_points(uuid, integer) to authenticated;

-- Games added so more than trivia can feed Route King.
alter table public.route_game_scores drop constraint if exists route_game_scores_game_id_check;
alter table public.route_game_scores add constraint route_game_scores_game_id_check check (game_id in ('trivia','chess','ludo','draughts'));
