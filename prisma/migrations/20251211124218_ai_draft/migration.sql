-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('PROVIDER', 'CUSTOMER', 'SERVICE_REQUEST');

-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" UUID NOT NULL,
    "type" "DraftType" NOT NULL,
    "referenceId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceData" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_drafts_type_referenceId_idx" ON "ai_drafts"("type", "referenceId");
