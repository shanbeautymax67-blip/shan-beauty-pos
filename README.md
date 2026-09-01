# SHAN BEAUTY MAX — Point of Sale

A simple, single-owner web POS: ring up sales, track stock, see how the day went. Runs entirely in the browser, with data stored in a free Supabase (Postgres) database, and hosted on Vercel so you get a shareable link like `https://shan-beauty-max.vercel.app`.

## What's included

- **Make Sale** — tap products to build a cart, pick cash / M-Pesa / card, complete the sale. Stock decreases automatically.
- **Products** — add, edit, delete products; set price and stock.
- **Sales History** — every past sale, filterable by date, with line items.
- **Dashboard** (opens first) — today's revenue and net profit (after that day's daily-type expenses), cash/M-Pesa breakdown, top sellers, low stock, plus a monthly summary with gross profit, expenses (daily + monthly types), and net profit.
- **Products** — category (with autocomplete from past categories), buying price + selling price with margin shown automatically, search by name or category, a quick "+ Stock" action, and Excel export/import — plus a PIN-protected "Danger Zone" to clear the product list or reset all test data before going live.
- **Make Sale** — cash, M-Pesa, or split payment with automatic change calculation, and a per-sale discount field. Success/error messages auto-dismiss after a few seconds.
- **Sales History** — every past sale, filterable by date, with line items.
- **Cross-Shop** — a log of everything sent to or brought in from Royal Lady Cosmetics (Shop A), filterable by date.
- **Expenses** — record business expenses against any date (defaults to today), each tagged as **Daily** (deducted only from that specific day's profit) or **Monthly** (deducted only from that month's profit, never from a single day). Browse and edit by month.
- **Reports** — performance for a single day (default), a custom range, or a full month, always showing both Gross Profit and Net Profit (after the applicable expenses for that period).
- **Financials** — a single day's till breakdown (default: today) for closing up — revenue, cost of goods, gross profit, that day's daily-type expenses, net profit, cash/M-Pesa totals, and a "Cash Left" tracker that carries a change float from one day to the next.
- **Shop A transfers** — send stock to Royal Lady Cosmetics without it counting as a sale here. Bringing stock back in isn't capped by what was sent — Shop A has its own independent stock, so any quantity can be brought in, and once in, it sells normally and counts toward this shop's sales/profit.
- **Login** — single owner account via Supabase Auth. No public sign-up; only you can get in.

---

## Step 1 — Create your database (Supabase)

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**.
   - Name it e.g. `shan-beauty-max`, set a database password (save it somewhere), pick a region close to Kenya (e.g. `eu-west` or `af-south` if offered).
2. Once the project is ready, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/schema.sql` from this project, copy all of it, paste into the SQL editor, and click **Run**.
   This creates the `products`, `sales`, and `sale_items` tables and locks them down so only a logged-in user can read/write.
   - **Already ran schema.sql before?** Also run, in order: `supabase/migration_001_shop_a_transfers.sql`, `supabase/migration_002_profit_expenses_split_payment.sql`, `supabase/migration_003_cash_left_uncapped_shopA.sql`, `supabase/migration_004_category_discount.sql`, `supabase/migration_005_expense_type_app_settings.sql`, `supabase/migration_006_reorder_level.sql`, `supabase/migration_007_login_username.sql` (edit the two placeholder values inside it first), then `supabase/migration_008_deposit_sales.sql`. Each one only adds to your existing database — your current products and sales are untouched.
4. Create your login: go to **Authentication → Users → Add user**. Enter your email and a password. This is what you'll use to sign in to the POS. (Turn off "Auto confirm user" only if you want an email confirmation step — for a single-owner app, leave auto-confirm on so you can log in immediately.)
5. Get your API keys: go to **Project Settings → API**. Copy:
   - **Project URL**
   - **anon public** key

---

## Step 2 — Run it locally to test (optional but recommended)

1. Copy `.env.example` to `.env` and fill in the two values from Step 1:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
2. Install and run:
   ```
   npm install
   npm run dev
   ```
3. Open the local link it gives you, log in with the user you created, add a product or two, and try Make Sale.

---

## Step 3 — Push to GitHub

1. Create a new repository on [github.com](https://github.com) (e.g. `shan-beauty-pos`), keep it **private**.
2. In this project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit — SHAN BEAUTY MAX POS"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/shan-beauty-pos.git
   git push -u origin main
   ```
   `.env` is already excluded via `.gitignore` — your keys won't be pushed.

---

## Step 4 — Deploy to Vercel (this gets you the link)

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New Project** → pick your `shan-beauty-pos` repo.
2. Vercel auto-detects Vite. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
3. Click **Deploy**. In about a minute you'll get a live link, e.g. `https://shan-beauty-pos.vercel.app` — bookmark it on your phone and laptop.
4. Every time you `git push` again, Vercel redeploys automatically.

---

## Notes on data & security

- All data lives in your Supabase Postgres database — not in the browser — so it's safe even if your laptop or phone is lost, and accessible from any device via the link.
- Row Level Security is enabled: without logging in, nobody can read or write your products or sales, even if they find the link.
- The `anon` key is safe to expose in frontend code by design — it only allows what your Row Level Security policies permit (i.e. nothing, unless logged in).
- To add a second staff login later, just add another user in Supabase Authentication — no code changes needed.

## Extending later

Ideas for when you outgrow "simple": expense tracking, receipt printing/PDF export, barcode scanning, customer accounts, multi-shop support. All can be layered onto this same schema without a rewrite.
