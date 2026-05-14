-- Convert existing plain-text summaries into locale-map JSON.
-- We preserve current content under the "en" key.
ALTER TABLE "ai_drafts"
ALTER COLUMN "summary" TYPE JSONB
USING jsonb_build_object(
  'en',
  COALESCE(NULLIF(BTRIM("summary"), ''), '')
);
