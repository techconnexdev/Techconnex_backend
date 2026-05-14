-- Proposal: store provider-original bid + conversion metadata (additive)

BEGIN;

ALTER TABLE "Proposal"
  ADD COLUMN IF NOT EXISTS "bidAmountOriginal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "bidCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS "bidConversionDate" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "bidConversionSession" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "bidConversionQuote" VARCHAR(10);

COMMIT;
