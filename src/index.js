import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import server from "./server.js";
import { authenticateSocket } from "./middlewares/auth.js";
import { sendMessage, readMessage } from "./modules/messages/service.js";

const httpServer = http.createServer(server);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket middleware for authentication
io.use(authenticateSocket);

// Track connected users
const connectedUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.user?.userId;
  console.log("🟢 User connected:", userId, socket.id);

  // Track user as online
  connectedUsers.set(userId, socket.id);

  // Join user to their personal room
  socket.join(userId);

  // Notify all users that this user is online

  // Send list of currently online users to the new connection
  socket.emit("online_users", {
    userIds: Array.from(connectedUsers.keys()),
  });

  // Notify all users that this user is online
  io.emit("user_online", { userId });
  socket.on("send_message", async (data, callback) => {
    try {
      console.log("📤 Received send_message from user:", socket.user.userId);
      console.log("Message data:", data);

      const { receiverId, content, messageType, attachments, projectId } = data;

      // Validate required fields
      if (!receiverId) {
        throw new Error("Receiver ID is required");
      }

      if (!content && (!attachments || attachments.length === 0)) {
        throw new Error("Message must have either content or attachments");
      }

      // Save message to database with authenticated user as sender
      const newMessage = await sendMessage(
        {
          receiverId,
          content,
          messageType: messageType || "text",
          attachments: attachments || [],
          ...(projectId != null ? { projectId } : {}),
        },
        socket.user.userId
      );

      console.log("✅ Message saved to DB with ID:", newMessage.id);

      // Emit to sender (for confirmation)
      socket.emit("message_sent", newMessage);

      // Emit to receiver
      socket.to(receiverId).emit("receive_message", newMessage);

      // Also emit to sender in case they're in multiple tabs
      socket.emit("receive_message", newMessage);

      if (callback) {
        callback({ success: true, data: newMessage });
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
      // Also send error to client via socket
      socket.emit("message_error", { error: error.message });
    }
  });

  socket.on("mark_as_read", async (data) => {
    try {
      const { messageId } = data;
      const updatedMessage = await readMessage(messageId, socket.user.userId);

      // Notify sender that their message was read
      socket.to(updatedMessage.senderId).emit("message_read", {
        messageId,
        readAt: updatedMessage.readAt,
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.user?.userId, socket.id);

    // Remove user from connected tracking
    connectedUsers.delete(socket.user?.userId);

    // Notify all users that this user is offline
    io.emit("user_offline", { userId: socket.user?.userId });
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

// Make io available to other modules
export { io, connectedUsers };
