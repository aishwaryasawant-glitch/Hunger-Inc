-- RMF Dashboard schema
-- Run this once against your Neon/Postgres database before seeding.

CREATE TABLE IF NOT EXISTS months (
  outlet          TEXT NOT NULL,
  month           TEXT NOT NULL,           -- 'YYYY-MM'
  covers          NUMERIC,
  rev_food        NUMERIC,
  rev_liquor      NUMERIC,
  rev_otherbev    NUMERIC,
  rev_othersales  NUMERIC,
  rev_total       NUMERIC,
  gp_food         NUMERIC,
  gp_liquor       NUMERIC,
  gp_otherbev     NUMERIC,
  gp_othersales   NUMERIC,
  gp_total        NUMERIC,
  team_cost       NUMERIC,
  team_size       NUMERIC,
  avg_salary      NUMERIC,
  rev_per_cover   NUMERIC,
  gp_per_cover    NUMERIC,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (outlet, month)
);
