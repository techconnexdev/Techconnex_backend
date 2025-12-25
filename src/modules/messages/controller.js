import {
  fetchUserMessages,
  readMessage,
  removeMessage,
  sendMessage,
  getConversationList,
  fetchProjectMessages,
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
