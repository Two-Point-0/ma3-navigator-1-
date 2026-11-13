-- Save each signed-in person's current Market basket so it survives logout,
-- a new phone or cleared browser data. Uses the shopping_baskets and basket_items
-- tables from the initial migration; their row-level security already limits every
-- row to its owner.

alter table public.shopping_baskets add column if not exists selected_branch jsonb;

-- At most one "current" basket per person.
create unique index if not exists shopping_baskets_one_current_per_user
  on public.shopping_baskets (user_id) where basket_type = 'current';

-- Replace the caller's current basket in one transaction.
create or replace function public.save_current_basket(p_items jsonb, p_branch jsonb default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_basket uuid;
begin
  if v_user is null then
    raise exception 'Sign in to save your basket';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Basket items must be a list';
  end if;

  insert into public.shopping_baskets (user_id, name, basket_type, selected_branch, updated_at)
  values (v_user, 'Current basket', 'current', p_branch, now())
  on conflict (user_id) where basket_type = 'current'
  do update set selected_branch = excluded.selected_branch, updated_at = now()
  returning id into v_basket;

  delete from public.basket_items where basket_id = v_basket;

  insert into public.basket_items (basket_id, product_id, quantity)
  select v_basket, line.product_id, least(99, greatest(1, line.quantity))
  from (
    select (item->>'productId')::uuid as product_id, sum((item->>'quantity')::numeric) as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    group by 1
  ) as line
  where exists (select 1 from public.products p where p.id = line.product_id);
end;
$$;

-- Read the caller's current basket, with the product details the app needs.
create or replace function public.get_current_basket()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'branch', b.selected_branch,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', p.id,
        'sku', coalesce(p.sku, p.id::text),
        'name', p.name,
        'unit', coalesce(p.pack_size, ''),
        'category', coalesce(p.category, 'Other'),
        'quantity', floor(bi.quantity)::int
      ) order by bi.created_at)
      from public.basket_items bi
      join public.products p on p.id = bi.product_id
      where bi.basket_id = b.id and bi.quantity >= 1 and p.active
    ), '[]'::jsonb)
  )
  from public.shopping_baskets b
  where b.user_id = auth.uid() and b.basket_type = 'current'
  limit 1;
$$;

revoke all on function public.save_current_basket(jsonb, jsonb) from public, anon;
revoke all on function public.get_current_basket() from public, anon;
grant execute on function public.save_current_basket(jsonb, jsonb) to authenticated;
grant execute on function public.get_current_basket() to authenticated;
