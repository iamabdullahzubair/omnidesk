import { messageService } from '../services/message.service.js';
import { conversationService } from '../services/conversation.service.js';
import { presenceRegistry } from './presence.registry.js';
import {
  sendMessageSchema,
  messageIdSchema,
  typingEventSchema,
} from '../validators/message.validator.js';
import { conversationIdParamSchema } from '../validators/conversation.validator.js';

export const registerSocketHandlers = (io, socket) => {
  const user = socket.user;

  // 1. Join personal user room for private notifications
  socket.join(`user:${user.id}`);

  // 2. Track presence
  const becameOnline = presenceRegistry.addSocket(user.id, socket.id);
  if (becameOnline) {
    io.emit('user:presence', {
      userId: user.id,
      status: 'online',
    });
  }

  // Handle client requesting initial online presence of users
  socket.on('presence:query', (userIds, callback) => {
    if (typeof callback === 'function' && Array.isArray(userIds)) {
      const presenceMap = {};
      userIds.forEach((id) => {
        presenceMap[id] = presenceRegistry.isUserOnline(id);
      });
      callback({ success: true, data: presenceMap });
    }
  });

  // 3. conversation:join - Request to join a specific conversation room
  socket.on('conversation:join', async (payload, callback) => {
    try {
      const parsed = conversationIdParamSchema.safeParse({ id: payload?.conversationId });
      if (!parsed.success) {
        const errorMsg = 'Invalid conversation ID format';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('socket:error', { event: 'conversation:join', message: errorMsg });
        return;
      }

      const conversationId = parsed.data.id;

      // Verify that user is authorized to participate in this conversation
      await conversationService.getConversationById(conversationId, user);

      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);

      // Confirm join to client
      if (typeof callback === 'function') {
        callback({
          success: true,
          data: {
            conversationId,
            isCounterpartOnline: false, // can be evaluated
          },
        });
      }

      socket.emit('conversation:joined', { conversationId });
    } catch (error) {
      const errorMsg = error.message || 'Failed to join conversation';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('socket:error', { event: 'conversation:join', message: errorMsg });
    }
  });

  // 4. message:send - Send real-time message with idempotency
  socket.on('message:send', async (payload, callback) => {
    try {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        const errorMsg = parsed.error.errors.map((e) => e.message).join(', ');
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('socket:error', { event: 'message:send', message: errorMsg });
        return;
      }

      const { conversationId, clientMessageId, content } = parsed.data;

      // Persist in DB atomically before broadcasting
      const canonicalMessage = await messageService.sendMessage({
        conversationId,
        user,
        clientMessageId,
        content,
      });

      const roomName = `conversation:${conversationId}`;

      // Broadcast canonical persisted message to everyone in room (including recipient)
      io.to(roomName).emit('message:new', canonicalMessage);

      // Notify agents if unassigned conversation got a new customer message
      io.emit('conversation:activity', {
        conversationId,
        lastMessageAt: canonicalMessage.createdAt,
        content: canonicalMessage.content,
      });

      // Acknowledge sending client with canonical DB record
      if (typeof callback === 'function') {
        callback({
          success: true,
          data: { message: canonicalMessage },
        });
      }
    } catch (error) {
      const errorMsg = error.message || 'Failed to send message';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('socket:error', { event: 'message:send', message: errorMsg });
    }
  });

  // 5. message:delivered - Client confirms receipt of message
  socket.on('message:delivered', async (payload, callback) => {
    try {
      const parsed = messageIdSchema.safeParse(payload);
      if (!parsed.success) return;

      const { conversationId, messageId } = parsed.data;
      const updated = await messageService.markMessageDelivered(messageId);

      if (updated) {
        io.to(`conversation:${conversationId}`).emit('message:delivered', {
          conversationId,
          messageId,
          deliveredAt: updated.deliveredAt,
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error in message:delivered handler:', error);
    }
  });

  // 6. message:read - Recipient viewed the message(s)
  socket.on('message:read', async (payload, callback) => {
    try {
      const parsed = typingEventSchema.safeParse(payload); // validates conversationId
      if (!parsed.success) return;

      const { conversationId } = parsed.data;
      const updated = await messageService.markConversationAsRead(conversationId, user);

      if (updated && updated.length > 0) {
        io.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          readerId: user.id,
          readAt: new Date().toISOString(),
          messageIds: updated.map((m) => m.id),
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, count: updated?.length || 0 });
      }
    } catch (error) {
      console.error('Error in message:read handler:', error);
    }
  });

  // 7. typing:start & typing:stop indicators
  socket.on('typing:start', (payload) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) return;

    socket.to(`conversation:${parsed.data.conversationId}`).emit('typing:update', {
      conversationId: parsed.data.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: true,
    });
  });

  socket.on('typing:stop', (payload) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) return;

    socket.to(`conversation:${parsed.data.conversationId}`).emit('typing:update', {
      conversationId: parsed.data.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: false,
    });
  });

  // 8. Handle Disconnect
  socket.on('disconnect', () => {
    const becameOffline = presenceRegistry.removeSocket(user.id, socket.id);
    if (becameOffline) {
      io.emit('user:presence', {
        userId: user.id,
        status: 'offline',
      });
    }
  });
};
