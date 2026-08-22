-- MIGRATION 006 — Per-product reorder level (Low Stock threshold)
-- Run this in your EXISTING Supabase project, after migrations 001–005.
-- Safe to run with existing data — existing products default to a reorder level of 5.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run

alter table products add column if not exists reorder_level numeric(10,2) not null default 5;
