UPDATE "User"
SET "isGoogleAccount" = false
WHERE "isGoogleAccount" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "isGoogleAccount" SET DEFAULT false;

ALTER TABLE "User"
ALTER COLUMN "isGoogleAccount" SET NOT NULL;
