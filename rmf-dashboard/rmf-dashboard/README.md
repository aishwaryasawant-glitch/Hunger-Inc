# RMF Dashboard

Restaurant Monitoring Framework dashboard for The Bombay Canteen, O Pedro, Papa's,
Veronica's Bandra, and Veronica's Lower Parel.

- **Frontend**: plain HTML/CSS/JS, no build step, no framework.
- **API**: two Vercel serverless functions (`/api/months`) using
  [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) —
  this is the currently-supported way to use Postgres on Vercel. (The old
  `@vercel/postgres` package has been deprecated since Vercel folded its
  Postgres offering into a native Neon integration.)
- **Database**: Postgres, provisioned via Vercel's Neon integration.
- **Read-only PPTX-sourced charts** (meal period, COGS, people cost, etc.) ship
  as a static file (`data/extra.json`) and are not part of the database — they
  don't change via the Admin tab.

## One-time setup

### 1. Create the Vercel project
```bash
npm i -g vercel
cd rmf-dashboard
vercel link          # creates/links the Vercel project
```

### 2. Add a Postgres database (Neon)
In the Vercel dashboard: **your project → Storage → Create Database → Postgres**
(this provisions a Neon database and automatically adds a `DATABASE_URL`
environment variable to your project — you don't need a separate Neon account).

### 3. Set the admin secret
In **Project Settings → Environment Variables**, add:
```
ADMIN_SECRET = <pick any password-like string>
```
This is what protects the Admin tab — anyone who knows it can submit months, so
share it only with whoever should be entering data.

### 4. Install dependencies
```bash
npm install
```

### 5. Pull env vars locally and seed the database
```bash
vercel env pull .env.development.local
npm run seed
```
This creates the `months` table (if it doesn't exist yet) and loads all
historical data (April 2024 - August 2026, per outlet) from
`data/historical.json`. Safe to re-run — it upserts, it won't duplicate rows.

### 6. Deploy
```bash
vercel --prod
```

From then on, `git push` to your connected GitHub repo will trigger a new
deployment automatically.

## Updating the historical data

If you send me (Claude) a new version of the source Excel workbooks, I'll
regenerate `data/historical.json` and/or `data/extra.json` for you — drop the
new file(s) in, commit, push, and re-run `npm run seed` if `historical.json`
changed (the live site's month-to-month figures come from the database, not
straight from this file, so a re-seed is what actually updates them).

## Adding new months day-to-day

Once deployed, anyone with the admin code can open the **Admin** tab, pick an
outlet and month, fill in the same line items as the workbook, and submit —
no redeploy or reseed needed. Every outlet-month is its own database row, so
adding a new month never touches previous ones; editing an existing
outlet-month (same outlet + same month) overwrites just that row.

## Local development

There's no dev server bundled in — `vercel dev` will run the static files and
the `/api` functions together with your pulled env vars:
```bash
vercel dev
```

## Project structure
```
index.html          the whole app shell
style.css
app.js              all UI logic + admin form + chart rendering
api/
  months.js          GET (list all months) / POST (upsert one month)
data/
  historical.json    source data for the one-time seed (not read live)
  extra.json         static read-only PPTX-sourced charts, fetched at runtime
db/
  schema.sql         table definition (also created automatically by seed.mjs)
scripts/
  seed.mjs           one-time/rerunnable loader for historical.json
```
