-- Sort every Explore place into one of the 3 buttons on the Explore page, inside the database,
-- so the app only downloads the group the person tapped (not all ~87,000 places).
--   food       -> Food & drink
--   stay_shop  -> Stays & shopping (accommodation, shops, thrift)
--   places     -> everything else (sights, services, health, worship, transport, ...)
alter table public.explore_pois
  add column if not exists explore_group text generated always as (
    case
      when category = 'food' then 'food'
      when category in ('stay', 'shop', 'thrift') then 'stay_shop'
      else 'places'
    end
  ) stored;

create index if not exists explore_pois_group_lat_lon_idx
  on public.explore_pois (explore_group, latitude, longitude);
