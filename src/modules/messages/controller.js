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

// Get messages - either all user messages or conversation with specific user
export const getMessages = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { otherUserId } = req.query; // Optional: for specific conversation

    const messages = await fetchUserMessages(userId, otherUserId);

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

    const messages = await fetchProjectMessages(projectId, userId);

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
