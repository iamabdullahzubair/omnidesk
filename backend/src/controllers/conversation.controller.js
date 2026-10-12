import { conversationService } from '../services/conversation.service.js';

export const createConversation = async (req, res, next) => {
  try {
    const { initialMessage } = req.body;
    const conversation = await conversationService.createConversation(
      req.user.id,
      initialMessage
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('conversation:activity', {
        conversationId: conversation.id,
        lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await conversationService.getConversationById(id, req.user);
    res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const listConversations = async (req, res, next) => {
  try {
    const { type, status, page, limit } = req.query;
    const conversations = await conversationService.listConversations(req.user, {
      type,
      status,
      page,
      limit,
    });
    res.status(200).json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    next(error);
  }
};

export const claimConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await conversationService.claimConversation(id, req.user);

    const io = req.app.get('io');
    if (io) {
      io.emit('conversation:activity', {
        conversationId: id,
        assignedAgentId: req.user.id,
      });
    }

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConversationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const conversation = await conversationService.updateStatus(id, req.user, status);

    const io = req.app.get('io');
    if (io) {
      io.emit('conversation:activity', {
        conversationId: id,
        status,
      });
      io.to(`conversation:${id}`).emit('conversation:status_changed', {
        conversationId: id,
        status,
      });
    }

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};
