import { Router } from 'express';
import {
  createConversation,
  getConversationById,
  listConversations,
  claimConversation,
  updateConversationStatus,
} from '../controllers/conversation.controller.js';
import { authenticateUser, requireRole } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.middleware.js';
import {
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  updateStatusSchema,
} from '../validators/conversation.validator.js';

const router = Router();

// Create new support conversation (customer only)
router.post(
  '/',
  authenticateUser,
  requireRole('customer'),
  validateBody(createConversationSchema),
  createConversation
);

// List authorized conversations (with query filters)
router.get(
  '/',
  authenticateUser,
  validateQuery(listConversationsQuerySchema),
  listConversations
);

// Get single conversation details
router.get(
  '/:id',
  authenticateUser,
  validateParams(conversationIdParamSchema),
  getConversationById
);

// Claim an unassigned conversation (agents only)
router.patch(
  '/:id/assign',
  authenticateUser,
  requireRole('agent'),
  validateParams(conversationIdParamSchema),
  claimConversation
);

// Update status (open/resolved/closed)
router.patch(
  '/:id/status',
  authenticateUser,
  validateParams(conversationIdParamSchema),
  validateBody(updateStatusSchema),
  updateConversationStatus
);

export default router;
