import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [connectionError, setConnectionError] = useState(null);

  // Initialize and tear down single shared Socket.IO instance
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated on the server, you need to reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      setConnectionError(err.message || 'WebSocket connection error');
    });

    // Global presence updates
    socket.on('user:presence', ({ userId, status }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'online') {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  // Helper method: query online status of a user
  const isUserOnline = useCallback(
    (userId) => onlineUsers.has(userId),
    [onlineUsers]
  );

  // Helper method: join conversation with acknowledgment
  const joinConversation = useCallback((conversationId) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        return resolve({ success: false, offline: true });
      }

      socketRef.current.emit('conversation:join', { conversationId }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to join conversation room'));
        }
      });
    });
  }, []);

  // Helper method: send message with acknowledgment callback
  const emitSendMessage = useCallback((conversationId, content, clientMessageId) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        return reject(new Error('Socket is disconnected. Message cannot be sent in real-time.'));
      }

      socketRef.current.emit(
        'message:send',
        { conversationId, content, clientMessageId },
        (response) => {
          if (response?.success) {
            resolve(response.data.message);
          } else {
            reject(new Error(response?.error || 'Failed to send message'));
          }
        }
      );
    });
  }, []);

  const emitTypingStart = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { conversationId });
    }
  }, []);

  const emitTypingStop = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', { conversationId });
    }
  }, []);

  const emitMessageDelivered = useCallback((conversationId, messageId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:delivered', { conversationId, messageId });
    }
  }, []);

  const emitMessageRead = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:read', { conversationId });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        connectionError,
        isUserOnline,
        joinConversation,
        emitSendMessage,
        emitTypingStart,
        emitTypingStop,
        emitMessageDelivered,
        emitMessageRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
