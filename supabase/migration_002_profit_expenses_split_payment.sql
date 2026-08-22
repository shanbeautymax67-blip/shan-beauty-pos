-- MIGRATION 002 — Buying price / profit, split payments, expenses, remove SKU
-- Run this in your EXISTING Supabase project (the one you already set up
-- with schema.sql). Safe to run even with existing products/sales data —
-- it only adds new columns/tables and sets sensible defaults.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

-- Products: drop SKU, add buying price
alter table products drop column if exists sku;
alter table products add column if not exists buying_price numeric(10,2) not null default 0;

-- Sales: richer payment tracking (cash / mpesa / split, amount tendered, change)
alter table sales add column if not exists cash_amount numeric(10,2) not null default 0;
alter table sales add column if not exists mpesa_amount numeric(10,2) not null default 0;
alter table sales add column if not exists amount_paid numeric(10,2) not null default 0;
alter table sales add column if not exists change_given numeric(10,2) not null default 0;

-- Backfill existing sales so old records still make sense under the new fields
update sales set amount_paid = total where amount_paid = 0;
update sales set cash_amount = total where payment_method = 'cash' and cash_amount = 0;
update sales set mpesa_amount = total where payment_method = 'mpesa' and mpesa_amount = 0;
-- Any old 'card' sales become 'cash' going forward, since card is no longer an option
update sales set payment_method = 'cash', cash_amount = total where payment_method = 'card';

-- Sale items: track cost price at time of sale for accurate profit history
alter table sale_items add column if not exists unit_cost numeric(10,2) not null default 0;

-- Expenses table
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null default 0,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_expense_date on expenses(expense_date);

alter table expenses enable row level security;

drop policy if exists "Authenticated full access to expenses" on expenses;
create policy "Authenticated full access to expenses"
  on expenses for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
