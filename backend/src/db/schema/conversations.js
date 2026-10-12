import { pgTable, uuid, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const conversationStatusEnum = pgEnum('conversation_status', ['open', 'resolved', 'closed']);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
    status: conversationStatusEnum('status').notNull().default('open'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_conversations_customer').on(table.customerId),
    index('idx_conversations_agent_status').on(table.assignedAgentId, table.status),
    index('idx_conversations_status').on(table.status),
  ]
);
