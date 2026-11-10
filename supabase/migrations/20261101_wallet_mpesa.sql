-- Server-authoritative wallet ledger. Client code may read its own balance/history,
-- but only the trusted Edge Function can initiate and settle real top-ups.
create table if not exists public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_kes bigint not null default 0 check (balance_kes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_kes integer not null check (amount_kes between 10 and 150000),
  phone_number text not null check (phone_number ~ '^254[17][0-9]{8}$'),
  account_reference text not null unique,
  merchant_request_id text unique,
  checkout_request_id text unique,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','expired')),
  result_code text,
  result_description text,
  mpesa_receipt text unique,
  requested_at timestamptz not null default now(),
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists wallet_topups_owner_recent_idx on public.wallet_topups(user_id, requested_at desc);
create index if not exists wallet_topups_pending_idx on public.wallet_topups(checkout_request_id) where status = 'pending';

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_kes bigint not null check (amount_kes <> 0),
  kind text not null check (kind in ('topup','payment','earning','refund','adjustment')),
  label text not null,
  provider text,
  provider_ref text,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index if not exists wallet_transactions_owner_recent_idx on public.wallet_transactions(user_id, created_at desc);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.wallet_transactions enable row level security;
grant select on public.wallet_accounts, public.wallet_topups, public.wallet_transactions to authenticated;
drop policy if exists "Users read own wallet account" on public.wallet_accounts;
create policy "Users read own wallet account" on public.wallet_accounts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own wallet topups" on public.wallet_topups;
create policy "Users read own wallet topups" on public.wallet_topups for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);

-- Called only after the Edge Function verifies both the Daraja callback and
-- an STK Query response. Row lock + unique provider reference prevent re-credit.
create or replace function public.settle_mpesa_wallet_topup(
  p_checkout_request_id text,
  p_amount_kes integer,
  p_phone_number text,
  p_mpesa_receipt text,
  p_result_code text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare t public.wallet_topups%rowtype;
begin
  select * into t from public.wallet_topups
    where checkout_request_id = p_checkout_request_id for update;
  if not found then raise exception 'Unknown M-Pesa checkout request'; end if;
  if t.status = 'succeeded' then return false; end if;
  if t.status <> 'pending' then raise exception 'Top-up is not pending'; end if;
  if p_result_code <> '0' or p_amount_kes <> t.amount_kes or p_phone_number <> t.phone_number or coalesce(trim(p_mpesa_receipt), '') = '' then
    raise exception 'Payment details did not match the pending top-up';
  end if;

  update public.wallet_topups set status = 'succeeded', result_code = p_result_code,
    mpesa_receipt = p_mpesa_receipt, settled_at = now(), updated_at = now()
    where id = t.id;
  insert into public.wallet_accounts(user_id, balance_kes, updated_at)
    values (t.user_id, t.amount_kes, now())
    on conflict (user_id) do update set balance_kes = public.wallet_accounts.balance_kes + excluded.balance_kes, updated_at = now();
  insert into public.wallet_transactions(user_id, amount_kes, kind, label, provider, provider_ref)
    values (t.user_id, t.amount_kes, 'topup', 'M-Pesa wallet top-up', 'mpesa', p_mpesa_receipt);
  return true;
end;
$$;
revoke all on function public.settle_mpesa_wallet_topup(text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.settle_mpesa_wallet_topup(text, integer, text, text, text) to service_role;

comment on table public.wallet_accounts is 'Real wallet balances; only trusted server-side settlement functions may change them.';
comment on table public.wallet_topups is 'M-Pesa STK requests and server-verified settlement state; never mark successful from browser input.';
