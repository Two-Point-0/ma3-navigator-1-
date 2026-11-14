-- 1) LOCAL BUSINESSES: small businesses pin themselves on the map and get a one-page listing.
create table if not exists public.local_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (char_length(category) between 2 and 40),
  description text not null check (char_length(description) between 10 and 1200),
  services text[] not null default '{}',
  phone text check (phone is null or char_length(phone) <= 20),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 20),
  address text check (address is null or char_length(address) <= 160),
  latitude double precision not null check (latitude between -5 and 5.5),
  longitude double precision not null check (longitude between 33 and 42),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 5),
  status text not null default 'pending_payment' check (status in ('pending_payment','active','paused')),
  paid_until timestamptz,
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists local_businesses_category_idx on public.local_businesses (category);
create index if not exists local_businesses_geo_idx on public.local_businesses (latitude, longitude);
alter table public.local_businesses enable row level security;

grant select on public.local_businesses to anon, authenticated;
grant insert, update, delete on public.local_businesses to authenticated;

drop policy if exists "Anyone can see paid, active businesses" on public.local_businesses;
create policy "Anyone can see paid, active businesses" on public.local_businesses for select to anon, authenticated
  using ((status = 'active' and paid_until > now()) or owner_id = auth.uid());
drop policy if exists "Owners add their own businesses" on public.local_businesses;
create policy "Owners add their own businesses" on public.local_businesses for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending_payment' and paid_until is null);
drop policy if exists "Owners edit their own businesses" on public.local_businesses;
create policy "Owners edit their own businesses" on public.local_businesses for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owners delete their own businesses" on public.local_businesses;
create policy "Owners delete their own businesses" on public.local_businesses for delete to authenticated
  using (owner_id = auth.uid());

-- Owners may not give themselves a paid listing by editing status or paid_until directly.
create or replace function public.local_businesses_guard() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.status := old.status; new.paid_until := old.paid_until; new.payment_ref := old.payment_ref; new.owner_id := old.owner_id;
  end if;
  return new;
end $$;
drop trigger if exists local_businesses_guard_trg on public.local_businesses;
create trigger local_businesses_guard_trg before update on public.local_businesses
  for each row execute function public.local_businesses_guard();

-- DEMO activation: lets the owner start a 30-day listing while real M-Pesa is switched off.
-- When real payments are enabled, replace this with the M-Pesa callback that sets paid_until.
create or replace function public.activate_local_business_demo(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until_ts timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.local_businesses
     set status = 'active', paid_until = until_ts, payment_ref = 'demo'
   where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Business not found'; end if;
  return until_ts;
end $$;
revoke all on function public.activate_local_business_demo(uuid) from public, anon;
grant execute on function public.activate_local_business_demo(uuid) to authenticated;

-- Search: by words (name, category, description, services), optional category, nearest first when a location is given.
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
         b.description ilike '%' || trim(p_query) || '%' or array_to_string(b.services, ' ') ilike '%' || trim(p_query) || '%')
  order by distance_km nulls last, b.name
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_local_businesses(text, text, double precision, double precision, integer) to anon, authenticated;

-- Photos: public bucket; each owner uploads only inside their own folder.
insert into storage.buckets (id, name, public) values ('business-images', 'business-images', true) on conflict (id) do nothing;
drop policy if exists "Owners upload business images" on storage.objects;
create policy "Owners upload business images" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Owners delete business images" on storage.objects;
create policy "Owners delete business images" on storage.objects for delete to authenticated
  using (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text);
