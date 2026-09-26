// Vercel serverless function: GET /api/months, POST /api/months
// Uses Neon's serverless driver (the current recommended path for Postgres on
// Vercel, since the old @vercel/postgres package is deprecated).
//
// Requires DATABASE_URL to be set (auto-added when you connect the Neon
// integration from the Vercel dashboard), and ADMIN_SECRET set manually
// (Project Settings -> Environment Variables) to protect writes.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const NUMERIC_FIELDS = [
  'covers', 'rev_food', 'rev_liquor', 'rev_otherbev', 'rev_othersales', 'rev_total',
  'gp_food', 'gp_liquor', 'gp_otherbev', 'gp_othersales', 'gp_total',
  'team_cost', 'team_size', 'avg_salary', 'rev_per_cover', 'gp_per_cover'
];

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM months ORDER BY outlet, month`;
      const out = rows.map(r => {
        const rec = { outlet: r.outlet, month: r.month };
        NUMERIC_FIELDS.forEach(f => { rec[f] = toNumber(r[f]); });
        return rec;
      });
      res.status(200).json(out);
      return;
    }

    if (req.method === 'POST') {
      const secret = req.headers['x-admin-secret'];
      if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        res.status(401).json({ error: 'Invalid or missing admin code.' });
        return;
      }
      const body = req.body || {};
      const { outlet, month } = body;
      if (!outlet || !month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: 'outlet and month (YYYY-MM) are required.' });
        return;
      }
      const v = {};
      NUMERIC_FIELDS.forEach(f => { v[f] = toNumber(body[f]); });

      await sql`
        INSERT INTO months (
          outlet, month, covers, rev_food, rev_liquor, rev_otherbev, rev_othersales, rev_total,
          gp_food, gp_liquor, gp_otherbev, gp_othersales, gp_total,
          team_cost, team_size, avg_salary, rev_per_cover, gp_per_cover, updated_at
        ) VALUES (
          ${outlet}, ${month}, ${v.covers}, ${v.rev_food}, ${v.rev_liquor}, ${v.rev_otherbev}, ${v.rev_othersales}, ${v.rev_total},
          ${v.gp_food}, ${v.gp_liquor}, ${v.gp_otherbev}, ${v.gp_othersales}, ${v.gp_total},
          ${v.team_cost}, ${v.team_size}, ${v.avg_salary}, ${v.rev_per_cover}, ${v.gp_per_cover}, now()
        )
        ON CONFLICT (outlet, month) DO UPDATE SET
          covers = EXCLUDED.covers,
          rev_food = EXCLUDED.rev_food,
          rev_liquor = EXCLUDED.rev_liquor,
          rev_otherbev = EXCLUDED.rev_otherbev,
          rev_othersales = EXCLUDED.rev_othersales,
          rev_total = EXCLUDED.rev_total,
          gp_food = EXCLUDED.gp_food,
          gp_liquor = EXCLUDED.gp_liquor,
          gp_otherbev = EXCLUDED.gp_otherbev,
          gp_othersales = EXCLUDED.gp_othersales,
          gp_total = EXCLUDED.gp_total,
          team_cost = EXCLUDED.team_cost,
          team_size = EXCLUDED.team_size,
          avg_salary = EXCLUDED.avg_salary,
          rev_per_cover = EXCLUDED.rev_per_cover,
          gp_per_cover = EXCLUDED.gp_per_cover,
          updated_at = now()
      `;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: String(err && err.message || err) });
  }
}
