import * as messageModel from "./model.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const fetchUserMessages = async (userId, otherUserId = null) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // If otherUserId is provided, get conversation between two users
  if (otherUserId) {
    return messageModel.getMessagesBetweenUsers(userId, otherUserId);
  }

  // Otherwise, get all conversations for the user
  return messageModel.getAllUserConversations(userId);
};

export const sendMessage = async (messageData, senderId) => {
  const {
    receiverId,
    content,
    messageType = "text",
    attachments = [],
    projectId,
  } = messageData;

  console.log(
    "📝 Sending message - Sender:",
    senderId,
    "Receiver:",
    receiverId,
    "Content:",
    content
  );

  // Validation
  if (!senderId || !receiverId) {
    throw new Error("Sender ID and Receiver ID are required");
  }

  if (messageType === "text" && !content?.trim()) {
    throw new Error("Message content is required for text messages");
  }

  if (messageType === "file" && (!attachments || attachments.length === 0)) {
    throw new Error("Attachments are required for file messages");
  }

  try {
    const message = await messageModel.createMessage({
      senderId,
      receiverId,
      content: content || "",
      messageType,
      attachments,
      isRead: false,
      priority: "normal",
      isSystemMessage: false,
      ...(projectId ? { projectId } : {}),
    });

    console.log("✅ Message created in database:", message.id);
    return message;
  } catch (error) {
    console.error("❌ Database error creating message:", error);
    throw new Error("Failed to save message to database: " + error.message);
  }
};

export const readMessage = async (id, userId) => {
  if (!id) {
    throw new Error("Message ID is required");
  }

  const message = await messageModel.getMessageById(id);
  if (!message) {
    throw new Error("Message not found");
  }

  // Check if user is the receiver of this message
  if (message.receiverId !== userId) {
    throw new Error("Not authorized to mark this message as read");
  }

  return messageModel.markMessageAsRead(id);
};

export const removeMessage = async (id, userId) => {
  if (!id) {
    throw new Error("Message ID is required");
  }

  const message = await messageModel.getMessageById(id);
  if (!message) {
    throw new Error("Message not found");
  }

  // Only sender can delete their own messages
  if (message.senderId !== userId) {
    throw new Error("Not authorized to delete this message");
  }

  return messageModel.deleteMessage(id);
};

// Get list of users that the current user has conversations with
export const getConversationList = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  return messageModel.getUserConversations(userId);
};

// Get messages for a specific project (admin access)
export const fetchProjectMessages = async (projectId, userId) => {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !user.role.includes("ADMIN")) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Get project to verify it exists and get customer/provider IDs
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      customerId: true,
      providerId: true,
      title: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.customerId || !project.providerId) {
    throw new Error(
      "Project does not have both customer and provider assigned"
    );
  }

  // Get ALL messages between customer and provider (with or without projectId)
  return messageModel.getMessagesBetweenUsers(
    project.customerId,
    project.providerId
  );
};
