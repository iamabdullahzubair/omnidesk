import { z } from 'zod';

export const conversationIdParamSchema = z.object({
  id: z.string().uuid('Invalid conversation UUID format'),
});

export const createConversationSchema = z.object({
  initialMessage: z.string().trim().max(2000, 'Initial message cannot exceed 2000 characters').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'closed'], {
    errorMap: () => ({ message: "Status must be 'open', 'resolved', or 'closed'" }),
  }),
});

export const listConversationsQuerySchema = z.object({
  type: z.enum(['unassigned', 'assigned']).optional().default('assigned'),
  status: z.enum(['open', 'resolved', 'closed', 'all']).optional().default('all'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
