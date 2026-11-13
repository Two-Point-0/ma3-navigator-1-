-- Optional geocoded supermarket branches. Coordinates describe public store locations,
-- never the customer's device location.
create table if not exists public.retailer_branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  branch_slug text not null,
  branch_name text not null,
  region text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, branch_slug),
  check ((latitude is null) = (longitude is null))
);

alter table public.price_observations
  add column if not exists branch_id uuid references public.retailer_branches(id) on delete set null;

create index if not exists retailer_branches_geo_idx
  on public.retailer_branches (latitude, longitude) where active = true;
create index if not exists price_observations_branch_product_date_idx
  on public.price_observations (branch_id, product_id, observed_at desc);

alter table public.retailer_branches enable row level security;
grant select on public.retailer_branches to anon, authenticated;
drop policy if exists "Anyone can read active retailer branches" on public.retailer_branches;
create policy "Anyone can read active retailer branches" on public.retailer_branches
  for select to anon, authenticated using (active = true);

-- Keep browser reads proportional to the active catalogue, not to retained price history.
create or replace view public.latest_market_prices
with (security_invoker = true) as
select distinct on (
  observations.product_id,
  observations.retailer_id,
  coalesce(observations.branch_id::text, lower(coalesce(observations.branch, '') || '|' || coalesce(observations.region, '')))
)
  observations.product_id,
  observations.retailer_id,
  retailers.slug as retailer_slug,
  observations.branch_id,
  observations.branch,
  observations.region,
  branches.branch_slug,
  coalesce(branches.branch_name, observations.branch) as branch_name,
  coalesce(branches.region, observations.region) as branch_region,
  branches.latitude,
  branches.longitude,
  observations.price_kes,
  observations.pack_size,
  observations.source_type,
  observations.observed_at
from public.price_observations as observations
join public.retailers as retailers on retailers.id = observations.retailer_id
left join public.retailer_branches as branches on branches.id = observations.branch_id
where observations.verified = false
  and observations.source_type in ('seeded_demo', 'manual_entry', 'user_submitted')
order by
  observations.product_id,
  observations.retailer_id,
  coalesce(observations.branch_id::text, lower(coalesce(observations.branch, '') || '|' || coalesce(observations.region, ''))),
  observations.observed_at desc,
  observations.id desc;

grant select on public.latest_market_prices to anon, authenticated;
