import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api } from '../services/api.js';
import { MessageItem } from '../components/MessageItem.jsx';
import { TypingDots } from '../components/TypingDots.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import {
  Send,
  ArrowLeft,
  Circle,
  AlertCircle,
  RefreshCw,
  Shield,
  User,
  CheckCircle,
  Lock,
} from 'lucide-react';

export const ChatPage = () => {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    socket,
    isConnected,
    isUserOnline,
    joinConversation,
    emitSendMessage,
    emitTypingStart,
    emitTypingStop,
    emitMessageDelivered,
    emitMessageRead,
  } = useSocket();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Map()); // Map<userId, userName>
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Initial Data Load via REST API
  const loadConversationData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [convRes, msgsRes] = await Promise.all([
        api.getConversation(conversationId),
        api.getMessages(conversationId, { limit: 100 }),
      ]);

      setConversation(convRes.conversation);
      setMessages(msgsRes.messages || []);

      // Mark messages as read upon loading
      await api.markAsRead(conversationId).catch(() => {});
      emitMessageRead(conversationId);
    } catch (err) {
      setError(err.message || 'Failed to load conversation details');
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  }, [conversationId, emitMessageRead]);

  useEffect(() => {
    loadConversationData();
  }, [loadConversationData]);

  // 2. Real-Time Socket Connection & Room Joins
  useEffect(() => {
    if (!conversationId) return;

    // Join conversation room
    joinConversation(conversationId).catch((err) => {
      console.warn('Socket join warning:', err.message);
    });

    if (!socket) return;

    // Listener for new messages broadcast
    const handleNewMessage = (newMsg) => {
      if (newMsg.conversationId !== conversationId) return;

      setMessages((prev) => {
        // Prevent duplicate if already reconciled via clientMessageId or id
        const exists = prev.some(
          (m) =>
            m.id === newMsg.id ||
            (m.clientMessageId && m.clientMessageId === newMsg.clientMessageId)
        );

        if (exists) {
          // Replace optimistic message with canonical server message
          return prev.map((m) =>
            m.clientMessageId === newMsg.clientMessageId ? newMsg : m
          );
        }

        return [...prev, newMsg];
      });

      // Acknowledge delivery if received by counterpart
      if (newMsg.senderId !== user.id) {
        emitMessageDelivered(conversationId, newMsg.id);
        emitMessageRead(conversationId);
      }

      setTimeout(() => scrollToBottom(), 50);
    };

    // Listener for delivery updates
    const handleDelivered = ({ messageId, deliveredAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deliveredAt: m.deliveredAt || deliveredAt } : m
        )
      );
    };

    // Listener for read receipts
    const handleRead = ({ readerId, readAt, messageIds }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId !== readerId) {
            if (!messageIds || messageIds.includes(m.id)) {
              return { ...m, readAt: m.readAt || readAt };
            }
          }
          return m;
        })
      );
    };

    // Listener for typing updates
    const handleTyping = ({ conversationId: cId, userId, userName, isTyping }) => {
      if (cId !== conversationId || userId === user.id) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(userId, userName);
        } else {
          next.delete(userId);
        }
        return next;
      });
    };

    // Listener for conversation updates (e.g. status changes, agent assigned)
    const handleConversationUpdated = (updated) => {
      if (updated.id === conversationId) {
        setConversation((prev) => ({ ...prev, ...updated }));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:read', handleRead);
    socket.on('typing:update', handleTyping);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:read', handleRead);
      socket.off('typing:update', handleTyping);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [
    socket,
    conversationId,
    user.id,
    joinConversation,
    emitMessageDelivered,
    emitMessageRead,
  ]);

  // 3. Message submission with optimistic UI update
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = inputValue.trim();
    if (!content || isSending) return;

    if (conversation?.status === 'closed') {
      alert('This conversation is closed.');
      return;
    }

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage = {
      id: `temp-${clientMessageId}`,
      conversationId,
      senderId: user.id,
      clientMessageId,
      content,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      sender: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    };

    // Append optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue('');
    emitTypingStop(conversationId);
    setTimeout(() => scrollToBottom(), 50);

    setIsSending(true);

    try {
      if (isConnected) {
        // Send via Socket.IO with acknowledgment
        const canonicalMessage = await emitSendMessage(
          conversationId,
          content,
          clientMessageId
        );

        // Reconcile optimistic message
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? canonicalMessage : m
          )
        );
      } else {
        // Fallback to REST API if Socket is temporarily disconnected
        const res = await api.sendMessage(conversationId, content, clientMessageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? res.message : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark optimistic message with failure indication
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, isOptimistic: false, failed: true }
            : m
        )
      );
      setError(err.message || 'Failed to deliver message.');
    } finally {
      setIsSending(false);
    }
  };

  // 4. Typing indicator debounce
  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    emitTypingStart(conversationId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId);
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Status transitions
  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.updateConversationStatus(conversationId, newStatus);
      setConversation(res.conversation);
    } catch (err) {
      setError(err.message || 'Failed to update conversation status');
    }
  };

  // Determine counterpart info & online presence
  const counterpart =
    user.role === 'customer' ? conversation?.assignedAgent : conversation?.customer;

  const isCounterpartOnline = counterpart ? isUserOnline(counterpart.id) : false;

  const backPath = user.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard';

  return (
    <div
      className="main-content"
      style={{
        maxWidth: '1000px',
        height: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.5rem',
          borderRadius: '16px 16px 0 0',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate(backPath)}
            className="btn-secondary"
            style={{ padding: '0.5rem', borderRadius: '50%' }}
            title="Return to dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {counterpart ? counterpart.name : 'Waiting for Support Agent...'}
              </h2>
              {conversation && <StatusBadge status={conversation.status} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', fontSize: '0.775rem' }}>
              {counterpart && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Circle
                    size={8}
                    fill={isCounterpartOnline ? '#10b981' : '#64748b'}
                    color={isCounterpartOnline ? '#10b981' : '#64748b'}
                  />
                  <span style={{ color: isCounterpartOnline ? '#34d399' : '#94a3b8' }}>
                    {isCounterpartOnline ? 'Online now' : 'Offline'}
                  </span>
                </div>
              )}
              <span style={{ color: '#64748b' }}>
                Ticket #{conversationId?.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Actions */}
        {conversation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {conversation.status === 'open' ? (
              <button
                onClick={() => handleStatusChange('resolved')}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#38bdf8' }}
              >
                <CheckCircle size={14} />
                <span>Mark Resolved</span>
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('open')}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#34d399' }}
              >
                <RefreshCw size={14} />
                <span>Reopen Ticket</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Offline Alert Banner */}
      {!isConnected && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '0.6rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.825rem',
            color: '#fca5a5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>Real-time connection interrupted. Messages will sync automatically upon reconnection.</span>
          </div>
          <button
            onClick={loadConversationData}
            style={{ color: '#fff', textDecoration: 'underline', fontSize: '0.775rem' }}
          >
            Refresh Now
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          backgroundColor: 'rgba(11, 15, 25, 0.6)',
          backdropFilter: 'blur(12px)',
          borderLeft: '1px solid var(--border-subtle)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s infinite linear', margin: '0 auto 1rem auto' }} />
            Loading conversation history...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <User size={22} color="#818cf8" />
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9' }}>
              Conversation initiated
            </p>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.25rem' }}>
              Send a message below to start chatting in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id || msg.clientMessageId}
              message={msg}
              isCurrentUser={msg.senderId === user.id}
            />
          ))
        )}

        {/* Active typing indicators */}
        {typingUsers.size > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {Array.from(typingUsers.entries()).map(([uId, uName]) => (
              <TypingDots key={uId} userName={uName} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.5rem',
          borderRadius: '0 0 16px 16px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {conversation?.status === 'closed' ? (
          <div
            style={{
              textAlign: 'center',
              padding: '0.75rem',
              color: '#94a3b8',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Lock size={16} />
            <span>This conversation is closed. Reopen it to resume messaging.</span>
          </div>
        ) : (
          <form
            onSubmit={handleSendMessage}
            style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}
          >
            <textarea
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply... (Press Enter to send, Shift+Enter for new line)"
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                lineHeight: '1.4',
              }}
            />

            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="btn-primary"
              style={{
                height: '46px',
                padding: '0 1.25rem',
                borderRadius: '12px',
                flexShrink: 0,
              }}
              title="Send message"
            >
              <Send size={16} />
              <span>Send</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
