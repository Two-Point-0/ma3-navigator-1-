-- Safety fix. If an earlier copy of these two functions was already applied, this replaces it with the corrected version.
-- (create_nganya_order had an ambiguous column name; route_king_board had a number type mismatch.)

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

