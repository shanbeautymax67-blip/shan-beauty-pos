-- MIGRATION: Shop A (Royal Lady Cosmetics) stock transfers
-- Run this ONLY if you already ran the original schema.sql against your
-- Supabase project before this feature existed. If you're setting up a
-- brand new project, just run schema.sql — it already includes this.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

alter table products add column if not exists shop_a_stock numeric(10,2) not null default 0;

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity numeric(10,2) not null,
  direction text not null check (direction in ('to_shop_a', 'from_shop_a')),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_transfers_created_at on stock_transfers(created_at);

alter table stock_transfers enable row level security;

drop policy if exists "Authenticated full access to stock_transfers" on stock_transfers;
create policy "Authenticated full access to stock_transfers"
  on stock_transfers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create or replace function send_stock_to_shop_a(p_product_id uuid, p_quantity numeric)
returns void as $$
declare
  v_name text;
  v_stock numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  select name, stock into v_name, v_stock from products where id = p_product_id for update;
  if v_name is null then
    raise exception 'Product not found';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_quantity > v_stock then
    raise exception 'Not enough stock here to send';
  end if;

  update products
  set stock = stock - p_quantity,
      shop_a_stock = shop_a_stock + p_quantity
  where id = p_product_id;

  insert into stock_transfers (product_id, product_name, quantity, direction)
  values (p_product_id, v_name, p_quantity, 'to_shop_a');
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bring_stock_from_shop_a(p_product_id uuid, p_quantity numeric)
returns void as $$
declare
  v_name text;
  v_shop_a_stock numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  select name, shop_a_stock into v_name, v_shop_a_stock from products where id = p_product_id for update;
  if v_name is null then
    raise exception 'Product not found';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_quantity > v_shop_a_stock then
    raise exception 'Not enough stock available at Shop A';
  end if;

  update products
  set stock = stock + p_quantity,
      shop_a_stock = shop_a_stock - p_quantity
  where id = p_product_id;

  insert into stock_transfers (product_id, product_name, quantity, direction)
  values (p_product_id, v_name, p_quantity, 'from_shop_a');
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function send_stock_to_shop_a(uuid, numeric) from public;
revoke all on function bring_stock_from_shop_a(uuid, numeric) from public;
grant execute on function send_stock_to_shop_a(uuid, numeric) to authenticated;
grant execute on function bring_stock_from_shop_a(uuid, numeric) to authenticated;
