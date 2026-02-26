-- CreateEnum
CREATE TYPE "ConversationReportReason" AS ENUM ('OUTSOURCE_OFF_PLATFORM', 'SPAM_IRRELEVANT', 'HARASSMENT_INAPPROPRIATE', 'FRAUD_IMPERSONATION');

-- CreateTable
CREATE TABLE "conversation_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "reason" "ConversationReportReason" NOT NULL,
    "additional_details" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
