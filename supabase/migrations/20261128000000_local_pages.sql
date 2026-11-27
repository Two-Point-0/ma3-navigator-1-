-- Owner-editable business pages: page types with fees, items (products/services/medicines), bookings, admin editing.

alter table public.local_businesses add column if not exists tagline text;
alter table public.local_businesses add column if not exists hours text;
alter table public.local_businesses add column if not exists website text;

-- Which page type a category gets (same table as src/lib/localPlans.ts)
create or replace function public.local_page_type(p_category text) returns text language sql immutable as $$
  select case
    when p_category in ('pharmacy') then 'pharmacy'
    when p_category in ('clinic') then 'clinic'
    when p_category in ('butchery','food','bakery','phone','hardware','electrical','gas') then 'shop'
    when p_category in ('salon','mechanic','carwash','tailor','laundry','gym','daycare','photo','events','tours','cyber','mpesa','bar') then 'services'
    else 'basic' end
$$;

-- Fees and limits. EDIT THESE in Table Editor > local_plans to change prices.
create table if not exists public.local_plans (
  page_type text primary key, label text not null, fee_kes integer not null, max_items integer not null, bookings boolean not null default false
);
insert into public.local_plans (page_type, label, fee_kes, max_items, bookings) values
  ('basic','Basic page',100,3,false), ('shop','Shop page',300,40,false), ('services','Services page',300,30,true),
  ('pharmacy','Pharmacy page',800,300,false), ('clinic','Clinic page',1000,60,true)
on conflict (page_type) do nothing;
alter table public.local_plans enable row level security;
drop policy if exists "Anyone reads plans" on public.local_plans;
create policy "Anyone reads plans" on public.local_plans for select to anon, authenticated using (true);
grant select on public.local_plans to anon, authenticated;

-- Admin helper that tolerates the table not existing yet
create or replace function public.local_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.roast_is_admin(), false)
$$;
grant execute on function public.local_is_admin() to anon, authenticated;

-- Admin can see and edit every business
drop policy if exists "Admin sees all businesses" on public.local_businesses;
create policy "Admin sees all businesses" on public.local_businesses for select to authenticated using (public.local_is_admin());
drop policy if exists "Admin edits all businesses" on public.local_businesses;
create policy "Admin edits all businesses" on public.local_businesses for update to authenticated using (public.local_is_admin()) with check (public.local_is_admin());
drop policy if exists "Admin deletes businesses" on public.local_businesses;
create policy "Admin deletes businesses" on public.local_businesses for delete to authenticated using (public.local_is_admin());

-- Guard: owners cannot change status/paid_until, admin can
create or replace function public.local_businesses_guard() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and current_user not in ('postgres', 'service_role', 'supabase_admin') and not public.local_is_admin() then
    new.status := old.status; new.paid_until := old.paid_until; new.payment_ref := old.payment_ref; new.owner_id := old.owner_id;
  end if;
  return new;
end $$;

-- Items: products, services or medicines
create table if not exists public.local_business_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  kind text not null default 'product',
  name text not null check (char_length(name) between 1 and 120),
  price_kes numeric(12,2) check (price_kes is null or price_kes >= 0),
  note text check (note is null or char_length(note) <= 200),
  image_path text,
  in_stock boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists local_business_items_biz on public.local_business_items (business_id, sort);
alter table public.local_business_items enable row level security;
grant select on public.local_business_items to anon, authenticated;
grant insert, update, delete on public.local_business_items to authenticated;

drop policy if exists "See items of visible businesses" on public.local_business_items;
create policy "See items of visible businesses" on public.local_business_items for select to anon, authenticated
  using (exists (select 1 from public.local_businesses b where b.id = business_id and ((b.status = 'active' and b.paid_until > now()) or b.owner_id = auth.uid())) or public.local_is_admin());
drop policy if exists "Owner or admin writes items" on public.local_business_items;
create policy "Owner or admin writes items" on public.local_business_items for all to authenticated
  using (exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()) or public.local_is_admin())
  with check (exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()) or public.local_is_admin());

-- Item limit by plan
create or replace function public.local_items_limit() returns trigger language plpgsql as $$
declare cat text; lim integer; cnt integer;
begin
  select category into cat from public.local_businesses where id = new.business_id;
  select max_items into lim from public.local_plans where page_type = public.local_page_type(cat);
  select count(*) into cnt from public.local_business_items where business_id = new.business_id;
  if lim is not null and cnt >= lim then raise exception 'Your page allows % items. Upgrade or remove one.', lim; end if;
  return new;
end $$;
drop trigger if exists local_items_limit_trg on public.local_business_items;
create trigger local_items_limit_trg before insert on public.local_business_items for each row execute function public.local_items_limit();

-- Bookings
create table if not exists public.local_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  user_id uuid default auth.uid(),
  name text not null, phone text not null, service text, wanted_at timestamptz, note text,
  status text not null default 'new' check (status in ('new','confirmed','declined','done')),
  created_at timestamptz not null default now()
);
alter table public.local_bookings enable row level security;
grant select, insert, update on public.local_bookings to authenticated;
drop policy if exists "Signed-in users book" on public.local_bookings;
create policy "Signed-in users book" on public.local_bookings for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.local_businesses b where b.id = business_id and b.status = 'active' and b.paid_until > now()));
drop policy if exists "Booker, owner, admin read bookings" on public.local_bookings;
create policy "Booker, owner, admin read bookings" on public.local_bookings for select to authenticated
  using (user_id = auth.uid() or public.local_is_admin() or exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists "Owner or admin updates bookings" on public.local_bookings;
create policy "Owner or admin updates bookings" on public.local_bookings for update to authenticated
  using (public.local_is_admin() or exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- Search also finds item names (e.g. "paracetamol" finds the pharmacy that lists it)
drop function if exists public.search_local_businesses(text, text, double precision, double precision, integer);
create or replace function public.search_local_businesses(
  p_query text default '', p_category text default null,
  p_lat double precision default null, p_lon double precision default null, p_limit integer default 40)
returns table (id uuid, name text, category text, description text, services text[], phone text, whatsapp text,
  address text, latitude double precision, longitude double precision, image_paths text[], distance_km double precision)
language sql stable security invoker set search_path = public as $$
  select b.id, b.name, b.category, b.description, b.services, b.phone, b.whatsapp, b.address, b.latitude, b.longitude, b.image_paths,
    case when p_lat is null or p_lon is null then null
      else 111.0 * sqrt(power(b.latitude - p_lat, 2) + power((b.longitude - p_lon) * cos(radians(p_lat)), 2)) end as distance_km
  from public.local_businesses b
  where b.status = 'active' and b.paid_until > now()
    and (p_category is null or p_category = '' or lower(b.category) = lower(p_category))
    and (coalesce(trim(p_query), '') = '' or
         b.name ilike '%' || trim(p_query) || '%' or b.category ilike '%' || trim(p_query) || '%' or
         b.description ilike '%' || trim(p_query) || '%' or array_to_string(b.services, ' ') ilike '%' || trim(p_query) || '%' or
         exists (select 1 from public.local_business_items i where i.business_id = b.id and i.name ilike '%' || trim(p_query) || '%'))
  order by distance_km nulls last, b.name
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_local_businesses(text, text, double precision, double precision, integer) to anon, authenticated;

-- Admin may upload pictures for any business
drop policy if exists "Admin uploads business images" on storage.objects;
create policy "Admin uploads business images" on storage.objects for insert to authenticated with check (bucket_id = 'business-images' and public.local_is_admin());
drop policy if exists "Admin updates business images" on storage.objects;
create policy "Admin updates business images" on storage.objects for update to authenticated using (bucket_id = 'business-images' and public.local_is_admin());
drop policy if exists "Admin deletes business images" on storage.objects;
create policy "Admin deletes business images" on storage.objects for delete to authenticated using (bucket_id = 'business-images' and public.local_is_admin());
