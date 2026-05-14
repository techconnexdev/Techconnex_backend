-- Reconcile migration history with existing production/dev schema drift.
-- This is intentionally idempotent to avoid data loss in environments
-- where the column was created manually before migration was generated.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isGoogleAccount" BOOLEAN NOT NULL DEFAULT false;
