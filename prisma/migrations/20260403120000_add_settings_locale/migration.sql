-- Ensure Settings.locale exists (some DBs were created or synced without this column)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locale" VARCHAR(10) NOT NULL DEFAULT 'en';
