import { eq, and, ne, isNull, asc, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { messages } from '../db/schema/messages.js';

export class MessageRepository {
  /**
   * Idempotent message insertion.
   * If a message with (senderId, clientMessageId) already exists (e.g. on client network retry),
   * it gracefully retrieves and returns the canonical existing record.
   */
  async create({ conversationId, senderId, clientMessageId, content }, tx = null) {
    const client = tx || db;

    try {
      const [newMessage] = await client
        .insert(messages)
        .values({
          conversationId,
          senderId,
          clientMessageId,
          content,
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientMessageId],
        })
        .returning();

      if (newMessage) {
        return newMessage;
      }

      // Conflict occurred: fetch and return existing canonical message
      const [existingMessage] = await client
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.senderId, senderId),
            eq(messages.clientMessageId, clientMessageId)
          )
        )
        .limit(1);

      return existingMessage;
    } catch (error) {
      // In case table-level unique constraint triggers
      if (error.code === '23505') {
        const [existing] = await client
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.senderId, senderId),
              eq(messages.clientMessageId, clientMessageId)
            )
          )
          .limit(1);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findById(id) {
    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    return msg || null;
  }

  async findByConversation(conversationId, { limit = 50, cursor = null } = {}) {
    const conditions = [eq(messages.conversationId, conversationId)];

    if (cursor) {
      // Cursor pagination based on createdAt instant
      conditions.push(lt(messages.createdAt, new Date(cursor)));
    }

    const rows = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [asc(messages.createdAt), asc(messages.id)],
      limit,
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return rows;
  }

  async markAsDelivered(messageId, deliveredAt = new Date()) {
    const [updated] = await db
      .update(messages)
      .set({
        deliveredAt: sql`COALESCE(${messages.deliveredAt}, ${deliveredAt})`,
      })
      .where(eq(messages.id, messageId))
      .returning();

    return updated || null;
  }

  async markAsRead(messageId, readAt = new Date()) {
    const [updated] = await db
      .update(messages)
      .set({
        readAt: sql`COALESCE(${messages.readAt}, ${readAt})`,
        deliveredAt: sql`COALESCE(${messages.deliveredAt}, ${readAt})`,
      })
      .where(eq(messages.id, messageId))
      .returning();

    return updated || null;
  }

  /**
   * Bulk mark incoming messages in a conversation as read by the other participant
   */
  async markConversationMessagesRead(conversationId, readerId, readAt = new Date()) {
    return db
      .update(messages)
      .set({
        readAt: sql`COALESCE(${messages.readAt}, ${readAt})`,
        deliveredAt: sql`COALESCE(${messages.deliveredAt}, ${readAt})`,
      })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, readerId),
          isNull(messages.readAt)
        )
      )
      .returning();
  }
}

export const messageRepository = new MessageRepository();
