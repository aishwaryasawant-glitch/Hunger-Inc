// One-time seed script: loads data/historical.json (bootstrapped from the
// original Excel workbooks) into the `months` table.
//
// Usage:
//   1. vercel env pull .env.development.local   (pulls DATABASE_URL from your project)
//   2. node --env-file=.env.development.local scripts/seed.mjs
//
// Safe to re-run: uses ON CONFLICT DO UPDATE, so it will not create duplicates.

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run `vercel env pull .env.development.local` first,');
  console.error('then: node --env-file=.env.development.local scripts/seed.mjs');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const FIELDS = [
  'covers', 'rev_food', 'rev_liquor', 'rev_otherbev', 'rev_othersales', 'rev_total',
  'gp_food', 'gp_liquor', 'gp_otherbev', 'gp_othersales', 'gp_total',
  'team_cost', 'avg_salary', 'rev_per_cover', 'gp_per_cover'
];

async function main() {
  const dataPath = path.join(__dirname, '..', 'data', 'historical.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));

  await sql`
    CREATE TABLE IF NOT EXISTS months (
      outlet TEXT NOT NULL, month TEXT NOT NULL,
      covers NUMERIC, rev_food NUMERIC, rev_liquor NUMERIC, rev_otherbev NUMERIC,
      rev_othersales NUMERIC, rev_total NUMERIC, gp_food NUMERIC, gp_liquor NUMERIC,
      gp_otherbev NUMERIC, gp_othersales NUMERIC, gp_total NUMERIC, team_cost NUMERIC,
      team_size NUMERIC, avg_salary NUMERIC, rev_per_cover NUMERIC, gp_per_cover NUMERIC,
      updated_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (outlet, month)
    )
  `;

  let count = 0;
  for (const outlet of Object.keys(data)) {
    const d = data[outlet];
    for (let i = 0; i < d.months.length; i++) {
      const month = d.months[i];
      const v = {};
      FIELDS.forEach(f => { v[f] = d[f] ? d[f][i] : null; });
      // team_size wasn't stored historically as its own column; back-derive it
      // from team_cost / avg_salary so the admin form's headcount field has a
      // sensible starting value if that month is ever edited later.
      const team_size = (v.avg_salary && v.team_cost) ? Math.round(v.team_cost / v.avg_salary) : null;

      await sql`
        INSERT INTO months (
          outlet, month, covers, rev_food, rev_liquor, rev_otherbev, rev_othersales, rev_total,
          gp_food, gp_liquor, gp_otherbev, gp_othersales, gp_total,
          team_cost, team_size, avg_salary, rev_per_cover, gp_per_cover, updated_at
        ) VALUES (
          ${outlet}, ${month}, ${v.covers}, ${v.rev_food}, ${v.rev_liquor}, ${v.rev_otherbev}, ${v.rev_othersales}, ${v.rev_total},
          ${v.gp_food}, ${v.gp_liquor}, ${v.gp_otherbev}, ${v.gp_othersales}, ${v.gp_total},
          ${v.team_cost}, ${team_size}, ${v.avg_salary}, ${v.rev_per_cover}, ${v.gp_per_cover}, now()
        )
        ON CONFLICT (outlet, month) DO UPDATE SET
          covers=EXCLUDED.covers, rev_food=EXCLUDED.rev_food, rev_liquor=EXCLUDED.rev_liquor,
          rev_otherbev=EXCLUDED.rev_otherbev, rev_othersales=EXCLUDED.rev_othersales, rev_total=EXCLUDED.rev_total,
          gp_food=EXCLUDED.gp_food, gp_liquor=EXCLUDED.gp_liquor, gp_otherbev=EXCLUDED.gp_otherbev,
          gp_othersales=EXCLUDED.gp_othersales, gp_total=EXCLUDED.gp_total, team_cost=EXCLUDED.team_cost,
          team_size=EXCLUDED.team_size, avg_salary=EXCLUDED.avg_salary, rev_per_cover=EXCLUDED.rev_per_cover,
          gp_per_cover=EXCLUDED.gp_per_cover, updated_at=now()
      `;
      count++;
    }
  }
  console.log(`Seeded ${count} outlet-month records.`);
}

main().catch(err => { console.error(err); process.exit(1); });
