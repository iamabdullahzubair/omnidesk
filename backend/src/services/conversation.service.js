import crypto from 'crypto';
import { db } from '../db/index.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { AppError } from '../utils/app-error.js';

export class ConversationService {
  async createConversation(customerId, initialMessage = null) {
    return db.transaction(async (tx) => {
      const conv = await conversationRepository.create({ customerId }, tx);

      let firstMessage = null;
      if (initialMessage && initialMessage.trim().length > 0) {
        const clientMessageId = crypto.randomUUID();
        firstMessage = await messageRepository.create(
          {
            conversationId: conv.id,
            senderId: customerId,
            clientMessageId,
            content: initialMessage.trim(),
          },
          tx
        );

        await conversationRepository.updateLastMessageAt(conv.id, firstMessage.createdAt, tx);
      }

      const fullConv = await conversationRepository.findById(conv.id);
      return {
        ...fullConv,
        initialMessage: firstMessage,
      };
    });
  }

  async getConversationById(conversationId, user) {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    // Role-based authorization check
    if (user.role === 'customer') {
      if (conv.customerId !== user.id) {
        throw AppError.forbidden('You are not authorized to access this conversation');
      }
    } else if (user.role === 'agent') {
      // Agents can view assigned conversations or unassigned open conversations
      const isAssignedToAgent = conv.assignedAgentId === user.id;
      const isUnassigned = !conv.assignedAgentId;

      if (!isAssignedToAgent && !isUnassigned) {
        throw AppError.forbidden(
          'This conversation is assigned to another agent. Access is restricted.'
        );
      }
    }

    return conv;
  }

  async listConversations(user, { type = 'assigned', status = 'all', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    if (user.role === 'customer') {
      return conversationRepository.findForCustomer(user.id, { status, limit, offset });
    }

    // Agent role
    if (type === 'unassigned') {
      return conversationRepository.findUnassigned({ limit, offset });
    }

    return conversationRepository.findForAgent(user.id, { status, limit, offset });
  }

  /**
   * Atomic Claim:
   * Only succeeds if the conversation is still 'open' and assignedAgentId IS NULL.
   * If two agents call claimConversation concurrently, exactly one will update the row and succeed.
   * The other will receive an AppError.conflict (HTTP 409).
   */
  async claimConversation(conversationId, agentUser) {
    if (agentUser.role !== 'agent') {
      throw AppError.forbidden('Only support agents can claim conversations');
    }

    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    if (conv.status !== 'open') {
      throw AppError.badRequest(`Cannot claim a conversation with status '${conv.status}'`);
    }

    if (conv.assignedAgentId === agentUser.id) {
      // Already claimed by this agent
      return conv;
    }

    if (conv.assignedAgentId) {
      throw AppError.conflict('Conversation is already claimed by another support agent');
    }

    // Atomic conditional update at database level
    const claimed = await conversationRepository.claimConversation(conversationId, agentUser.id);
    if (!claimed) {
      throw AppError.conflict(
        'Failed to claim conversation: Another agent just claimed it or it is no longer open.'
      );
    }

    return conversationRepository.findById(conversationId);
  }

  async updateStatus(conversationId, user, newStatus) {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv) {
      throw AppError.notFound('Conversation not found');
    }

    // Authorization
    if (user.role === 'customer') {
      if (conv.customerId !== user.id) {
        throw AppError.forbidden('You can only update the status of your own conversations');
      }
      // Customer can resolve or close their own conversation
      if (!['resolved', 'closed', 'open'].includes(newStatus)) {
        throw AppError.badRequest('Invalid status transition');
      }
    } else if (user.role === 'agent') {
      if (conv.assignedAgentId !== user.id) {
        throw AppError.forbidden('Only the assigned agent can update the status of this conversation');
      }
    }

    await conversationRepository.updateStatus(conversationId, newStatus);
    return conversationRepository.findById(conversationId);
  }
}

export const conversationService = new ConversationService();
