-- CreateTable
CREATE TABLE "support_conversation_reads" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_conversation_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_conversation_reads_admin_user_id_idx" ON "support_conversation_reads"("admin_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_conversation_reads_conversation_id_admin_user_id_key" ON "support_conversation_reads"("conversation_id", "admin_user_id");

-- AddForeignKey
ALTER TABLE "support_conversation_reads" ADD CONSTRAINT "support_conversation_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
