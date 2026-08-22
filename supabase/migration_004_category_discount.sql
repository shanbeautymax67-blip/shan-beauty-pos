-- MIGRATION 004 — Product category, sale discount
-- Run this in your EXISTING Supabase project, after migrations 001–003.
-- Safe to run with existing data.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

alter table products add column if not exists category text;
alter table sales add column if not exists discount numeric(10,2) not null default 0;
