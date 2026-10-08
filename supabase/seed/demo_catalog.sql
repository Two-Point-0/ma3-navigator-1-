insert into public.retailers (name, slug) values
  ('Naivas', 'naivas'), ('Quickmart', 'quickmart'), ('Carrefour', 'carrefour'),
  ('Chandarana Foodplus', 'chandarana'), ('Cleanshelf', 'cleanshelf')
on conflict (slug) do nothing;

insert into public.products (sku, name, normalized_name, category, pack_size)
select * from (values
 ('MAIZE-2KG','Maize flour','maize flour','Staples','2 kg'),
 ('RICE-2KG','Rice','rice','Staples','2 kg'),
 ('SUGAR-2KG','Sugar','sugar','Staples','2 kg'),
 ('OIL-1L','Cooking oil','cooking oil','Kitchen','1 litre'),
 ('MILK-500ML','Fresh milk','fresh milk','Dairy','500 ml'),
 ('BREAD-400G','Bread','bread','Kitchen','400 g'),
 ('EGGS-30','Eggs','eggs','Protein','Tray of 30'),
 ('BEANS-1KG','Beans','beans','Protein','1 kg'),
 ('DETERGENT-1KG','Laundry detergent','laundry detergent','Household','1 kg'),
 ('NOTEBOOK-10','Exercise books','exercise books','School','Pack of 10')
) as seed(sku,name,normalized_name,category,pack_size)
where not exists (select 1 from public.products p where p.sku = seed.sku);

insert into public.price_observations (product_id, retailer_id, price_kes, pack_size, source_type, observed_at, verified)
select p.id, r.id, x.price, p.pack_size, 'seeded_demo', now(), false
from (values
 ('MAIZE-2KG','naivas',145),('MAIZE-2KG','quickmart',152),('MAIZE-2KG','carrefour',139),('MAIZE-2KG','chandarana',149),('MAIZE-2KG','cleanshelf',151),
 ('RICE-2KG','naivas',325),('RICE-2KG','quickmart',310),('RICE-2KG','carrefour',319),('RICE-2KG','chandarana',324),('RICE-2KG','cleanshelf',315),
 ('SUGAR-2KG','naivas',298),('SUGAR-2KG','quickmart',309),('SUGAR-2KG','carrefour',300),('SUGAR-2KG','chandarana',324),('SUGAR-2KG','cleanshelf',305),
 ('OIL-1L','naivas',299),('OIL-1L','quickmart',312),('OIL-1L','carrefour',298),('OIL-1L','chandarana',299),('OIL-1L','cleanshelf',304),
 ('MILK-500ML','naivas',42),('MILK-500ML','quickmart',43),('MILK-500ML','carrefour',42),('MILK-500ML','chandarana',45),('MILK-500ML','cleanshelf',44),
 ('BREAD-400G','naivas',55),('BREAD-400G','quickmart',65),('BREAD-400G','carrefour',54),('BREAD-400G','chandarana',63),('BREAD-400G','cleanshelf',58),
 ('EGGS-30','naivas',560),('EGGS-30','quickmart',600),('EGGS-30','carrefour',628),('EGGS-30','chandarana',510),('EGGS-30','cleanshelf',575),
 ('BEANS-1KG','naivas',230),('BEANS-1KG','quickmart',245),('BEANS-1KG','carrefour',220),('BEANS-1KG','chandarana',239),('BEANS-1KG','cleanshelf',225),
 ('DETERGENT-1KG','naivas',220),('DETERGENT-1KG','quickmart',230),('DETERGENT-1KG','carrefour',209),('DETERGENT-1KG','chandarana',225),('DETERGENT-1KG','cleanshelf',215),
 ('NOTEBOOK-10','naivas',420),('NOTEBOOK-10','quickmart',399),('NOTEBOOK-10','carrefour',450),('NOTEBOOK-10','chandarana',430),('NOTEBOOK-10','cleanshelf',410)
) as x(sku,slug,price)
join public.products p on p.sku = x.sku join public.retailers r on r.slug = x.slug
where not exists (select 1 from public.price_observations po where po.product_id = p.id and po.retailer_id = r.id and po.source_type = 'seeded_demo');
