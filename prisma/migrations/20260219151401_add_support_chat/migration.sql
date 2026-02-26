-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'HANDOFF_REQUESTED', 'HUMAN_TAKEN', 'CLOSED');

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "handoff_requested_at" TIMESTAMPTZ(6),
    "taken_over_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" "SupportSenderType" NOT NULL,
    "sender_user_id" UUID,
    "content" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reference_documents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "file_key" VARCHAR(500) NOT NULL,
    "file_url" VARCHAR(1000),
    "indexed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_reference_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reference_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "page" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_reference_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_userId_key" ON "support_conversations"("userId");

-- CreateIndex
CREATE INDEX "support_messages_conversation_id_idx" ON "support_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_reference_documents_slug_key" ON "support_reference_documents"("slug");

-- CreateIndex
CREATE INDEX "support_reference_chunks_document_id_idx" ON "support_reference_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_reference_chunks" ADD CONSTRAINT "support_reference_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "support_reference_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
