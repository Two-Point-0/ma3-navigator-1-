-- A client must never grant itself an administrative or driver role by
-- changing profiles.role through the public Supabase API. Trusted database
-- operators and service-role jobs can still manage roles deliberately.
create or replace function public.prevent_client_profile_role_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'passenger' then
      raise exception 'Profile roles are assigned by an administrator';
    end if;
  elsif new.role is distinct from old.role then
    raise exception 'Profile roles cannot be changed through the client API';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_client_profile_role_changes on public.profiles;
create trigger prevent_client_profile_role_changes
  before insert or update of role on public.profiles
  for each row execute function public.prevent_client_profile_role_changes();

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and role = 'passenger');

-- Stop-demand totals reveal when/where riders are waiting. Require an
-- administrator-verified matatu driver and vehicle in the database; the
-- browser's onboarding role is only a navigation preference, never authority.
create or replace function public.get_ma3_waiting_counts(p_route_id text)
returns table (stop_id text, stop_name text, waiting_count integer)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.driver_profiles as driver
    join public.driver_verifications as verification on verification.driver_id = driver.id
    where driver.user_id = auth.uid()
      and driver.driver_type = 'matatu_driver'
      and verification.driver_verification_status = 'verified'
      and verification.vehicle_verification_status = 'verified'
      and verification.licence_expiry >= (now() at time zone 'Africa/Nairobi')::date
      and verification.insurance_expiry >= (now() at time zone 'Africa/Nairobi')::date
      and verification.roadworthiness_expiry >= (now() at time zone 'Africa/Nairobi')::date
  ) then
    raise exception 'A verified matatu driver account is required';
  end if;

  return query
    select waiting.stop_id, stop.name, count(*)::integer
    from public.ma3_stop_waiting as waiting
    join public.ma3_stops as stop on stop.stop_id = waiting.stop_id
    join public.ma3_route_stops as route_stop
      on route_stop.route_id = waiting.route_id and route_stop.stop_id = waiting.stop_id
    where waiting.route_id = p_route_id and waiting.expires_at > now()
    group by waiting.stop_id, stop.name, route_stop.stop_sequence
    order by route_stop.stop_sequence;
end;
$$;
revoke all on function public.get_ma3_waiting_counts(text) from public;
grant execute on function public.get_ma3_waiting_counts(text) to authenticated;
