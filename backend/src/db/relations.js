import { relations } from 'drizzle-orm';
import { users } from './schema/users.js';
import { conversations } from './schema/conversations.js';
import { messages } from './schema/messages.js';

export const usersRelations = relations(users, ({ many }) => ({
  customerConversations: many(conversations, { relationName: 'customerConversations' }),
  assignedConversations: many(conversations, { relationName: 'assignedConversations' }),
  messages: many(messages),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  customer: one(users, {
    fields: [conversations.customerId],
    references: [users.id],
    relationName: 'customerConversations',
  }),
  assignedAgent: one(users, {
    fields: [conversations.assignedAgentId],
    references: [users.id],
    relationName: 'assignedConversations',
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));
