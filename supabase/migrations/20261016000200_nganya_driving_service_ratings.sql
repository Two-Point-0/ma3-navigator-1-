alter table public.nganya_ratings
  add column if not exists driving smallint check (driving between 1 and 5),
  add column if not exists service smallint check (service between 1 and 5);

drop function if exists public.get_nganya_style_averages(uuid);

create function public.get_nganya_style_averages(p_matatu_id uuid default null)
returns table (matatu_id uuid, artwork numeric, sound numeric, lighting numeric, comfort numeric, driving numeric, service numeric, rating_count bigint)
language sql security definer set search_path = public
as $$
  select r.matatu_id,
         round(avg(r.artwork)::numeric, 1),
         round(avg(r.sound)::numeric, 1),
         round(avg(r.lighting)::numeric, 1),
         round(avg(r.comfort)::numeric, 1),
         round(avg(r.driving)::numeric, 1),
         round(avg(r.service)::numeric, 1),
         count(*)
  from public.nganya_ratings r
  join public.nganya_matatus m on m.id = r.matatu_id and m.active = true
  where p_matatu_id is null or r.matatu_id = p_matatu_id
  group by r.matatu_id;
$$;

revoke all on function public.get_nganya_style_averages(uuid) from public;
grant execute on function public.get_nganya_style_averages(uuid) to anon, authenticated;
