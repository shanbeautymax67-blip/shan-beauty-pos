-- SHAN BEAUTY MAX — POS database schema
-- Run this in Supabase: Dashboard > SQL Editor > New query > paste all > Run

-- ============ PRODUCTS ============
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  price numeric(10,2) not null default 0,        -- selling price
  buying_price numeric(10,2) not null default 0, -- cost price, used to calculate profit
  stock numeric(10,2) not null default 0,
  reorder_level numeric(10,2) not null default 5,  -- low-stock alert threshold, per product
  shop_a_stock numeric(10,2) not null default 0, -- quantity currently sitting at Shop A (Royal Lady Cosmetics)
  created_at timestamptz not null default now()
);

-- ============ SALES ============
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  total numeric(10,2) not null default 0,       -- final total after discount
  discount numeric(10,2) not null default 0,
  payment_method text not null default 'cash', -- cash | mpesa | split
  cash_amount numeric(10,2) not null default 0,   -- portion paid in cash
  mpesa_amount numeric(10,2) not null default 0,  -- portion paid via M-Pesa
  amount_paid numeric(10,2) not null default 0,   -- total tendered by customer
  change_given numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ SALE ITEMS ============
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, -- snapshot, survives product deletion
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,   -- selling price at time of sale
  unit_cost numeric(10,2) not null default 0, -- buying price at time of sale, for accurate profit history
  line_total numeric(10,2) not null
);

create index if not exists idx_sale_items_sale_id on sale_items(sale_id);
create index if not exists idx_sales_created_at on sales(created_at);

-- ============ STOCK TRANSFERS (SHOP A / ROYAL LADY COSMETICS) ============
-- Records stock moved out to Shop A, or brought back in from Shop A.
-- Transfers never touch the sales/sale_items tables, so they never count
-- as revenue or profit here. A product only counts toward this shop's
-- sales/profit once it's actually sold through Make Sale.
create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  product_name text not null, -- snapshot
  quantity numeric(10,2) not null,
  direction text not null check (direction in ('to_shop_a', 'from_shop_a')),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_transfers_created_at on stock_transfers(created_at);

-- ============ EXPENSES ============
-- General business expenses, attributed to a specific date (and therefore
-- a specific month). Deducted from monthly profit only — never from a
-- single day's profit figure. You can add/edit/delete an expense for any
-- past month and it will recalculate that month's figures.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null default 0,
  expense_date date not null default current_date,
  -- 'daily': deducted only from that specific day's profit (and therefore
  -- also counted within its month's total). 'monthly': deducted only at
  -- the month level, never from a single day's profit. For 'monthly'
  -- expenses, only the month/year of expense_date is used — the day of
  -- month is irrelevant.
  expense_type text not null default 'daily' check (expense_type in ('daily', 'monthly')),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_expense_date on expenses(expense_date);

-- ============ DAILY CASH LEFT ============
-- End-of-day cash set aside as change float for the next day. One row per
-- calendar date. Read on the Financials page to carry yesterday's float
-- into today's cash breakdown.
create table if not exists daily_cash_left (
  cash_date date primary key,
  cash_left numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ============ APP SETTINGS ============
-- Small key/value store. Currently used to hold a hashed PIN that protects
-- destructive actions (clearing product list, clearing all test data).
-- The PIN itself is never stored in plain text — only its SHA-256 hash.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
-- Only a logged-in user (you, the owner) can read/write. No public access.
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_transfers enable row level security;
alter table expenses enable row level security;

create policy "Authenticated full access to products"
  on products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access to sales"
  on sales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access to sale_items"
  on sale_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access to stock_transfers"
  on stock_transfers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access to expenses"
  on expenses for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table daily_cash_left enable row level security;

create policy "Authenticated full access to daily_cash_left"
  on daily_cash_left for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table app_settings enable row level security;

create policy "Authenticated full access to app_settings"
  on app_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============ TRANSFER FUNCTIONS ============
-- Wrapped in functions so the stock move + transfer log entry happen
-- atomically and stock can never go negative or exceed what's available.

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

  -- Not capped by shop_a_stock: Shop A (Royal Lady Cosmetics) has its own
  -- independent stock beyond whatever was previously sent there, so any
  -- quantity can be brought in. shop_a_stock is only kept as a running
  -- ledger for the Cross-Shop log, and may go negative if more is brought
  -- in than was ever sent.
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
