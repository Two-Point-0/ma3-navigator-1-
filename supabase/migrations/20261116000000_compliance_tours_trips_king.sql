-- STAGE C: legal safeguards, tour-van live location, saved routes + spending, driver earnings, Route King, Explore place photos.
-- Nothing here moves real money.

-- ============ 1. LEGAL SAFEGUARDS ============
-- Signed agreements (artist, vehicle owner, route sacco). Only you (in the Supabase dashboard) can read or edit this table.
create table if not exists public.legal_agreements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('artist_licence','vehicle_owner','route_sacco','platform_terms')),
  party_name text not null,
  document_ref text,                       -- where the signed copy is kept (Drive link, file name)
  signed_on date,
  verified boolean not null default false, -- set true only after a lawyer has seen the signed copy
  created_at timestamptz not null default now()
);
alter table public.legal_agreements enable row level security;
revoke all on public.legal_agreements from anon, authenticated;

-- Split rows start HELD. Nothing is released until you mark them approved after the agreements are verified.
alter table public.order_revenue_splits add column if not exists payout_status text not null default 'held'
  check (payout_status in ('held','approved','paid'));
alter table public.nganya_orders add column if not exists terms_accepted_at timestamptz;
alter table public.nganya_orders add column if not exists privacy_accepted_at timestamptz;

drop function if exists public.create_nganya_order(jsonb, text, text, uuid);
drop function if exists public.create_nganya_order(jsonb, text, text, uuid, boolean);
create or replace function public.create_nganya_order(p_items jsonb, p_phone text, p_note text default null, p_route_sacco uuid default null, p_accept_terms boolean default false)
returns table (new_order_id uuid, new_total_kes numeric) language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_total numeric; r record;
begin
  if auth.uid() is null then raise exception 'Sign in to place an order'; end if;
  if not coalesce(p_accept_terms, false) then raise exception 'Please accept the terms and the privacy notice first'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  select coalesce(sum(p.price_kes * least(99, greatest(1, (i->>'quantity')::int))), 0) into v_total
    from jsonb_array_elements(p_items) i join public.nganya_products p on p.id = (i->>'productId')::uuid
    and p.status = 'active' and p.price_kes > 0 and p.stock_qty > 0 and p.rights_status = 'cleared';
  if v_total <= 0 then raise exception 'None of these products are on sale yet'; end if;
  insert into public.nganya_orders (user_id, phone, delivery_note, route_sacco_id, total_kes, terms_accepted_at, privacy_accepted_at)
    values (auth.uid(), p_phone, p_note, p_route_sacco, v_total, now(), now()) returning id into v_order;
  insert into public.nganya_order_items (order_id, product_id, quantity, unit_price_kes)
    select v_order, p.id, least(99, greatest(1, (i->>'quantity')::int)), p.price_kes
    from jsonb_array_elements(p_items) i join public.nganya_products p on p.id = (i->>'productId')::uuid
    and p.status = 'active' and p.price_kes > 0 and p.stock_qty > 0 and p.rights_status = 'cleared'
    on conflict on constraint nganya_order_items_pkey do nothing;
  select * into r from public.revenue_split_rules where scope = 'nganya_products' and active limit 1;
  if found then
    insert into public.order_revenue_splits (order_id, beneficiary_type, beneficiary_id, amount_kes, payout_status) values
      (v_order, 'platform', null, round(v_total * r.app_pct / 100, 2), 'held'),
      (v_order, 'route_sacco', p_route_sacco, round(v_total * r.route_sacco_pct / 100, 2), 'held'),
      (v_order, 'vehicle_owner', null, round(v_total * r.vehicle_owner_pct / 100, 2), 'held');
  end if;
  return query select v_order, v_total;
end $$;
revoke all on function public.create_nganya_order(jsonb, text, text, uuid, boolean) from public, anon;
grant execute on function public.create_nganya_order(jsonb, text, text, uuid, boolean) to authenticated;
-- A product can only be sold once its artwork rights are marked 'cleared' (set this by hand after the artist licence is signed).

-- The Ma3 "sacco" list is only an interest list. A real sacco must be a registered society (SACCO Societies Act), so no money is taken.
alter table public.sacco_members add column if not exists consent_note text default 'Interest list only. No money is collected and no membership benefits are promised.';

-- Tour operators and transport providers must give their licence number. You verify it by hand.
alter table public.local_businesses add column if not exists licence_no text;
alter table public.local_businesses add column if not exists licence_verified boolean not null default false;
create or replace function public.local_businesses_need_licence() returns trigger language plpgsql as $$
begin
  if new.category in ('tours','transport') and coalesce(btrim(new.licence_no), '') = '' then
    raise exception 'Tour and transport businesses must give their licence number';
  end if;
  return new;
end $$;
drop trigger if exists local_businesses_licence_trg on public.local_businesses;
create trigger local_businesses_licence_trg before insert on public.local_businesses
  for each row execute function public.local_businesses_need_licence();

-- Demo switch: while 'demo_payments' is true, listing/photo fees are skipped. Set it to 'false' (Table Editor, app_settings) before real launch.
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('demo_payments', 'true') on conflict (key) do nothing;

create or replace function public.activate_local_business_demo(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until_ts timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select value from public.app_settings where key = 'demo_payments') is distinct from 'true' then raise exception 'Payment is required to activate this listing'; end if;
  update public.local_businesses set status = 'active', paid_until = until_ts, payment_ref = 'demo' where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Business not found'; end if;
  return until_ts;
end $$;

-- ============ 2. TOUR-VAN LIVE LOCATION ============
create table if not exists public.tour_van_live (
  business_id uuid primary key references public.local_businesses(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -5 and 5.5),
  longitude double precision not null check (longitude between 33 and 42.5),
  last_seen timestamptz not null default now()
);
alter table public.tour_van_live enable row level security;
grant select, insert, update, delete on public.tour_van_live to authenticated;
grant select on public.tour_van_live to anon;
drop policy if exists "Anyone sees fresh live vans" on public.tour_van_live;
create policy "Anyone sees fresh live vans" on public.tour_van_live for select to anon, authenticated using (last_seen > now() - interval '2 minutes');
drop policy if exists "Owners publish their own van" on public.tour_van_live;
create policy "Owners publish their own van" on public.tour_van_live for all to authenticated
  using (owner_id = auth.uid() and exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid() and b.category = 'tours' and b.status = 'active'))
  with check (owner_id = auth.uid() and exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid() and b.category = 'tours' and b.status = 'active'));

-- ============ 3. SAVED ROUTES, SPENDING, DRIVER EARNINGS ============
create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  origin_label text, destination_label text,
  created_at timestamptz not null default now()
);
create table if not exists public.trip_spend (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  saved_route_id uuid references public.saved_routes(id) on delete cascade,
  mode text not null default 'matatu',
  amount_kes numeric(10,2) not null check (amount_kes >= 0 and amount_kes < 100000),
  spent_on date not null default current_date
);
create table if not exists public.driver_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  earned_on date not null default current_date,
  amount_kes numeric(10,2) not null check (amount_kes >= 0 and amount_kes < 1000000),
  fuel_cost_kes numeric(10,2) check (fuel_cost_kes is null or fuel_cost_kes >= 0),
  source text not null default 'fares' check (source in ('fares','carpool','tours','parcels')),
  note text
);
do $$ declare t text; begin
  foreach t in array array['saved_routes','trip_spend','driver_earnings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create or replace function public.my_monthly_route_spend()
returns table (route_name text, month text, total_kes numeric, trips bigint) language sql security invoker set search_path = public as $$
  select coalesce(r.name, 'Other trips'), to_char(s.spent_on, 'YYYY-MM'), sum(s.amount_kes), count(*)
  from public.trip_spend s left join public.saved_routes r on r.id = s.saved_route_id
  where s.user_id = auth.uid() group by 1, 2 order by 2 desc, 3 desc;
$$;
grant execute on function public.my_monthly_route_spend() to authenticated;

-- ============ 4. ROUTE KING ============
create table if not exists public.route_game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_id text not null,
  game_id text not null check (game_id in ('trivia','chess','ludo','draughts')),
  points integer not null check (points between 0 and 100),
  played_at timestamptz not null default now()
);
create index if not exists route_game_scores_idx on public.route_game_scores(route_id, game_id, played_at desc);
alter table public.route_game_scores enable row level security;
revoke all on public.route_game_scores from anon, authenticated;

-- Scores are sent through this function so the app cannot insert arbitrary rows. One score per player per game per minute.
create or replace function public.submit_route_game_score(p_route text, p_game text, p_points integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_points < 0 or p_points > 100 then raise exception 'Bad score'; end if;
  if exists (select 1 from route_game_scores where user_id = auth.uid() and game_id = p_game and played_at > now() - interval '60 seconds') then raise exception 'Slow down, try again in a minute'; end if;
  insert into route_game_scores (route_id, game_id, points) values (p_route, p_game, p_points);
end $$;
revoke all on function public.submit_route_game_score(text, text, integer) from public, anon;
grant execute on function public.submit_route_game_score(text, text, integer) to authenticated;

-- Board for one route: points in the last 5 days (weekend points count double, the "defend your title" rule).
-- Medal = number of different games where the player leads on this route: 1 bronze, 2 silver, 3 or more gold.
create or replace function public.route_king_board(p_route text)
returns table (player text, total_points numeric, games_led integer, medal text, is_you boolean)
language sql security definer set search_path = public as $$
  with recent as (
    select user_id, game_id, sum(points * case when extract(isodow from played_at at time zone 'Africa/Nairobi') >= 6 then 2 else 1 end) as pts
    from route_game_scores where route_id = p_route and played_at > now() - interval '5 days' group by user_id, game_id),
  leaders as (select distinct on (game_id) game_id, user_id from recent order by game_id, pts desc),
  led as (select user_id, count(*)::int as n from leaders group by user_id),
  totals as (select user_id, sum(pts) as total from recent group by user_id)
  select 'Player ' || upper(right(t.user_id::text, 4)), t.total, coalesce(l.n, 0),
         case when coalesce(l.n, 0) >= 3 then 'gold' when l.n = 2 then 'silver' when l.n = 1 then 'bronze' else null end,
         t.user_id = auth.uid()
  from totals t left join led l on l.user_id = t.user_id order by t.total desc limit 20;
$$;
grant execute on function public.route_king_board(text) to authenticated;

-- ============ 5. EXPLORE PLACE PHOTOS ============
create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_ref text not null,                       -- the Explore place id
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_path text not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','active','removed')),
  paid_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_ref_idx on public.place_photos(place_ref);
alter table public.place_photos enable row level security;
grant select on public.place_photos to anon, authenticated;
grant insert, delete on public.place_photos to authenticated;
drop policy if exists "Anyone sees paid photos" on public.place_photos;
create policy "Anyone sees paid photos" on public.place_photos for select to anon, authenticated using ((status = 'active' and paid_until > now()) or owner_id = auth.uid());
drop policy if exists "Owners add pending photos" on public.place_photos;
create policy "Owners add pending photos" on public.place_photos for insert to authenticated with check (owner_id = auth.uid() and status = 'pending_payment');
drop policy if exists "Owners remove their photos" on public.place_photos;
create policy "Owners remove their photos" on public.place_photos for delete to authenticated using (owner_id = auth.uid());

-- Demo activation: the fee decides how many days the photo is shown (7 days / 30 days / 90 days). Replace with the M-Pesa callback later.
create or replace function public.activate_place_photo_demo(p_id uuid, p_days integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_days not in (7, 30, 90) then raise exception 'Choose 7, 30 or 90 days'; end if;
  if (select value from public.app_settings where key = 'demo_payments') is distinct from 'true' then raise exception 'Payment is required to activate this photo'; end if;
  update public.place_photos set status = 'active', paid_until = now() + make_interval(days => p_days) where id = p_id and owner_id = auth.uid();
end $$;
revoke all on function public.activate_place_photo_demo(uuid, integer) from public, anon;
grant execute on function public.activate_place_photo_demo(uuid, integer) to authenticated;

insert into storage.buckets (id, name, public) values ('place-photos', 'place-photos', true) on conflict (id) do nothing;
drop policy if exists "Owners upload place photos" on storage.objects;
create policy "Owners upload place photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Owners delete place photos" on storage.objects;
create policy "Owners delete place photos" on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);
