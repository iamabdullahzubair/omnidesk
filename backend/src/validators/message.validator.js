import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation UUID format'),
  clientMessageId: z
    .string()
    .trim()
    .min(1, 'clientMessageId is required')
    .max(64, 'clientMessageId cannot exceed 64 characters'),
  content: z
    .string()
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(2000, 'Message content cannot exceed 2000 characters'),
});

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const messageIdSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation UUID format'),
  messageId: z.string().uuid('Invalid message UUID format'),
});

export const typingEventSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation UUID format'),
});
