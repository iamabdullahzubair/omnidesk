import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { conversations } from '../db/schema/conversations.js';
import { users } from '../db/schema/users.js';
import { messages } from '../db/schema/messages.js';

export class ConversationRepository {
  async create({ customerId }) {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        customerId,
        status: 'open',
      })
      .returning();
    return newConversation;
  }

  async findById(id) {
    const result = await db.query.conversations.findFirst({
      where: eq(conversations.id, id),
      with: {
        customer: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        assignedAgent: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
    return result || null;
  }

  async findForCustomer(customerId, { status = 'all', limit = 20, offset = 0 } = {}) {
    const conditions = [eq(conversations.customerId, customerId)];
    if (status && status !== 'all') {
      conditions.push(eq(conversations.status, status));
    }

    return db.query.conversations.findMany({
      where: and(...conditions),
      orderBy: [desc(conversations.updatedAt)],
      limit,
      offset,
      with: {
        customer: {
          columns: { id: true, name: true, email: true, role: true },
        },
        assignedAgent: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async findForAgent(agentId, { status = 'all', limit = 20, offset = 0 } = {}) {
    const conditions = [eq(conversations.assignedAgentId, agentId)];
    if (status && status !== 'all') {
      conditions.push(eq(conversations.status, status));
    }

    return db.query.conversations.findMany({
      where: and(...conditions),
      orderBy: [desc(conversations.updatedAt)],
      limit,
      offset,
      with: {
        customer: {
          columns: { id: true, name: true, email: true, role: true },
        },
        assignedAgent: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async findUnassigned({ limit = 20, offset = 0 } = {}) {
    return db.query.conversations.findMany({
      where: and(isNull(conversations.assignedAgentId), eq(conversations.status, 'open')),
      orderBy: [desc(conversations.createdAt)],
      limit,
      offset,
      with: {
        customer: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Atomic conditional update to claim a conversation.
   * Solves race conditions between two concurrent agents claiming the same conversation.
   */
  async claimConversation(conversationId, agentId, tx = null) {
    const client = tx || db;
    const [claimed] = await client
      .update(conversations)
      .set({
        assignedAgentId: agentId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          isNull(conversations.assignedAgentId),
          eq(conversations.status, 'open')
        )
      )
      .returning();

    return claimed || null;
  }

  async updateStatus(conversationId, status, tx = null) {
    const client = tx || db;
    const [updated] = await client
      .update(conversations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  async updateLastMessageAt(conversationId, timestamp = new Date(), tx = null) {
    const client = tx || db;
    const [updated] = await client
      .update(conversations)
      .set({
        lastMessageAt: timestamp,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }
}

export const conversationRepository = new ConversationRepository();
