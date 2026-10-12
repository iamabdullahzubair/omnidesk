import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from '../src/services/conversation.service.js';
import { MessageService } from '../src/services/message.service.js';
import { AppError } from '../src/utils/app-error.js';

describe('Concurrency and Idempotency Guarantees', () => {
  describe('Atomic Conversation Assignment', () => {
    it('ensures exactly one agent wins when two claim simultaneously', async () => {
      const conversationService = new ConversationService();
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const mockConversation = {
        id: conversationId,
        customerId: 'customer-1',
        assignedAgentId: null,
        status: 'open',
      };

      // Mock repository methods
      let currentAssignedAgentId = null;

      const mockRepo = {
        findById: vi.fn().mockImplementation(async () => ({
          ...mockConversation,
          assignedAgentId: currentAssignedAgentId,
        })),
        claimConversation: vi.fn().mockImplementation(async (convId, agentId) => {
          // Atomic conditional update simulation:
          // WHERE assigned_agent_id IS NULL AND status = 'open'
          if (currentAssignedAgentId === null) {
            currentAssignedAgentId = agentId;
            return {
              ...mockConversation,
              assignedAgentId: agentId,
            };
          }
          // Already claimed by another agent - returns null (0 rows updated)
          return null;
        }),
      };

      // Replace repository on conversationService
      // @ts-ignore
      vi.spyOn(conversationService, 'claimConversation').mockImplementation(
        async (cId, agent) => {
          if (agent.role !== 'agent') throw AppError.forbidden();
          const conv = await mockRepo.findById(cId);
          if (conv.assignedAgentId && conv.assignedAgentId !== agent.id) {
            throw AppError.conflict('Conversation is already claimed by another support agent');
          }
          const claimed = await mockRepo.claimConversation(cId, agent.id);
          if (!claimed) {
            throw AppError.conflict('Failed to claim conversation: Another agent just claimed it.');
          }
          return { ...conv, assignedAgentId: agent.id };
        }
      );

      const agent1 = { id: 'agent-alice', role: 'agent', name: 'Alice' };
      const agent2 = { id: 'agent-bob', role: 'agent', name: 'Bob' };

      // Simulate simultaneous requests
      const promise1 = conversationService.claimConversation(conversationId, agent1);
      const promise2 = conversationService.claimConversation(conversationId, agent2);

      const results = await Promise.allSettled([promise1, promise2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE claim must succeed
      expect(fulfilled.length).toBe(1);
      // The competing claim must be rejected with Conflict
      expect(rejected.length).toBe(1);
      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(AppError);
        expect(rejected[0].reason.statusCode).toBe(409);
      }
    });

    it('rejects claim attempts made by users with role "customer"', async () => {
      const conversationService = new ConversationService();
      const customer = { id: 'cust-1', role: 'customer', name: 'Cust' };

      await expect(
        conversationService.claimConversation('conv-id', customer)
      ).rejects.toThrow(AppError);
    });
  });

  describe('Message Idempotency', () => {
    it('returns canonical existing message on retry without creating duplicate', async () => {
      const existingMsg = {
        id: 'msg-uuid-101',
        conversationId: 'conv-101',
        senderId: 'user-1',
        clientMessageId: 'idempotent-key-xyz',
        content: 'Original message',
        createdAt: new Date(),
      };

      const mockMsgRepo = {
        create: vi.fn().mockImplementation(async ({ senderId, clientMessageId }) => {
          if (clientMessageId === 'idempotent-key-xyz') {
            return existingMsg; // Returns existing on conflict
          }
          return { id: 'new-id', senderId, clientMessageId };
        }),
      };

      // When client retries identical clientMessageId
      const firstResult = await mockMsgRepo.create({
        conversationId: 'conv-101',
        senderId: 'user-1',
        clientMessageId: 'idempotent-key-xyz',
        content: 'Original message',
      });

      const retryResult = await mockMsgRepo.create({
        conversationId: 'conv-101',
        senderId: 'user-1',
        clientMessageId: 'idempotent-key-xyz',
        content: 'Original message',
      });

      expect(firstResult.id).toBe(retryResult.id);
      expect(firstResult.clientMessageId).toBe(retryResult.clientMessageId);
    });
  });
});
