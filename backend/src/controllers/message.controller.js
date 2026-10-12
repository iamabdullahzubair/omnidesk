import { messageService } from '../services/message.service.js';

export const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cursor, limit } = req.query;
    const result = await messageService.getMessages(id, req.user, { cursor, limit });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { clientMessageId, content } = req.body;

    const message = await messageService.sendMessage({
      conversationId: id,
      user: req.user,
      clientMessageId,
      content,
    });

    // Broadcast to room via attached Socket.IO instance if available
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${id}`).emit('message:new', message);
    }

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedMessages = await messageService.markConversationAsRead(id, req.user);

    const io = req.app.get('io');
    if (io && updatedMessages.length > 0) {
      io.to(`conversation:${id}`).emit('message:read', {
        conversationId: id,
        readerId: req.user.id,
        readAt: new Date().toISOString(),
        messageIds: updatedMessages.map((m) => m.id),
      });
    }

    res.status(200).json({
      success: true,
      data: { updatedCount: updatedMessages.length },
    });
  } catch (error) {
    next(error);
  }
};
