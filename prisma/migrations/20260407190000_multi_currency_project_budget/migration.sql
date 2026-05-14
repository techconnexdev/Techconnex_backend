-- Multi-currency project budget support
-- Safe additive migration (no destructive operations)

BEGIN;

-- Settings.preferredCurrency (default MYR)
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "preferredCurrency" VARCHAR(3) NOT NULL DEFAULT 'MYR';

-- ServiceRequest currency + locked FX snapshot fields
ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS "fxSnapshotDate" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "fxSnapshotSession" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "fxSnapshotQuote" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "fxSnapshotRatesJson" JSONB;

-- Project currency + locked FX snapshot fields
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS "fxSnapshotDate" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "fxSnapshotSession" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "fxSnapshotQuote" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "fxSnapshotRatesJson" JSONB;

COMMIT;
