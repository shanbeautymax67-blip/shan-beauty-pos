-- MIGRATION 007 — Username login (maps a username to the real Supabase
-- Auth email behind the scenes, so the login screen can ask for a
-- username instead of an email address).
-- Run this in your EXISTING Supabase project, after migrations 001–006.
--
-- Supabase Dashboard > SQL Editor > New query > paste all > Run
--
-- IMPORTANT: replace the two placeholder values below before running:
--   'yourname'              -> the username you want to log in with
--   'you@shanbeautymax.co.ke' -> the REAL email your Supabase Auth user
--                                already uses to sign in today

create table if not exists login_usernames (
  user_email text primary key,
  username text not null unique,
  updated_at timestamptz not null default now()
);

alter table login_usernames enable row level security;

-- Anyone can look up which email a username maps to — this has to be
-- readable BEFORE login (the login screen isn't authenticated yet).
-- Only the username/email pair is exposed, never the password.
drop policy if exists "Anyone can look up a username" on login_usernames;
create policy "Anyone can look up a username"
  on login_usernames for select
  using (true);

-- Only a logged-in user can change a username mapping (e.g. from
-- Settings), and only once they're authenticated.
drop policy if exists "Authenticated can manage login_usernames" on login_usernames;
create policy "Authenticated can manage login_usernames"
  on login_usernames for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Seed your one username -> email mapping. Edit the two values below
-- to match your real login email, then run this file.
insert into login_usernames (user_email, username)
values ('you@shanbeautymax.co.ke', 'yourname')
on conflict (user_email) do update set username = excluded.username;
