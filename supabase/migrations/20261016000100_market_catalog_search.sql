-- Keep substring searches responsive when product catalogs grow beyond a few
-- hundred rows. Product reads remain limited and are filtered by the browser query.
create extension if not exists pg_trgm with schema extensions;

create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_sku_trgm_idx
  on public.products using gin (sku extensions.gin_trgm_ops);
create index if not exists products_brand_trgm_idx
  on public.products using gin (brand extensions.gin_trgm_ops);
create index if not exists products_category_trgm_idx
  on public.products using gin (category extensions.gin_trgm_ops);
