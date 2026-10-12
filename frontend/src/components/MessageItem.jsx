import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

export const MessageItem = ({ message, isCurrentUser }) => {
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatus = () => {
    if (!isCurrentUser) return null;

    if (message.isOptimistic) {
      return <Clock size={13} color="#94a3b8" title="Sending..." />;
    }

    if (message.readAt) {
      return (
        <CheckCheck
          size={14}
          color="#38bdf8"
          title={`Read at ${formatTime(message.readAt)}`}
        />
      );
    }

    if (message.deliveredAt) {
      return (
        <CheckCheck
          size={14}
          color="#94a3b8"
          title={`Delivered at ${formatTime(message.deliveredAt)}`}
        />
      );
    }

    return <Check size={14} color="#94a3b8" title="Sent to server" />;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
        marginBottom: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {!isCurrentUser && message.sender && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '4px',
            marginLeft: '8px',
            fontWeight: '500',
          }}
        >
          {message.sender.name} {message.sender.role === 'agent' && '(Support)'}
        </div>
      )}

      <div
        style={{
          maxWidth: '75%',
          padding: '0.75rem 1rem',
          borderRadius: isCurrentUser
            ? '16px 16px 4px 16px'
            : '16px 16px 16px 4px',
          background: isCurrentUser
            ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
            : 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(10px)',
          border: isCurrentUser
            ? '1px solid rgba(255, 255, 255, 0.15)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          color: '#f8fafc',
          boxShadow: isCurrentUser
            ? '0 4px 14px rgba(79, 70, 229, 0.25)'
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.45',
          fontSize: '0.925rem',
        }}
      >
        {message.content}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            marginTop: '4px',
            fontSize: '0.7rem',
            color: isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
          }}
        >
          <span>{formatTime(message.createdAt)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
};
