-- Parcel requests are shared server-side; localStorage is not an assignment system.
create table if not exists public.ma3_driver_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  route_ids text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ma3_driver_profiles enable row level security;
grant select on public.ma3_driver_profiles to authenticated;
drop policy if exists "Drivers read own approval profile" on public.ma3_driver_profiles;
create policy "Drivers read own approval profile" on public.ma3_driver_profiles for select to authenticated using (auth.uid() = user_id);

create table if not exists public.ma3_parcel_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  assigned_driver_id uuid references auth.users(id) on delete set null,
  route_id text not null references public.ma3_routes(route_id) on delete restrict,
  route_name text not null,
  pickup_stop_id text not null references public.ma3_stops(stop_id) on delete restrict,
  pickup_label text not null,
  dropoff_stop_id text not null references public.ma3_stops(stop_id) on delete restrict,
  dropoff_label text not null,
  receiver_name text not null check (length(trim(receiver_name)) between 2 and 100),
  receiver_phone text not null check (receiver_phone ~ '^254[17][0-9]{8}$'),
  parcel_size text not null check (parcel_size in ('envelope','small','medium')),
  estimated_fee_kes integer not null check (estimated_fee_kes >= 0),
  pickup_code_sha256 text not null,
  pickup_code_attempts integer not null default 0 check (pickup_code_attempts between 0 and 5),
  pickup_code_locked_until timestamptz,
  status text not null default 'requested' check (status in ('requested','assigned','picked_up','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_stop_id <> dropoff_stop_id),
  check ((status = 'requested' and assigned_driver_id is null) or (status <> 'requested' and status <> 'cancelled' and assigned_driver_id is not null) or status = 'cancelled')
);
create index if not exists ma3_parcel_requester_recent_idx on public.ma3_parcel_requests(requester_id, created_at desc);
create index if not exists ma3_parcel_open_route_idx on public.ma3_parcel_requests(route_id, created_at) where status = 'requested';
create index if not exists ma3_parcel_driver_recent_idx on public.ma3_parcel_requests(assigned_driver_id, created_at desc) where assigned_driver_id is not null;

alter table public.ma3_parcel_requests enable row level security;
revoke all on public.ma3_parcel_requests from public, anon, authenticated;
grant select (id, requester_id, assigned_driver_id, route_id, route_name, pickup_stop_id, pickup_label,
  dropoff_stop_id, dropoff_label, receiver_name, receiver_phone, parcel_size, estimated_fee_kes,
  status, created_at, updated_at) on public.ma3_parcel_requests to authenticated;
drop policy if exists "Requester or assigned driver reads parcel" on public.ma3_parcel_requests;
create policy "Requester or assigned driver reads parcel" on public.ma3_parcel_requests
  for select to authenticated using (auth.uid() = requester_id or auth.uid() = assigned_driver_id);

-- The requester receives the random pickup code once. Only the hash is stored.
create or replace function public.create_ma3_parcel_request(
  p_route_id text, p_route_name text, p_pickup_stop_id text, p_pickup_label text,
  p_dropoff_stop_id text, p_dropoff_label text, p_receiver_name text,
  p_receiver_phone text, p_parcel_size text, p_estimated_fee_kes integer
) returns table(request_id uuid, pickup_code text)
language plpgsql security definer set search_path = public, extensions
as $$
declare v_code text; v_id uuid; v_random bytea; v_random_integer bigint;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_parcel_size not in ('envelope','small','medium') or p_estimated_fee_kes < 0 or p_estimated_fee_kes > 100000 then raise exception 'Invalid parcel details'; end if;
  if p_receiver_phone !~ '^254[17][0-9]{8}$' then raise exception 'Invalid Kenyan mobile number'; end if;
  if not exists (select 1 from public.ma3_route_stops where route_id = p_route_id and stop_id = p_pickup_stop_id)
     or not exists (select 1 from public.ma3_route_stops where route_id = p_route_id and stop_id = p_dropoff_stop_id)
     or p_pickup_stop_id = p_dropoff_stop_id then raise exception 'Stops must be different stops on the selected route'; end if;
  v_random := extensions.gen_random_bytes(4);
  v_random_integer := get_byte(v_random, 0)::bigint * 16777216
    + get_byte(v_random, 1)::bigint * 65536
    + get_byte(v_random, 2)::bigint * 256 + get_byte(v_random, 3)::bigint;
  v_code := lpad((100000 + (v_random_integer % 900000))::text, 6, '0');
  insert into public.ma3_parcel_requests(requester_id, route_id, route_name, pickup_stop_id, pickup_label,
    dropoff_stop_id, dropoff_label, receiver_name, receiver_phone, parcel_size, estimated_fee_kes, pickup_code_sha256)
  values (auth.uid(), p_route_id, left(trim(p_route_name), 160), p_pickup_stop_id, left(trim(p_pickup_label), 160),
    p_dropoff_stop_id, left(trim(p_dropoff_label), 160), left(trim(p_receiver_name), 100), p_receiver_phone,
    p_parcel_size, p_estimated_fee_kes, encode(extensions.digest(v_code, 'sha256'), 'hex'))
  returning id into v_id;
  return query select v_id, v_code;
end;
$$;

-- Only a currently approved driver assigned to this route can claim it.
create or replace function public.claim_ma3_parcel_request(p_request_id uuid)
returns table(id uuid, route_id text, route_name text, pickup_stop_id text, pickup_label text,
  dropoff_stop_id text, dropoff_label text, receiver_name text, receiver_phone text,
  parcel_size text, estimated_fee_kes integer, status text)
language plpgsql security definer set search_path = public
as $$
declare v_routes text[];
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  select route_ids into v_routes from public.ma3_driver_profiles where user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'Approved driver account required'; end if;
  return query update public.ma3_parcel_requests p
    set assigned_driver_id = auth.uid(), status = 'assigned', updated_at = now()
    where p.id = p_request_id and p.status = 'requested' and p.assigned_driver_id is null and p.route_id = any(v_routes)
    returning p.id, p.route_id, p.route_name, p.pickup_stop_id, p.pickup_label,
      p.dropoff_stop_id, p.dropoff_label, p.receiver_name, p.receiver_phone,
      p.parcel_size, p.estimated_fee_kes, p.status;
  if not found then raise exception 'Request was claimed already or is not on your approved routes'; end if;
end;
$$;

-- Public discovery for approved drivers exposes no recipient name or phone.
create or replace function public.list_open_ma3_parcel_requests()
returns table(id uuid, route_id text, route_name text, pickup_stop_id text, pickup_label text,
  dropoff_stop_id text, dropoff_label text, parcel_size text, estimated_fee_kes integer, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_routes text[];
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  select route_ids into v_routes from public.ma3_driver_profiles where user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'Approved driver account required'; end if;
  return query select p.id, p.route_id, p.route_name, p.pickup_stop_id, p.pickup_label,
    p.dropoff_stop_id, p.dropoff_label, p.parcel_size, p.estimated_fee_kes, p.created_at
    from public.ma3_parcel_requests p where p.status = 'requested' and p.route_id = any(v_routes)
    order by p.created_at asc limit 100;
end;
$$;

create or replace function public.confirm_ma3_parcel_delivery(p_request_id uuid, p_pickup_code text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare v_request public.ma3_parcel_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_pickup_code !~ '^\d{6}$' then raise exception 'Enter the six-digit receiver code'; end if;
  select * into v_request from public.ma3_parcel_requests p
    where p.id = p_request_id and p.assigned_driver_id = auth.uid() and p.status in ('assigned','picked_up')
    for update;
  if not found then return false; end if;
  if v_request.pickup_code_locked_until is not null and v_request.pickup_code_locked_until > now() then return false; end if;
  if v_request.pickup_code_sha256 <> encode(extensions.digest(p_pickup_code, 'sha256'), 'hex') then
    update public.ma3_parcel_requests set pickup_code_attempts = least(pickup_code_attempts + 1, 5),
      pickup_code_locked_until = case when pickup_code_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
      where id = p_request_id;
    return false;
  end if;
  update public.ma3_parcel_requests set status = 'delivered', updated_at = now(), pickup_code_attempts = 0, pickup_code_locked_until = null
    where id = p_request_id;
  return true;
end;
$$;

create or replace function public.cancel_ma3_parcel_request(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.ma3_parcel_requests set status = 'cancelled', updated_at = now()
    where id = p_request_id and requester_id = auth.uid() and status = 'requested';
  return found;
end;
$$;

revoke all on function public.create_ma3_parcel_request(text,text,text,text,text,text,text,text,text,integer) from public, anon;
revoke all on function public.claim_ma3_parcel_request(uuid) from public, anon;
revoke all on function public.list_open_ma3_parcel_requests() from public, anon;
revoke all on function public.confirm_ma3_parcel_delivery(uuid,text) from public, anon;
revoke all on function public.cancel_ma3_parcel_request(uuid) from public, anon;
grant execute on function public.create_ma3_parcel_request(text,text,text,text,text,text,text,text,text,integer) to authenticated;
grant execute on function public.claim_ma3_parcel_request(uuid) to authenticated;
grant execute on function public.list_open_ma3_parcel_requests() to authenticated;
grant execute on function public.confirm_ma3_parcel_delivery(uuid,text) to authenticated;
grant execute on function public.cancel_ma3_parcel_request(uuid) to authenticated;

alter table public.ma3_parcel_requests replica identity full;
comment on table public.ma3_parcel_requests is 'Private parcel requests; requester and assigned driver only. Open discovery is through a redacted approved-driver RPC.';
comment on table public.ma3_driver_profiles is 'Admin-controlled list of drivers approved for specific Ma3 route IDs.';
