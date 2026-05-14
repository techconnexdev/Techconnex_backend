import {
  fetchUserMessages,
  readMessage,
  removeMessage,
  sendMessage,
  getConversationList,
  fetchProjectMessages,
  getUnreadMessageCount,
  reportConversation,
  hasUserReportedConversation,
  hasReportBetweenUsers,
} from "./service.js";
import {
  enrichMessagesWithTranslations,
  getUserPreferredLocale,
  normalizeLocaleInput,
  translateTextsInOrder,
} from "./translation-service.js";

// Get messages - either all user messages or conversation with specific user
export const getMessages = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { otherUserId, translate, lang } = req.query; // lang = viewer UI locale (en|id|ar)

    let messages = await fetchUserMessages(userId, otherUserId);

    const translateOff = translate === "0" || translate === "false";
    const shouldTranslate =
      !translateOff &&
      Boolean(otherUserId) &&
      process.env.OPENAI_API_KEY &&
      Array.isArray(messages);

    const langOverride = normalizeLocaleInput(
      typeof lang === "string" ? lang : "",
    );

    if (shouldTranslate) {
      messages = await enrichMessagesWithTranslations(messages, userId, {
        targetLocale: langOverride || undefined,
      });
    }

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// Get list of conversations
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    console.log("Fetching conversations for user:", userId);

    const conversations = await getConversationList(userId);

    console.log("Found conversations:", conversations.length);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch conversations",
    });
  }
};

export const createNewMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const newMessage = await sendMessage(req.body, userId);

    // Emit socket event if needed (for REST API calls)
    if (req.io) {
      req.io.to(newMessage.receiverId).emit("receive_message", newMessage);
    }

    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    const updated = await readMessage(id, userId);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    await removeMessage(id, userId);
    res.json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get messages for a specific project (admin access)
export const getProjectMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id || req.user.userId;
    const { translate, lang } = req.query;

    let messages = await fetchProjectMessages(projectId, userId);

    const translateOff = translate === "0" || translate === "false";
    const shouldTranslate =
      !translateOff &&
      process.env.OPENAI_API_KEY &&
      Array.isArray(messages);

    const langOverride = normalizeLocaleInput(
      typeof lang === "string" ? lang : "",
    );

    if (shouldTranslate) {
      messages = await enrichMessagesWithTranslations(messages, userId, {
        targetLocale: langOverride || undefined,
      });
    }

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Get project messages error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch project messages",
    });
  }
};

// Check if current user can chat with another user (no report between them)
export const checkCanChatHandler = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { otherUserId } = req.query;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: "otherUserId is required",
      });
    }

    const reportExists = await hasReportBetweenUsers(userId, otherUserId);

    res.json({
      success: true,
      data: { canChat: !reportExists },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check",
    });
  }
};

// Check if current user has already reported this conversation
export const checkReportStatusHandler = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { reportedUserId } = req.query;

    if (!reportedUserId) {
      return res.status(400).json({
        success: false,
        message: "reportedUserId is required",
      });
    }

    const reported = await hasUserReportedConversation(userId, reportedUserId);

    res.json({
      success: true,
      data: { reported },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check report status",
    });
  }
};

// Report a conversation
export const reportConversationHandler = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { reportedUserId, reason, additionalDetails } = req.body;

    const report = await reportConversation(userId, {
      reportedUserId,
      reason,
      additionalDetails,
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully. Our team will review it.",
      data: { id: report.id },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to submit report",
    });
  }
};

/**
 * Batch-translate message texts (e.g. after a live socket message).
 * Body: { items: [{ id, content }], targetLocale?: "en"|"id"|"ar" }
 */
export const translateMessagesBatchHandler = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { items, targetLocale } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, translations: [] });
    }

    const clamped = items.slice(0, 40).map((it) => ({
      id: String(it?.id ?? ""),
      content: String(it?.content ?? ""),
    }));

    const texts = clamped.map((i) => i.content);
    const fromBody = normalizeLocaleInput(targetLocale);
    const locale = fromBody || (await getUserPreferredLocale(userId));

    if (!String(process.env.OPENAI_API_KEY ?? "").trim()) {
      return res.status(503).json({
        success: false,
        code: "OPENAI_NOT_CONFIGURED",
        message:
          "Translation is unavailable: add OPENAI_API_KEY to the backend .env and restart the server.",
      });
    }

    let outs;
    try {
      outs = await translateTextsInOrder(texts, locale);
    } catch (inner) {
      const msg = inner?.message || String(inner);
      if (
        msg.includes("OPENAI_API_KEY") ||
        msg.includes("401") ||
        msg.includes("Incorrect API key")
      ) {
        return res.status(503).json({
          success: false,
          code: "OPENAI_MISCONFIGURED",
          message:
            "Translation failed: check OPENAI_API_KEY and billing/quota on your OpenAI account.",
        });
      }
      throw inner;
    }

    const translations = clamped.map((it, i) => ({
      id: it.id,
      translatedContent: outs[i] ?? null,
    }));

    return res.json({ success: true, translations });
  } catch (error) {
    console.error("translateMessagesBatch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Translation failed",
    });
  }
};

// Get total unread message count for the current user
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const count = await getUnreadMessageCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch unread count",
    });
  }
};
