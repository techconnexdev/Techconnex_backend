import * as service from "./service.js";

const userId = (req) => req.user?.id || req.user?.userId;

/**
 * GET /support-chat – get or create current user's conversation and return with messages
 */
export async function getConversation(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const conversation = await service.getOrCreateConversation(uid);
    return res.json({
      success: true,
      data: {
        id: conversation.id,
        userId: conversation.userId,
        status: conversation.status,
        handoffRequestedAt: conversation.handoffRequestedAt,
        messages: conversation.messages.map((m) => ({
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
    console.error("Support chat getConversation:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
}

/**
 * POST /support-chat/message – send user message, get AI reply (or handoff), persist both
 * Body: { content: string, attachmentUrls?: string[] }
 */
export async function sendMessage(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { content, attachmentUrls } = req.body || {};
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const conversation = await service.getOrCreateConversation(uid);
    if (conversation.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        message: "This conversation has been closed. You cannot send more messages.",
      });
    }

    const { userMessage, aiMessage } = await service.addUserMessageAndReply(
      conversation.id,
      uid,
      content.trim(),
      Array.isArray(attachmentUrls) ? attachmentUrls : []
    );

    const payload = {
      success: true,
      data: {
        userMessage: {
          id: userMessage.id,
          senderType: userMessage.senderType,
          senderUserId: userMessage.senderUserId,
          content: userMessage.content,
          attachments: userMessage.attachments || [],
          createdAt: userMessage.createdAt,
        },
        aiMessage: aiMessage
          ? {
              id: aiMessage.id,
              senderType: aiMessage.senderType,
              content: aiMessage.content,
              metadata: aiMessage.metadata,
              createdAt: aiMessage.createdAt,
            }
          : null,
      },
    };
    return res.json(payload);
  } catch (err) {
    if (err.message === "CONVERSATION_CLOSED") {
      return res.status(400).json({
        success: false,
        message: "This conversation has been closed. You cannot send more messages.",
      });
    }
    console.error("Support chat sendMessage:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
}
