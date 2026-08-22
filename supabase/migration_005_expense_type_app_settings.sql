-- MIGRATION 005 — Expense type (daily vs monthly), app settings / PIN store
-- Run this in your EXISTING Supabase project, after migrations 001–004.
-- Safe to run with existing data — existing expenses default to 'daily'.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

alter table expenses add column if not exists expense_type text not null default 'daily';
alter table expenses drop constraint if exists expenses_expense_type_check;
alter table expenses add constraint expenses_expense_type_check
  check (expense_type in ('daily', 'monthly'));

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Authenticated full access to app_settings" on app_settings;
create policy "Authenticated full access to app_settings"
  on app_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
