-- Named shopping lists that you can share with friends who also use the app.
-- Share with a 6-character code. Everyone who joins can see and edit the list; only the owner can delete it.
create table if not exists public.shared_baskets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  join_code text not null unique,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shared_basket_members (
  basket_id uuid not null references public.shared_baskets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (basket_id, user_id)
);
create index if not exists shared_basket_members_user_idx on public.shared_basket_members(user_id);
alter table public.shared_baskets enable row level security;
alter table public.shared_basket_members enable row level security;
revoke all on public.shared_baskets, public.shared_basket_members from anon, authenticated;
grant select on public.shared_baskets, public.shared_basket_members to authenticated;

create or replace function public.can_see_basket(p_basket uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shared_baskets b where b.id = p_basket and b.owner_id = auth.uid())
      or exists (select 1 from shared_basket_members m where m.basket_id = p_basket and m.user_id = auth.uid());
$$;
grant execute on function public.can_see_basket(uuid) to authenticated;
drop policy if exists shared_baskets_read on public.shared_baskets;
create policy shared_baskets_read on public.shared_baskets for select to authenticated using (public.can_see_basket(id));
drop policy if exists shared_basket_members_read on public.shared_basket_members;
create policy shared_basket_members_read on public.shared_basket_members for select to authenticated using (user_id = auth.uid() or public.can_see_basket(basket_id));

create or replace function public.basket_new_code() returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v text; i integer;
begin
  loop
    v := ''; for i in 1..6 loop v := v || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from shared_baskets where join_code = v);
  end loop;
  return v;
end $$;

create or replace function public.create_shared_basket(p_name text, p_items jsonb default '[]'::jsonb) returns table (basket_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare v uuid; c text;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in to save and share lists'; end if;
  if (select count(*) from shared_baskets where owner_id = auth.uid()) >= 30 then raise exception 'You have 30 lists already. Delete one first.'; end if;
  c := basket_new_code();
  insert into shared_baskets (owner_id, name, join_code, items) values (auth.uid(), left(trim(p_name), 40), c, coalesce(p_items, '[]'::jsonb)) returning id into v;
  return query select v, c;
end $$;
grant execute on function public.create_shared_basket(text, jsonb) to authenticated;

create or replace function public.join_shared_basket(p_code text) returns uuid language plpgsql security definer set search_path = public as $$
declare b shared_baskets;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in to join a list'; end if;
  select * into b from shared_baskets where join_code = upper(trim(p_code));
  if not found then raise exception 'No list has that code. Check it and try again.'; end if;
  if b.owner_id <> auth.uid() then insert into shared_basket_members (basket_id, user_id) values (b.id, auth.uid()) on conflict do nothing; end if;
  return b.id;
end $$;
grant execute on function public.join_shared_basket(text) to authenticated;

create or replace function public.update_shared_basket(p_id uuid, p_items jsonb, p_name text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_basket(p_id) then raise exception 'You are not part of this list'; end if;
  update shared_baskets set items = coalesce(p_items, items), name = coalesce(nullif(left(trim(p_name), 40), ''), name), updated_at = now() where id = p_id;
end $$;
grant execute on function public.update_shared_basket(uuid, jsonb, text) to authenticated;

create or replace function public.leave_or_delete_shared_basket(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from shared_baskets where id = p_id and owner_id = auth.uid()) then delete from shared_baskets where id = p_id;
  else delete from shared_basket_members where basket_id = p_id and user_id = auth.uid(); end if;
end $$;
grant execute on function public.leave_or_delete_shared_basket(uuid) to authenticated;

create or replace function public.my_shared_baskets() returns table (id uuid, name text, join_code text, items jsonb, is_owner boolean, member_count integer, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, case when b.owner_id = auth.uid() then b.join_code else null end, b.items, b.owner_id = auth.uid(),
         (select count(*)::int from shared_basket_members m where m.basket_id = b.id) + 1, b.updated_at
  from shared_baskets b where can_see_basket(b.id) order by b.updated_at desc;
$$;
grant execute on function public.my_shared_baskets() to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.shared_baskets; exception when duplicate_object then null; end;
  end if;
end $$;
