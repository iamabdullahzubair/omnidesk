import { db } from '../db/index.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';

export class MessageService {
  async sendMessage({ conversationId, user, clientMessageId, content }) {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    if (conv.status === 'closed') {
      throw AppError.badRequest('This conversation is closed. Reopen it before sending new messages.');
    }

    // Authorization check: sender must be the customer or assigned agent
    const isCustomer = user.role === 'customer' && conv.customerId === user.id;
    const isAssignedAgent = user.role === 'agent' && conv.assignedAgentId === user.id;

    if (!isCustomer && !isAssignedAgent) {
      throw AppError.forbidden('You are not authorized to send messages in this conversation');
    }

    // Atomic transaction: Insert message + update conversation lastMessageAt
    const createdMessage = await db.transaction(async (tx) => {
      const msg = await messageRepository.create(
        {
          conversationId,
          senderId: user.id,
          clientMessageId,
          content: content.trim(),
        },
        tx
      );

      await conversationRepository.updateLastMessageAt(conversationId, msg.createdAt, tx);
      return msg;
    });

    const sender = await userRepository.findById(user.id);

    return {
      ...createdMessage,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email,
        role: sender.role,
      },
    };
  }

  async getMessages(conversationId, user, { limit = 50, cursor = null } = {}) {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    // Authorization check
    if (user.role === 'customer' && conv.customerId !== user.id) {
      throw AppError.forbidden('You do not have permission to view messages in this conversation');
    }

    if (user.role === 'agent') {
      const isAssigned = conv.assignedAgentId === user.id;
      const isUnassigned = !conv.assignedAgentId;
      if (!isAssigned && !isUnassigned) {
        throw AppError.forbidden('You do not have permission to view messages in this conversation');
      }
    }

    const messages = await messageRepository.findByConversation(conversationId, { limit, cursor });

    const nextCursor =
      messages.length === limit && messages.length > 0
        ? messages[0].createdAt.toISOString()
        : null;

    return {
      messages,
      nextCursor,
    };
  }

  async markMessageDelivered(messageId) {
    return messageRepository.markAsDelivered(messageId);
  }

  async markConversationAsRead(conversationId, user) {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    // Mark messages where sender != user.id
    const updatedMessages = await messageRepository.markConversationMessagesRead(
      conversationId,
      user.id
    );

    return updatedMessages;
  }
}

export const messageService = new MessageService();
