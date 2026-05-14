-- BNM snapshot stored on provider profile (updated in place when hourly/budget/currency change)
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "fx_snapshot_date" VARCHAR(20);
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "fx_snapshot_session" VARCHAR(20);
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "fx_snapshot_quote" VARCHAR(10);
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "fx_snapshot_rates_json" JSONB;
