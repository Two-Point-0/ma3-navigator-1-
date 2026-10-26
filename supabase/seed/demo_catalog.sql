-- Reference rows only: never seed fabricated products or supermarket prices.
-- Add genuine catalogue records with the CSV workflow in docs/supabase-setup.md.
insert into public.retailers (name, slug) values
  ('Naivas', 'naivas'),
  ('Quickmart', 'quickmart'),
  ('Carrefour', 'carrefour'),
  ('Chandarana Foodplus', 'chandarana'),
  ('Cleanshelf', 'cleanshelf')
on conflict (slug) do nothing;
