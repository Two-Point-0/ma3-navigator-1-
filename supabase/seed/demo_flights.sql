-- DEMO FLIGHTS: made-up schedules so the Fly page works before real data (Amadeus etc.) is connected.
-- Safe to run many times. Dates are always "from today", so the page never looks empty.
-- Airlines are marked "(demo)" and fares are invented. Remove them later with:
--   delete from public.flight_routes where id like 'demo-%';
with airports(code, name, lon, lat) as (values
  ('NBO','Nairobi (JKIA)',36.9278,-1.3192), ('MBA','Mombasa (Moi)',39.5942,-4.0348), ('KIS','Kisumu',34.7289,-0.0861),
  ('MYD','Malindi',40.1017,-3.2293), ('EDL','Eldoret',35.2389,0.4045), ('LAU','Lamu (Manda)',40.9131,-2.2524),
  ('EBB','Entebbe',32.4435,0.0424), ('DAR','Dar es Salaam',39.2026,-6.8781), ('ADD','Addis Ababa',38.7993,8.9779),
  ('JNB','Johannesburg',28.2460,-26.1392), ('DXB','Dubai',55.3644,25.2532), ('LHR','London Heathrow',-0.4543,51.4700)
), pairs(service, a, b, airline, fare, mins) as (values
  ('domestic','NBO','MBA','Jambojet (demo)',6500,60), ('domestic','NBO','KIS','Kenya Airways (demo)',7200,55),
  ('domestic','NBO','MYD','Safarilink (demo)',9800,75), ('domestic','NBO','EDL','Jambojet (demo)',6900,50),
  ('domestic','NBO','LAU','Safarilink (demo)',12500,95),
  ('international','NBO','EBB','Kenya Airways (demo)',21000,75), ('international','NBO','DAR','Kenya Airways (demo)',24000,95),
  ('international','NBO','ADD','Ethiopian (demo)',32000,120), ('international','NBO','JNB','Kenya Airways (demo)',52000,225),
  ('international','NBO','DXB','Emirates (demo)',48000,300), ('international','NBO','LHR','Kenya Airways (demo)',78000,500)
), legs as (
  select service, a as o, b as d, airline, fare, mins from pairs
  union all select service, b, a, airline, fare, mins from pairs
), slots(slot, hh) as (values (1, 7), (2, 15))
insert into public.flight_routes (id, service_type, airline, flight_number, origin_code, origin_name, destination_code, destination_name,
  departure_at, arrival_at, fare_kes, geometry, source_url, source_updated_at, active)
select
  format('demo-%s-%s-%s-%s', l.o, l.d, to_char(day, 'YYYYMMDD'), s.slot),
  l.service, l.airline, format('DEMO%s%s', s.slot, abs(hashtext(l.o || l.d)) % 900 + 100),
  l.o, ao.name, l.d, ad.name,
  (date_trunc('day', now() at time zone 'Africa/Nairobi') + make_interval(days => g.n, hours => s.hh)) at time zone 'Africa/Nairobi',
  (date_trunc('day', now() at time zone 'Africa/Nairobi') + make_interval(days => g.n, hours => s.hh, mins => l.mins)) at time zone 'Africa/Nairobi',
  l.fare + (g.n % 5) * 400 + s.slot * 300,
  jsonb_build_object('type', 'LineString', 'coordinates', jsonb_build_array(jsonb_build_array(ao.lon, ao.lat), jsonb_build_array(ad.lon, ad.lat))),
  'https://example.com/demo-data', now(), true
from legs l
join airports ao on ao.code = l.o
join airports ad on ad.code = l.d
cross join generate_series(0, 29) as g(n)
cross join slots s
cross join lateral (select date_trunc('day', now()) + make_interval(days => g.n) as day) x
on conflict (id) do update set departure_at = excluded.departure_at, arrival_at = excluded.arrival_at, fare_kes = excluded.fare_kes, source_updated_at = now(), active = true;
