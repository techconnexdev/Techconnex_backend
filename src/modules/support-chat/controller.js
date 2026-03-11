import * as service from "./service.js";
import { emitSupportUpdate } from "../../io.js";
import { FRIENDLY_500_MESSAGE } from "../../utils/errors.js";

const userId = (req) => req.user?.id || req.user?.userId;

function conversationToPayload(conversation) {
  return {
    id: conversation.id,
    userId: conversation.userId,
    status: conversation.status,
    handoffRequestedAt: conversation.handoffRequestedAt,
    messages: (conversation.messages || []).map((m) => ({
      id: m.id,
      senderType: m.senderType,
      senderUserId: m.senderUserId,
      content: m.content,
      attachments: m.attachments || [],
      metadata: m.metadata,
      createdAt: m.createdAt,
    })),
  };
}

/**
 * GET /support-chat – get latest (or create) current user's conversation and return with messages
 */
export async function getConversation(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const conversation = await service.getOrCreateConversation(uid);
    return res.json({ success: true, data: conversationToPayload(conversation) });
  } catch (err) {
    console.error("Support chat getConversation:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * GET /support-chat/sessions – list current user's support conversations (for history)
 * Query: status (optional) – OPEN | HANDOFF_REQUESTED | HUMAN_TAKEN | CLOSED | ALL
 */
export async function getMySessions(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const status = (req.query.status || "ALL").toUpperCase();
    const list = await service.listUserConversations(uid, status === "ALL" ? undefined : status);
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error("Support chat getMySessions:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * GET /support-chat/sessions/:id – get a single conversation by id (only if owned by current user)
 */
export async function getSessionById(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const conversation = await service.getConversationByIdForUser(id, uid);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    return res.json({ success: true, data: conversationToPayload(conversation) });
  } catch (err) {
    console.error("Support chat getSessionById:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

/**
 * POST /support-chat/start-new – start a new support conversation (e.g. after previous was closed)
 */
export async function startNewConversation(req, res) {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const conversation = await service.startNewConversation(uid);
    return res.json({ success: true, data: conversationToPayload(conversation) });
  } catch (err) {
    console.error("Support chat startNewConversation:", err);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
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

    const conversation = await service.getOrCreateConversation(uid); // latest conversation
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

    const newMessages = [userMessage];
    if (aiMessage) newMessages.push(aiMessage);
    const statusUpdate = aiMessage?.metadata?.handoffTriggered ? "HANDOFF_REQUESTED" : undefined;
    emitSupportUpdate(conversation.id, conversation.userId, {
      ...(statusUpdate && { status: statusUpdate }),
      messages: newMessages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        senderUserId: m.senderUserId,
        content: m.content,
        attachments: m.attachments || [],
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });

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
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}
