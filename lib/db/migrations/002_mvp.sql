-- 002_mvp.sql: fields the teacher and student pages use. Additive and safe to re-run.
--   psql -U postgres -d classly -f 002_mvp.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- teacher PINs are checked with crypt()
BEGIN;

ALTER TABLE section       ADD COLUMN IF NOT EXISTS subject    text;
ALTER TABLE class_session ADD COLUMN IF NOT EXISTS name       text NOT NULL DEFAULT '';
ALTER TABLE activity      ADD COLUMN IF NOT EXISTS show_score boolean NOT NULL DEFAULT true;
ALTER TABLE choice        ADD COLUMN IF NOT EXISTS position   int NOT NULL DEFAULT 0;

COMMIT;
