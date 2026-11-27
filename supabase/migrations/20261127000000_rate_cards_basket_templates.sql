-- Matatu rate cards (demo vehicles) + ready-made basket templates. Safe to run more than once.

-- 1. Rate card numbers for the demo matatus. Edit any value in Table Editor > demo_vehicles.
alter table public.demo_vehicles add column if not exists image_path text;      -- optional: file name inside Storage > posters > matatus
alter table public.demo_vehicles add column if not exists armour smallint check (armour between 0 and 100);
alter table public.demo_vehicles add column if not exists sound smallint check (sound between 0 and 100);
alter table public.demo_vehicles add column if not exists speed_score smallint check (speed_score between 0 and 100);
alter table public.demo_vehicles add column if not exists value_score smallint check (value_score between 0 and 100);
alter table public.demo_vehicles add column if not exists fare_kes integer check (fare_kes >= 0);

update public.demo_vehicles set
  armour = 58 + (abs(hashtext(id || 'a')) % 41),
  sound = 58 + (abs(hashtext(id || 's')) % 41),
  speed_score = 58 + (abs(hashtext(id || 'p')) % 41),
  value_score = 58 + (abs(hashtext(id || 'v')) % 41),
  fare_kes = 40 + (abs(hashtext(coalesce(route_id, ''))) % 7) * 10
where kind = 'matatu' and armour is null;
grant select on public.demo_vehicles to anon, authenticated;

-- 2. Ready-made baskets. Each line is typed like a shopper would write it; the app matches it to your products.
create table if not exists public.basket_templates (
  id text primary key,
  name text not null,
  blurb text not null default '',
  items text[] not null,
  sort integer not null default 100,
  active boolean not null default true
);
alter table public.basket_templates enable row level security;
drop policy if exists "Anyone can read basket templates" on public.basket_templates;
create policy "Anyone can read basket templates" on public.basket_templates for select to anon, authenticated using (active);
revoke all on public.basket_templates from public, anon, authenticated;
grant select on public.basket_templates to anon, authenticated;

insert into public.basket_templates (id, name, blurb, items, sort) values
('monthly-staples', 'Monthly staples (family of 4)', 'Flour, rice, sugar, oil and the basics', array['2 maize flour 2kg', 'wheat flour 2kg', 'rice pishori 2kg', 'sugar 2kg', 'cooking oil 2L', 'salt', 'beans 1kg', 'tea leaves', 'fresh milk', 'eggs'], 1),
('student-essentials', 'Student essentials', 'Cheap food and soap for the hostel', array['rice long grain 1kg', 'spaghetti', 'bread brown', 'eggs', 'tea bags', 'sugar 1kg', 'cooking oil 500ml', 'bar soap', 'toothpaste', 'toilet paper'], 2),
('breakfast-basics', 'Breakfast basics', 'Bread, milk, tea, eggs and spread', array['bread white', 'fresh milk', 'eggs', 'tea leaves', 'sugar 1kg', 'margarine', 'peanut butter', 'oats'], 3),
('cooking-basics', 'Cooking basics', 'What every kitchen runs out of', array['cooking oil 1L', 'tomato paste', 'stock cubes', 'curry powder', 'salt', 'onions', 'tomatoes', 'potatoes'], 4),
('veggie-run', 'Veggie market run', 'Weekly fresh vegetables', array['sukuma wiki', 'spinach', 'cabbage', 'carrots', 'tomatoes', 'onions', 'potatoes'], 5),
('fruit-basket', 'Fruit basket', 'Fruit for the week', array['bananas', 'avocado', 'oranges', 'watermelon', 'mangoes'], 6),
('nyama-choma', 'Nyama choma party', 'Meat, charcoal and drinks for a weekend', array['beef', 'sausages', 'charcoal', 'matchbox', 'tomatoes', 'onions', '2 soda', 'bottled water'], 7),
('cleaning-pack', 'Cleaning pack', 'Soap, bleach and paper', array['washing powder', 'bar soap', 'dish soap', 'bleach', 'toilet paper', 'tissue paper'], 8),
('personal-care', 'Personal care', 'Daily toiletries', array['toothpaste', 'shower gel', 'body lotion', 'deodorant', 'shampoo', 'petroleum jelly'], 9),
('baby-starter', 'Baby starter', 'Diapers, formula and wipes', array['diapers', 'baby milk formula', 'baby wipes', 'petroleum jelly', 'bar soap'], 10),
('back-to-school', 'Back to school', 'Books, pens and lunchbox snacks', array['5 exercise book', 'pens', 'pencils', 'biscuits', 'juice', 'bread brown'], 11),
('tea-time', 'Tea time', 'Tea, milk, sugar and something sweet', array['tea leaves', 'fresh milk', 'sugar 1kg', 'biscuits', 'bread white'], 12),
('office-snacks', 'Office snack run', 'Coffee, crisps and drinks', array['instant coffee', 'tea bags', 'sugar 1kg', 'crisps', 'biscuits', 'bottled water', 'soda'], 13),
('protein-week', 'Protein week', 'Meat, fish and eggs', array['beef', 'chicken whole', 'tilapia', 'eggs', 'sausages', 'beans 1kg'], 14)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, items = excluded.items, sort = excluded.sort;
