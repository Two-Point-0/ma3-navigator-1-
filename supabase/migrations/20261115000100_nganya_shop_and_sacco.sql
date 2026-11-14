-- NGANYA SHOP: the merchandise catalogue, orders, route saccos and the revenue split.
-- Nothing here takes real money: payments stay in demo mode until M-Pesa is tested.

create table if not exists public.nganya_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'other',
  price_kes numeric(10,2) check (price_kes is null or price_kes >= 0),   -- blank until you confirm a price
  stock_qty integer not null default 0 check (stock_qty >= 0),
  status text not null default 'concept' check (status in ('concept','draft','active','sold_out')),
  image_path text,
  alt_text text,
  artist_credit text,
  owner_credit text,
  rights_status text not null default 'pending',
  sponsored boolean not null default false,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.nganya_products enable row level security;
grant select on public.nganya_products to anon, authenticated;
drop policy if exists "Anyone can see visible nganya products" on public.nganya_products;
create policy "Anyone can see visible nganya products" on public.nganya_products for select to anon, authenticated using (visible);

-- "I would buy this" taps help you decide which products to make and what to charge.
create table if not exists public.nganya_product_interest (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.nganya_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.nganya_product_interest enable row level security;
grant select, insert, delete on public.nganya_product_interest to authenticated;
drop policy if exists "People manage their own interest taps" on public.nganya_product_interest;
create policy "People manage their own interest taps" on public.nganya_product_interest for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- SACCOS: one platform sacco ("Ma3 Sacco") with a route sacco under it for each matatu route. Any citizen can join.
create table if not exists public.saccos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('platform','route')),
  route_id text unique references public.ma3_routes(route_id) on delete set null,
  parent_id uuid references public.saccos(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.saccos (name, kind) select 'Ma3 Sacco', 'platform' where not exists (select 1 from public.saccos where kind = 'platform');
alter table public.saccos enable row level security;
grant select on public.saccos to anon, authenticated;
drop policy if exists "Anyone can see saccos" on public.saccos;
create policy "Anyone can see saccos" on public.saccos for select to anon, authenticated using (active);

create table if not exists public.sacco_members (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sacco_id uuid not null references public.saccos(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, sacco_id)
);
alter table public.sacco_members enable row level security;
grant select, insert, delete on public.sacco_members to authenticated;
drop policy if exists "Members manage their own membership" on public.sacco_members;
create policy "Members manage their own membership" on public.sacco_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Creates (once) the sacco for a route, named after the route.
create or replace function public.get_or_create_route_sacco(p_route_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_parent uuid;
begin
  select id into v_id from public.saccos where route_id = p_route_id;
  if v_id is not null then return v_id; end if;
  select coalesce(nullif(short_name, ''), route_id) into v_name from public.ma3_routes where route_id = p_route_id;
  if v_name is null then raise exception 'Unknown route'; end if;
  select id into v_parent from public.saccos where kind = 'platform' limit 1;
  insert into public.saccos (name, kind, route_id, parent_id) values ('Route ' || v_name || ' Sacco', 'route', p_route_id, v_parent) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.get_or_create_route_sacco(text) from public, anon;
grant execute on function public.get_or_create_route_sacco(text) to authenticated;

-- The split is data, not code, so you can change it when the signed agreements say otherwise.
create table if not exists public.revenue_split_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'nganya_products',
  app_pct numeric(5,2) not null, route_sacco_pct numeric(5,2) not null, vehicle_owner_pct numeric(5,2) not null,
  active boolean not null default true,
  note text,
  check (app_pct + route_sacco_pct + vehicle_owner_pct = 100)
);
insert into public.revenue_split_rules (scope, app_pct, route_sacco_pct, vehicle_owner_pct, note)
select 'nganya_products', 70, 15, 15, 'Owner''s starting plan. Confirm against signed artist, owner and sacco agreements.'
where not exists (select 1 from public.revenue_split_rules where scope = 'nganya_products');
alter table public.revenue_split_rules enable row level security;
grant select on public.revenue_split_rules to anon, authenticated;
drop policy if exists "Anyone can read the split" on public.revenue_split_rules;
create policy "Anyone can read the split" on public.revenue_split_rules for select to anon, authenticated using (active);

-- ORDERS
create table if not exists public.nganya_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phone text not null check (char_length(phone) between 9 and 20),
  delivery_note text check (delivery_note is null or char_length(delivery_note) <= 300),
  route_sacco_id uuid references public.saccos(id),
  total_kes numeric(12,2) not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','packed','delivered','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.nganya_order_items (
  order_id uuid not null references public.nganya_orders(id) on delete cascade,
  product_id uuid not null references public.nganya_products(id),
  quantity integer not null check (quantity between 1 and 99),
  unit_price_kes numeric(10,2) not null,
  primary key (order_id, product_id)
);
-- What each order earns for the app, the route sacco and the vehicle owner. Nothing is paid out automatically.
create table if not exists public.order_revenue_splits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.nganya_orders(id) on delete cascade,
  beneficiary_type text not null check (beneficiary_type in ('platform','route_sacco','vehicle_owner')),
  beneficiary_id uuid,
  amount_kes numeric(12,2) not null,
  status text not null default 'accrued' check (status in ('accrued','paid_out','void'))
);
alter table public.nganya_orders enable row level security;
alter table public.nganya_order_items enable row level security;
alter table public.order_revenue_splits enable row level security;
grant select on public.nganya_orders, public.nganya_order_items to authenticated;
drop policy if exists "Buyers read their own orders" on public.nganya_orders;
create policy "Buyers read their own orders" on public.nganya_orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "Buyers read their own order lines" on public.nganya_order_items;
create policy "Buyers read their own order lines" on public.nganya_order_items for select to authenticated
  using (exists (select 1 from public.nganya_orders o where o.id = order_id and o.user_id = auth.uid()));

-- Only products that are on sale (active, priced, in stock) can be ordered. Prices come from the server, never the browser.
create or replace function public.create_nganya_order(p_items jsonb, p_phone text, p_note text default null, p_route_sacco uuid default null)
returns table (order_id uuid, total_kes numeric) language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_total numeric; r record;
begin
  if auth.uid() is null then raise exception 'Sign in to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  select coalesce(sum(p.price_kes * least(99, greatest(1, (i->>'quantity')::int))), 0) into v_total
    from jsonb_array_elements(p_items) i join public.nganya_products p on p.id = (i->>'productId')::uuid
    and p.status = 'active' and p.price_kes > 0 and p.stock_qty > 0;
  if v_total <= 0 then raise exception 'None of these products are on sale yet'; end if;
  insert into public.nganya_orders (user_id, phone, delivery_note, route_sacco_id, total_kes) values (auth.uid(), p_phone, p_note, p_route_sacco, v_total) returning id into v_order;
  insert into public.nganya_order_items (order_id, product_id, quantity, unit_price_kes)
    select v_order, p.id, least(99, greatest(1, (i->>'quantity')::int)), p.price_kes
    from jsonb_array_elements(p_items) i join public.nganya_products p on p.id = (i->>'productId')::uuid
    and p.status = 'active' and p.price_kes > 0 and p.stock_qty > 0
    on conflict (order_id, product_id) do nothing;
  select * into r from public.revenue_split_rules where scope = 'nganya_products' and active limit 1;
  if found then
    insert into public.order_revenue_splits (order_id, beneficiary_type, beneficiary_id, amount_kes) values
      (v_order, 'platform', null, round(v_total * r.app_pct / 100, 2)),
      (v_order, 'route_sacco', p_route_sacco, round(v_total * r.route_sacco_pct / 100, 2)),
      (v_order, 'vehicle_owner', null, round(v_total * r.vehicle_owner_pct / 100, 2));
  end if;
  return query select v_order, v_total;
end $$;
revoke all on function public.create_nganya_order(jsonb, text, text, uuid) from public, anon;
grant execute on function public.create_nganya_order(jsonb, text, text, uuid) to authenticated;

insert into storage.buckets (id, name, public) values ('nganya-products', 'nganya-products', true) on conflict (id) do nothing;
