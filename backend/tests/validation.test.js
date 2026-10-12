import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../src/validators/auth.validator.js';
import { sendMessageSchema } from '../src/validators/message.validator.js';
import { updateStatusSchema } from '../src/validators/conversation.validator.js';

describe('Validation Schemas (Zod)', () => {
  describe('Auth Validation', () => {
    it('validates customer registration successfully', () => {
      const valid = {
        name: 'Alice Support',
        email: 'alice@example.com',
        password: 'Password123!',
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('alice@example.com');
      }
    });

    it('rejects public registration attempting to set agent role', () => {
      const invalid = {
        name: 'Evil Agent',
        email: 'evil@example.com',
        password: 'Password123!',
        role: 'agent',
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('Agent accounts cannot be created');
    });

    it('rejects passwords shorter than 8 characters', () => {
      const invalid = {
        name: 'Short Pass',
        email: 'short@example.com',
        password: 'short',
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('normalizes email to lowercase and trims whitespace', () => {
      const input = {
        name: 'Spacey',
        email: '   UPPERCASE@EXAMPLE.COM   ',
        password: 'Password123!',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('uppercase@example.com');
      }
    });
  });

  describe('Message Validation', () => {
    it('rejects empty message content', () => {
      const invalid = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        clientMessageId: 'msg-123',
        content: '   ',
      };
      const result = sendMessageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects content exceeding 2000 characters', () => {
      const invalid = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        clientMessageId: 'msg-123',
        content: 'a'.repeat(2001),
      };
      const result = sendMessageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('accepts valid message with UUID and clientMessageId', () => {
      const valid = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        clientMessageId: 'client-id-uuid-123',
        content: 'Hello, I need help with billing.',
      };
      const result = sendMessageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('Conversation Status Validation', () => {
    it('accepts allowed status transitions', () => {
      expect(updateStatusSchema.safeParse({ status: 'open' }).success).toBe(true);
      expect(updateStatusSchema.safeParse({ status: 'resolved' }).success).toBe(true);
      expect(updateStatusSchema.safeParse({ status: 'closed' }).success).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(updateStatusSchema.safeParse({ status: 'pending' }).success).toBe(false);
      expect(updateStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false);
    });
  });
});
