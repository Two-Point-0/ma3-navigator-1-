-- Posters: one full-screen poster (picture + key facts) for any mapped place.
-- place_ref = the place's OpenStreetMap id (explore_pois.osm_id) OR any slug you invent for a place that is not on the map yet.
-- If lat/lon/category are filled, the place also becomes a searchable pin on its own.
create table if not exists public.place_posters (
  place_ref text primary key,
  title text not null,
  tagline text,
  poster_url text,
  description text,
  highlights text[],
  hours text,
  price text,
  phone text,
  website text,
  address text,
  tips text,
  lat double precision,
  lon double precision,
  category text,
  subtype text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.place_posters enable row level security;
grant select on public.place_posters to anon, authenticated;
drop policy if exists "Anyone can read active posters" on public.place_posters;
create policy "Anyone can read active posters" on public.place_posters for select to anon, authenticated using (active);

-- Public bucket for the poster pictures. Upload from the Supabase dashboard (Storage > posters).
insert into storage.buckets (id, name, public) values ('posters', 'posters', true) on conflict (id) do nothing;
