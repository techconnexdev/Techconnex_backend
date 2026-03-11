import { PrismaClient } from "@prisma/client";
import { uploadFileToR2, getPublicUrl, downloadFileFromR2, deleteFileFromR2 } from "../../../utils/r2.js";
import { FRIENDLY_500_MESSAGE } from "../../../utils/errors.js";
import { indexDocument } from "../../support-chat/rag-service.js";
import { emitSupportUpdate } from "../../../io.js";

const prisma = new PrismaClient();

/**
 * GET /admin/support/conversations – list all support conversations (for admin)
 * Returns hasUnread per conversation (messages after admin's lastReadAt).
 */
export async function listConversations(req, res) {
  try {
    const adminId = req.user?.id || req.user?.userId;
    const { status } = req.query;
    const where = status ? { status } : {};
    const baseInclude = {
      user: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, senderType: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    };
    let list;
    let useReads = false;
    if (adminId && prisma.supportConversationRead) {
      try {
        list = await prisma.supportConversation.findMany({
          where,
          include: {
            ...baseInclude,
            adminReads: { where: { adminUserId: adminId }, select: { lastReadAt: true } },
          },
          orderBy: { updatedAt: "desc" },
        });
        useReads = true;
      } catch (e) {
        // Client not regenerated (adminReads unknown) or migration not applied (table missing)
        list = await prisma.supportConversation.findMany({
          where,
          include: baseInclude,
          orderBy: { updatedAt: "desc" },
        });
      }
    } else {
      list = await prisma.supportConversation.findMany({
        where,
        include: baseInclude,
        orderBy: { updatedAt: "desc" },
      });
    }

    const data = list.map((c) => {
      const lastMsg = c.messages[0];
      const read = useReads && c.adminReads?.[0];
      const hasUnread =
        useReads &&
        !!adminId &&
        !!lastMsg &&
        (!read || new Date(lastMsg.createdAt) > new Date(read.lastReadAt));

      return {
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        userEmail: c.user.email,
        userRole: c.user.role,
        status: c.status,
        handoffRequestedAt: c.handoffRequestedAt,
        messageCount: c._count.messages,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content?.slice(0, 100),
              senderType: lastMsg.senderType,
              createdAt: lastMsg.createdAt,
            }
          : null,
        updatedAt: c.updatedAt,
        hasUnread: !!hasUnread,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Admin support listConversations:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * GET /admin/support/conversations/:id – get one conversation with full messages
 * Marks the conversation as read for the current admin.
 */
export async function getConversation(req, res) {
  try {
    const adminId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const conv = await prisma.supportConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (adminId && prisma.supportConversationRead) {
      try {
        await prisma.supportConversationRead.upsert({
          where: {
            conversationId_adminUserId: { conversationId: id, adminUserId: adminId },
          },
          create: { conversationId: id, adminUserId: adminId, lastReadAt: new Date() },
          update: { lastReadAt: new Date() },
        });
      } catch (e) {
        // Ignore if table not migrated or client not regenerated
      }
    }

    return res.json({
      success: true,
      data: {
        ...conv,
        messages: conv.messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          senderUserId: m.senderUserId,
          content: m.content,
          attachments: m.attachments || [],
          metadata: m.metadata,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("Admin support getConversation:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * POST /admin/support/conversations/:id/message – admin sends a message (Human Support)
 * Body: { content: string, attachmentUrls?: string[] }
 */
export async function sendAdminMessage(req, res) {
  try {
    const adminId = req.user?.id || req.user?.userId;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { content, attachmentUrls } = req.body || {};
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const conv = await prisma.supportConversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (conv.status === "OPEN") {
      return res.status(400).json({
        success: false,
        message: "You cannot chat while the conversation is with AI. Wait for a handoff request or change the status to Human taken.",
      });
    }
    if (conv.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        message: "This conversation is closed. Change the status to reopen it before sending messages.",
      });
    }

    const message = await prisma.supportMessage.create({
      data: {
        conversationId: id,
        senderType: "HUMAN",
        senderUserId: adminId,
        content: content.trim(),
        attachments: Array.isArray(attachmentUrls) ? attachmentUrls : [],
      },
    });

    await prisma.supportConversation.update({
      where: { id },
      data: {
        status: "HUMAN_TAKEN",
        takenOverByAdminId: conv.takenOverByAdminId || adminId,
        updatedAt: new Date(),
      },
    });

    emitSupportUpdate(id, conv.userId, {
      status: "HUMAN_TAKEN",
      messages: [
        {
          id: message.id,
          senderType: message.senderType,
          senderUserId: message.senderUserId,
          content: message.content,
          attachments: message.attachments || [],
          createdAt: message.createdAt,
        },
      ],
    });

    return res.json({
      success: true,
      data: {
        id: message.id,
        senderType: message.senderType,
        senderUserId: message.senderUserId,
        content: message.content,
        attachments: message.attachments || [],
        createdAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error("Admin support sendAdminMessage:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * PATCH /admin/support/conversations/:id – update status (e.g. CLOSED)
 */
export async function updateConversation(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["OPEN", "HANDOFF_REQUESTED", "HUMAN_TAKEN", "CLOSED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const conv = await prisma.supportConversation.update({
      where: { id },
      data: { status },
    });
    emitSupportUpdate(id, conv.userId, { status });
    return res.json({ success: true, data: conv });
  } catch (err) {
    console.error("Admin support updateConversation:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * GET /admin/support/references – list reference documents
 */
export async function listReferences(req, res) {
  try {
    const docs = await prisma.supportReferenceDocument.findMany({
      orderBy: { slug: "asc" },
      include: { _count: { select: { chunks: true } } },
    });
    const data = docs.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      fileKey: d.fileKey,
      fileUrl: d.fileUrl,
      indexedAt: d.indexedAt,
      chunksCount: d._count.chunks,
      createdAt: d.createdAt,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Admin support listReferences:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * POST /admin/support/references/upload – upload PDF (multipart: file, slug, name)
 */
export async function uploadReference(req, res) {
  try {
    const { slug, name } = req.body || {};
    const file = req.file;
    if (!slug || !name || !file) {
      return res.status(400).json({
        success: false,
        message: "slug, name, and file (PDF) are required",
      });
    }
    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, message: "Only PDF files are allowed" });
    }

    const key = `support-refs/${slug}-${Date.now()}.pdf`;
    await uploadFileToR2(file.buffer, key, "application/pdf");
    let fileUrl;
    try {
      fileUrl = await getPublicUrl(key);
    } catch {
      fileUrl = null;
    }

    const doc = await prisma.supportReferenceDocument.upsert({
      where: { slug },
      create: { name, slug, fileKey: key, fileUrl },
      update: { name, fileKey: key, fileUrl, updatedAt: new Date() },
    });

    return res.json({
      success: true,
      data: {
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        fileKey: doc.fileKey,
        fileUrl: doc.fileUrl,
        indexedAt: doc.indexedAt,
      },
    });
  } catch (err) {
    console.error("Admin support uploadReference:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * POST /admin/support/references/:id/reindex – re-index PDF chunks
 */
export async function reindexReference(req, res) {
  try {
    const { id } = req.params;
    const doc = await prisma.supportReferenceDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    const buffer = await downloadFileFromR2(doc.fileKey);
    const result = await indexDocument(id, buffer);

    const updated = await prisma.supportReferenceDocument.findUnique({
      where: { id },
      select: { indexedAt: true, id: true, name: true, slug: true },
    });

    return res.json({
      success: true,
      data: { ...updated, chunksCreated: result.chunksCreated },
    });
  } catch (err) {
    console.error("Admin support reindexReference:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * DELETE /admin/support/references/:id – delete reference document and its RAG chunks; optionally remove file from R2
 */
export async function deleteReference(req, res) {
  try {
    const { id } = req.params;
    const doc = await prisma.supportReferenceDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    if (doc.fileKey) {
      try {
        await deleteFileFromR2(doc.fileKey);
      } catch (e) {
        console.warn("R2 delete failed (file may already be gone):", e.message);
      }
    }

    await prisma.supportReferenceDocument.delete({ where: { id } });

    return res.json({ success: true, message: "Reference document deleted" });
  } catch (err) {
    console.error("Admin support deleteReference:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}
