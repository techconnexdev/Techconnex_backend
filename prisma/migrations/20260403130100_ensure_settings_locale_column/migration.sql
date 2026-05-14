-- Idempotent: fixes DBs missing Settings.locale (no-op migration 20260403120000 did not alter schema)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locale" VARCHAR(10) NOT NULL DEFAULT 'en';
