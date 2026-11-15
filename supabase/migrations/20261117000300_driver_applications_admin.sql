-- Real driver sign-up: a driver applies in the app, an admin approves in the app (no SQL needed per driver).
alter table public.ma3_driver_profiles
  add column if not exists full_name text,
  add column if not exists vehicle_plate text,
  add column if not exists contact text,
  add column if not exists requested_route_ids text[] not null default '{}';

create or replace function public.apply_matatu_driver(p_name text, p_plate text, p_routes text[])
returns void language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in first'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your full name'; end if;
  if char_length(trim(coalesce(p_plate, ''))) < 5 then raise exception 'Enter your number plate, e.g. KDA 123A'; end if;
  if coalesce(array_length(p_routes, 1), 0) < 1 or array_length(p_routes, 1) > 5 then raise exception 'Choose 1 to 5 routes'; end if;
  select coalesce(phone, email) into who from auth.users where id = auth.uid();
  insert into ma3_driver_profiles (user_id, status, full_name, vehicle_plate, contact, requested_route_ids)
  values (auth.uid(), 'pending', left(trim(p_name), 60), upper(left(trim(p_plate), 12)), who, p_routes)
  on conflict (user_id) do update set full_name = excluded.full_name, vehicle_plate = excluded.vehicle_plate, contact = excluded.contact, requested_route_ids = excluded.requested_route_ids,
    status = case when ma3_driver_profiles.status = 'approved' then 'approved' else 'pending' end;
end $$;
grant execute on function public.apply_matatu_driver(text, text, text[]) to authenticated;

create or replace function public.admin_list_drivers()
returns table (user_id uuid, full_name text, vehicle_plate text, contact text, status text, requested_route_ids text[], route_ids text[], created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not roast_is_admin() then raise exception 'Admins only'; end if;
  return query select p.user_id, p.full_name, p.vehicle_plate, p.contact, p.status, p.requested_route_ids, p.route_ids, p.created_at
  from ma3_driver_profiles p order by (p.status = 'pending') desc, p.created_at desc limit 200;
end $$;
grant execute on function public.admin_list_drivers() to authenticated;

create or replace function public.admin_set_driver_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not roast_is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('approved', 'suspended', 'pending') then raise exception 'Bad status'; end if;
  update ma3_driver_profiles set status = p_status, reviewed_at = now(),
    route_ids = case when p_status = 'approved' and coalesce(array_length(route_ids, 1), 0) = 0 then requested_route_ids else route_ids end
  where user_id = p_user;
end $$;
grant execute on function public.admin_set_driver_status(uuid, text) to authenticated;
