import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  markAsRead,
} from '../controllers/message.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.middleware.js';
import { conversationIdParamSchema } from '../validators/conversation.validator.js';
import {
  sendMessageSchema,
  listMessagesQuerySchema,
} from '../validators/message.validator.js';

const router = Router();

// Get chronological messages for a conversation
router.get(
  '/:id/messages',
  authenticateUser,
  validateParams(conversationIdParamSchema),
  validateQuery(listMessagesQuerySchema),
  getMessages
);

// Send message via REST API
router.post(
  '/:id/messages',
  authenticateUser,
  validateParams(conversationIdParamSchema),
  validateBody(sendMessageSchema.omit({ conversationId: true })),
  sendMessage
);

// Mark conversation messages as read
router.patch(
  '/:id/messages/read',
  authenticateUser,
  validateParams(conversationIdParamSchema),
  markAsRead
);

export default router;
