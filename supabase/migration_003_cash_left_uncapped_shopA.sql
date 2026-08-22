-- MIGRATION 003 — Daily cash left, and uncapped "bring from Shop A"
-- Run this in your EXISTING Supabase project, after migration_001 and
-- migration_002. Safe to run with existing data.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

create table if not exists daily_cash_left (
  cash_date date primary key,
  cash_left numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table daily_cash_left enable row level security;

drop policy if exists "Authenticated full access to daily_cash_left" on daily_cash_left;
create policy "Authenticated full access to daily_cash_left"
  on daily_cash_left for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Replace bring_stock_from_shop_a: no longer capped by shop_a_stock.
-- Shop A (Royal Lady Cosmetics) has its own independent inventory, so any
-- quantity can be brought in regardless of what was previously sent there.
create or replace function bring_stock_from_shop_a(p_product_id uuid, p_quantity numeric)
returns void as $$
declare
  v_name text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  select name into v_name from products where id = p_product_id for update;
  if v_name is null then
    raise exception 'Product not found';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  update products
  set stock = stock + p_quantity,
      shop_a_stock = shop_a_stock - p_quantity
  where id = p_product_id;

  insert into stock_transfers (product_id, product_name, quantity, direction)
  values (p_product_id, v_name, p_quantity, 'from_shop_a');
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function bring_stock_from_shop_a(uuid, numeric) from public;
grant execute on function bring_stock_from_shop_a(uuid, numeric) to authenticated;
