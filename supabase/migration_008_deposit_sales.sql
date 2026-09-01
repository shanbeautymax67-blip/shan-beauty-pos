-- MIGRATION 008 — Deposit Sales
-- Lets a cashier take a deposit on one or more products for a customer who
-- can't pay the full amount yet. The product(s) are reserved (deducted from
-- stock) right away so they can't be sold to someone else, but the sale does
-- NOT count toward revenue/profit until the customer comes back and pays
-- the rest and the sale is completed.
--
-- Run this in your EXISTING Supabase project, after migrations 001–007.
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

-- ============ DEPOSIT SALES ============
create table if not exists deposit_sales (
  id uuid primary key default gen_random_uuid(),
  customer_name text,   -- optional
  customer_phone text,  -- optional
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,        -- full price owed for the reserved item(s)
  amount_paid numeric(10,2) not null default 0,  -- cumulative amount paid so far (deposit + any top-ups)
  cash_paid numeric(10,2) not null default 0,
  mpesa_paid numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  sale_id uuid references sales(id) on delete set null, -- set once completed — points at the real sale
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_deposit_sales_status on deposit_sales(status);
create index if not exists idx_deposit_sales_created_at on deposit_sales(created_at);

-- ============ DEPOSIT SALE ITEMS ============
-- Snapshot of price/cost at the time the deposit was taken, same idea as
-- sale_items, so profit is calculated correctly whenever the sale finishes.
create table if not exists deposit_sale_items (
  id uuid primary key default gen_random_uuid(),
  deposit_sale_id uuid not null references deposit_sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2) not null default 0,
  line_total numeric(10,2) not null
);

create index if not exists idx_deposit_sale_items_deposit_sale_id on deposit_sale_items(deposit_sale_id);

-- ============ DEPOSIT SALE PAYMENTS ============
-- A running log of every payment made toward a deposit sale: the initial
-- deposit, any later top-ups, and a negative "refund" entry if it's
-- cancelled. Kept for the record even after the sale completes or cancels.
create table if not exists deposit_sale_payments (
  id uuid primary key default gen_random_uuid(),
  deposit_sale_id uuid not null references deposit_sales(id) on delete cascade,
  amount numeric(10,2) not null,       -- cash_amount + mpesa_amount (negative for a refund)
  cash_amount numeric(10,2) not null default 0,
  mpesa_amount numeric(10,2) not null default 0,
  kind text not null default 'payment' check (kind in ('deposit', 'payment', 'refund')),
  created_at timestamptz not null default now()
);

create index if not exists idx_deposit_sale_payments_deposit_sale_id on deposit_sale_payments(deposit_sale_id);

-- ============ ROW LEVEL SECURITY ============
alter table deposit_sales enable row level security;
alter table deposit_sale_items enable row level security;
alter table deposit_sale_payments enable row level security;

drop policy if exists "Authenticated full access to deposit_sales" on deposit_sales;
create policy "Authenticated full access to deposit_sales"
  on deposit_sales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated full access to deposit_sale_items" on deposit_sale_items;
create policy "Authenticated full access to deposit_sale_items"
  on deposit_sale_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated full access to deposit_sale_payments" on deposit_sale_payments;
create policy "Authenticated full access to deposit_sale_payments"
  on deposit_sale_payments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============ FUNCTIONS ============
-- All wrapped in functions so stock changes, payment logging, and (when it
-- applies) turning a deposit sale into a real sale all happen atomically.

-- Internal helper: if a pending deposit sale has now been paid in full,
-- turn it into a real sale (this is the moment revenue/profit count) and
-- mark it completed. Called automatically after every payment. Does
-- nothing if it's not fully paid yet, or isn't pending.
create or replace function finalize_deposit_sale_if_paid(p_deposit_sale_id uuid)
returns void as $$
declare
  v_row deposit_sales%rowtype;
  v_sale_id uuid;
  v_change numeric;
  v_change_from_cash numeric;
  v_change_from_mpesa numeric;
  v_payment_method text;
begin
  select * into v_row from deposit_sales where id = p_deposit_sale_id for update;
  if v_row.id is null or v_row.status <> 'pending' then
    return;
  end if;
  if v_row.amount_paid < v_row.total then
    return;
  end if;

  v_change := v_row.amount_paid - v_row.total;
  v_change_from_cash := least(v_change, v_row.cash_paid);
  v_change_from_mpesa := v_change - v_change_from_cash;

  v_payment_method := case
    when v_row.cash_paid > 0 and v_row.mpesa_paid > 0 then 'split'
    when v_row.mpesa_paid > 0 then 'mpesa'
    else 'cash'
  end;

  insert into sales (total, discount, payment_method, cash_amount, mpesa_amount, amount_paid, change_given)
  values (
    v_row.total,
    v_row.discount,
    v_payment_method,
    v_row.cash_paid - v_change_from_cash,
    v_row.mpesa_paid - v_change_from_mpesa,
    v_row.amount_paid,
    v_change
  )
  returning id into v_sale_id;

  insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
  select v_sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total
  from deposit_sale_items
  where deposit_sale_id = p_deposit_sale_id;

  update deposit_sales
  set status = 'completed', sale_id = v_sale_id, completed_at = now()
  where id = p_deposit_sale_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Take a deposit on one or more products for a (optional) named customer.
-- p_items is a jsonb array like: [{"product_id": "...", "quantity": 2}, ...]
-- Price/cost are read from the products table itself (never trusted from
-- the client) and stock is deducted immediately. If the "deposit" happens
-- to cover the full price, the sale is completed right away.
create or replace function create_deposit_sale(
  p_customer_name text,
  p_customer_phone text,
  p_discount numeric,
  p_cash_amount numeric,
  p_mpesa_amount numeric,
  p_items jsonb
)
returns uuid as $$
declare
  v_deposit_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_name text;
  v_price numeric;
  v_cost numeric;
  v_stock numeric;
  v_subtotal numeric := 0;
  v_discount numeric := coalesce(p_discount, 0);
  v_total numeric;
  v_cash numeric := coalesce(p_cash_amount, 0);
  v_mpesa numeric := coalesce(p_mpesa_amount, 0);
  v_deposit_amount numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items given';
  end if;

  v_deposit_amount := v_cash + v_mpesa;
  if v_deposit_amount <= 0 then
    raise exception 'Deposit amount must be greater than zero';
  end if;

  insert into deposit_sales (customer_name, customer_phone, status)
  values (nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''), 'pending')
  returning id into v_deposit_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for an item';
    end if;

    select name, price, buying_price, stock into v_name, v_price, v_cost, v_stock
    from products where id = v_product_id for update;

    if v_name is null then
      raise exception 'Product not found';
    end if;
    if v_qty > v_stock then
      raise exception 'Not enough stock for "%"', v_name;
    end if;

    update products set stock = stock - v_qty where id = v_product_id;

    insert into deposit_sale_items
      (deposit_sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
    values
      (v_deposit_id, v_product_id, v_name, v_qty, v_price, coalesce(v_cost, 0), v_price * v_qty);

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  v_discount := least(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount;

  if v_deposit_amount > v_total then
    raise exception 'Deposit cannot be more than the total price';
  end if;

  update deposit_sales
  set subtotal = v_subtotal,
      discount = v_discount,
      total = v_total,
      amount_paid = v_deposit_amount,
      cash_paid = v_cash,
      mpesa_paid = v_mpesa
  where id = v_deposit_id;

  insert into deposit_sale_payments (deposit_sale_id, amount, cash_amount, mpesa_amount, kind)
  values (v_deposit_id, v_deposit_amount, v_cash, v_mpesa, 'deposit');

  perform finalize_deposit_sale_if_paid(v_deposit_id);

  return v_deposit_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Collect a further payment toward a pending deposit sale. If it brings
-- the total paid up to (or past) the full price, the sale is completed
-- automatically as part of this call.
create or replace function collect_deposit_sale_payment(
  p_deposit_sale_id uuid,
  p_cash_amount numeric,
  p_mpesa_amount numeric
)
returns void as $$
declare
  v_cash numeric := coalesce(p_cash_amount, 0);
  v_mpesa numeric := coalesce(p_mpesa_amount, 0);
  v_amount numeric;
  v_status text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  v_amount := v_cash + v_mpesa;
  if v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select status into v_status from deposit_sales where id = p_deposit_sale_id for update;
  if v_status is null then
    raise exception 'Deposit sale not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'This deposit sale is no longer pending';
  end if;

  update deposit_sales
  set amount_paid = amount_paid + v_amount,
      cash_paid = cash_paid + v_cash,
      mpesa_paid = mpesa_paid + v_mpesa
  where id = p_deposit_sale_id;

  insert into deposit_sale_payments (deposit_sale_id, amount, cash_amount, mpesa_amount, kind)
  values (p_deposit_sale_id, v_amount, v_cash, v_mpesa, 'payment');

  perform finalize_deposit_sale_if_paid(p_deposit_sale_id);
end;
$$ language plpgsql security definer set search_path = public;

-- Cancel a still-pending deposit sale: returns every reserved item back to
-- stock and logs a refund entry for whatever the customer had paid so far.
-- Only pending deposit sales can be cancelled this way — a completed one is
-- a normal sale by that point and is managed from Sales History instead.
create or replace function cancel_deposit_sale(p_deposit_sale_id uuid)
returns void as $$
declare
  v_status text;
  v_amount_paid numeric;
  v_item record;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  select status, amount_paid into v_status, v_amount_paid
  from deposit_sales where id = p_deposit_sale_id for update;

  if v_status is null then
    raise exception 'Deposit sale not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Only a pending deposit sale can be cancelled';
  end if;

  for v_item in
    select product_id, quantity from deposit_sale_items where deposit_sale_id = p_deposit_sale_id
  loop
    if v_item.product_id is not null then
      update products set stock = stock + v_item.quantity where id = v_item.product_id;
    end if;
  end loop;

  if v_amount_paid > 0 then
    insert into deposit_sale_payments (deposit_sale_id, amount, cash_amount, mpesa_amount, kind)
    values (p_deposit_sale_id, -v_amount_paid, 0, 0, 'refund');
  end if;

  update deposit_sales
  set status = 'cancelled', cancelled_at = now()
  where id = p_deposit_sale_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function finalize_deposit_sale_if_paid(uuid) from public;
revoke all on function create_deposit_sale(text, text, numeric, numeric, numeric, jsonb) from public;
revoke all on function collect_deposit_sale_payment(uuid, numeric, numeric) from public;
revoke all on function cancel_deposit_sale(uuid) from public;

grant execute on function create_deposit_sale(text, text, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function collect_deposit_sale_payment(uuid, numeric, numeric) to authenticated;
grant execute on function cancel_deposit_sale(uuid) to authenticated;
