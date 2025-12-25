import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getMessagesBetweenUsers = async (userId, otherUserId) => {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

export const getAllUserConversations = async (userId) => {
  return prisma.message.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

export const getUserConversations = async (userId) => {
  try {
    // 1️⃣ Fetch all messages involving the user
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            customerProfile: { select: { profileImageUrl: true } },
            providerProfile: { select: { profileImageUrl: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            customerProfile: { select: { profileImageUrl: true } },
            providerProfile: { select: { profileImageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2️⃣ Group messages by conversation partner
    const conversationMap = new Map();

    messages.forEach((message) => {
      const isSender = message.senderId === userId;
      const partner = isSender ? message.receiver : message.sender;
      const partnerId = partner.id;

      // Determine avatar based on role
      let avatar = null;
      if (partner.role.includes("CUSTOMER")) {
        avatar = partner.customerProfile?.profileImageUrl || null;
      } else {
        avatar = partner.providerProfile?.profileImageUrl || null;
      }

      if (
        !conversationMap.has(partnerId) ||
        new Date(message.createdAt) >
          new Date(conversationMap.get(partnerId).lastMessageAt)
      ) {
        conversationMap.set(partnerId, {
          userId: partnerId,
          name: partner.name,
          email: partner.email,
          role: partner.role,
          avatar,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
        });
      }
    });

    // 3️⃣ Calculate unread counts
    const unreadCounts = await prisma.message.groupBy({
      by: ["senderId"],
      where: {
        receiverId: userId,
        isRead: false,
      },
      _count: { _all: true },
    });

    unreadCounts.forEach(({ senderId, _count }) => {
      if (conversationMap.has(senderId)) {
        conversationMap.get(senderId).unreadCount = _count._all;
      }
    });

    // 4️⃣ Return sorted conversations
    return Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    throw error;
  }
};

export const createMessage = async (data) => {
  return prisma.message.create({
    data,
    include: {
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
    },
  });
};

export const markMessageAsRead = async (id) => {
  return prisma.message.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
    },
  });
};
export const deleteMessage = async (id) => {
  return prisma.message.delete({ where: { id } });
};

export const getMessageById = async (id) => {
  return prisma.message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
    },
  });
};

// Get messages between two users for a specific project
export const getMessagesBetweenUsersForProject = async (
  userId1,
  userId2,
  projectId
) => {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId1, receiverId: userId2, projectId },
        { senderId: userId2, receiverId: userId1, projectId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};
