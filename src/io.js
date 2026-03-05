/**
 * Socket.IO instance getter. Set by index.js after server creation.
 * Used by support-chat and admin support to emit real-time events.
 */
let _io = null;

export function setIo(io) {
  _io = io;
}

export function getIo() {
  return _io;
}

/**
 * Emit support message/status to user and admins viewing the conversation.
 * @param {string} conversationId
 * @param {string} userId - conversation owner (customer)
 * @param {object} payload - { message?, messages?, status? }
 */
export function emitSupportUpdate(conversationId, userId, payload) {
  const io = getIo();
  if (!io) return;
  const data = { conversationId, ...payload };
  io.to(userId).emit("support_message", data);
  io.to(`support:conv:${conversationId}`).emit("support_message", data);
}
