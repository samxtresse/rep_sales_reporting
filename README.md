# Xtressé Rep Tracker — standalone Vercel app

Internal-only sales tracker for Xtressé reps. **Completely separate** from the
leadership dashboard. Reps go to one URL, type their last name as the
password, see only their own data.

## What reps see

- **Login** — single password input. Type your last name (lowercase). The
  app figures out who you are.
- **Dashboard** — your name and territory at the top. Below that:
  - Year selector + month pills (click to toggle, Jan 2025 onward as data exists)
  - 5 KPI tiles: Total net sales, First-time biz %, Total accounts, AOV, Estimated commission
  - Sales by product table (Gummies / XVIE / Serum / Sachets) with FT/Returning split per month
  - New accounts by product
  - Commission tier card with live formula breakdown
  - Projected sales input → projected commission output
  - **Account history** — every account in your territory with last-order date, lifetime $, current-quarter loyalty tier (sortable, searchable)
  - **Recent orders** — last 50 B2B orders with date, account, product mix, total
- **Sign out** button in the top right

A rep cannot see any other rep's data, the leadership dashboard, or anything
about Xtressé's internal financials. The only data that hits their browser is
filtered to their tagged orders by the server before rendering.

## Architecture

| Route | Auth | Notes |
|---|---|---|
| `/` | public | Login form. Auto-redirects to `/dashboard` if signed in. |
| `/api/login` | public | POST `{ password }`. Matches against all reps. Sets `rep_session` cookie with the matching slug. |
| `/api/logout` | public | POST. Clears the cookie. |
| `/dashboard` | gated | Reads cookie → resolves rep → fetches data → renders. |

No middleware. All auth happens at the page level via `cookies()` from
`next/headers`. There's no edge function for Vercel to bundle, so the
`next/server` error you saw on the leadership dash can't recur here.

Data pulls live from Windsor.ai → Shopify on each request, cached for 4
hours via `unstable_cache`.

## Passwords (auto-derived from last name)

| Rep | Password |
|---|---|
| Jamie Bergeron | bergeron |
| Michelle Spencer | spencer |
| Dia Lamport | lamport |
| Cheryl Greiber | greiber |
| Denisse Schimelpfening | schimelpfening |
| Laura Mann | mann |
| Sherry Quinn | quinn |
| Tyler De Masi | demasi |
| Michelle Boehle | boehle |
| Sonia Mace | mace |
| Taylor Bates | bates |
| Heidi Fisher | fisher |
| Amy Pierre | pierre |
| Gina Napoli | napoli |
| Megan Gilbert | gilbert |
| Bridget Selberg | selberg |
| Carrie Dodge | dodge |
| Morgan Hood | hood |
| James Tuckett | tuckett |

Comparison is case-insensitive. To override any rep, set `REP_PASS_<SLUG>` in
Vercel env vars (e.g. `REP_PASS_AMY_PIERRE=somethingelse`).

## Deploy

This is a **brand-new Vercel project**, not an addition to an existing one.

### Option A — GitHub + Vercel dashboard (recommended)

1. **Create a new GitHub repo** (e.g. `xtresse-rep-tracker`).
2. **Upload all the files** from this folder (drag-and-drop the contents
   into the GitHub repo's "Add file → Upload files" — or push from your
   machine if you have git installed).
3. **Go to https://vercel.com/new** → click **Import** next to the new repo.
4. **Add the two env vars** when prompted (or in Settings → Environment
   Variables after the first deploy):
   - `WINDSOR_API_KEY` — your Windsor.ai API key
   - `WINDSOR_ACCOUNT` — your Shopify connector slug (e.g. `ace1d0-26.myshopify.com`)
   Mark each one for **Production, Preview, AND Development**.
5. Click **Deploy**. Vercel builds and gives you a URL like
   `xtresse-rep-tracker.vercel.app` in ~60 seconds.

### Option B — Vercel CLI (if you already have Node installed)

```bash
# In the unzipped folder:
npm install
npx vercel
# Walk through the prompts (accept defaults). After the first deploy,
# go to Project Settings → Environment Variables and add WINDSOR_API_KEY
# and WINDSOR_ACCOUNT, then redeploy:
npx vercel --prod
```

### Custom domain (optional)

Vercel project Settings → Domains → add (e.g.) `tracker.xtresse.com`. Free.
Send that link to your reps.

## Env vars

Two required:

| Var | Value | Notes |
|---|---|---|
| `WINDSOR_API_KEY` | from Windsor.ai dashboard | Settings → API Keys at https://onboard.windsor.ai/ |
| `WINDSOR_ACCOUNT` | your shop slug | Same value as your leadership dashboard uses |

Optional:

| Var | What it does |
|---|---|
| `REP_PASS_<SLUG>` | Override one rep's password (e.g. `REP_PASS_AMY_PIERRE=newpass123`) |
| `REP_PASSWORDS` | JSON map override for multiple reps at once: `{"amy-pierre":"x","jamie-bergeron":"y"}` |

## Local development

```bash
cp .env.example .env.local
# edit .env.local and put real values in
npm install
npm run dev
```

Open http://localhost:3000.

## Updating

- **New rep** → add a row to `lib/repRoster.js`, push, redeploy.
- **New comp plan quarter** → add to `lib/compPlan.js`, update `planKey` in
  `lib/repRoster.js` if needed.
- **SKU classification change** → `lib/repData.js`, top of file.

## Caveats

- ADCS-tagged orders excluded throughout.
- XVIE / Serum sit on plans not yet wired in — revenue is shown but doesn't
  roll into commission until those tier tables are added to `lib/compPlan.js`.
- Account company names, cities, and states pull from Shopify shipping
  fields. If a few accounts show blanks, those orders had no shipping
  company set in Shopify.
- Cache is per-deployment. Force a refresh by redeploying in Vercel.
