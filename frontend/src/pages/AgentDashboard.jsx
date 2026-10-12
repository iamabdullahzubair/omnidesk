import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Shield, Inbox, CheckCircle2, User, Clock, ArrowRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export const AgentDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'assigned'
  const [unassignedList, setUnassignedList] = useState([]);
  const [assignedList, setAssignedList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [unassignedRes, assignedRes] = await Promise.all([
        api.getConversations({ type: 'unassigned' }),
        api.getConversations({ type: 'assigned' }),
      ]);
      setUnassignedList(unassignedRes.conversations || []);
      setAssignedList(assignedRes.conversations || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch agent queues');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Live Socket listener for queue activity
  useEffect(() => {
    if (!socket) return;

    const handleActivity = () => {
      fetchDashboardData();
    };

    socket.on('conversation:activity', handleActivity);
    return () => {
      socket.off('conversation:activity', handleActivity);
    };
  }, [socket, fetchDashboardData]);

  // Atomic claim handler
  const handleClaim = async (e, conversationId) => {
    e.stopPropagation();
    setClaimingId(conversationId);
    setError(null);

    try {
      const response = await api.claimConversation(conversationId);
      // Success: move to conversation chat
      navigate(`/agent/conversations/${conversationId}`);
    } catch (err) {
      // Handles 409 Conflict if another agent raced and claimed it first!
      setError(err.message || 'Failed to claim conversation');
      // Refresh queues to reflect updated state
      fetchDashboardData();
    } finally {
      setClaimingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentList = activeTab === 'unassigned' ? unassignedList : assignedList;

  return (
    <div className="main-content" style={{ maxWidth: '1100px' }}>
      {/* Agent Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(79, 70, 229, 0.35)',
            }}
          >
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Agent Support Console
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Logged in as <strong style={{ color: '#c7d2fe' }}>{user?.name}</strong> • Real-Time Ticket Routing
            </p>
          </div>
        </div>

        <button
          onClick={fetchDashboardData}
          className="btn-secondary"
          style={{ padding: '0.65rem 1rem' }}
        >
          <RefreshCw size={14} />
          <span>Sync Queues</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '1rem',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#fca5a5',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Queue Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('unassigned')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            fontWeight: 700,
            background: activeTab === 'unassigned' ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'unassigned' ? '#fff' : '#94a3b8',
            border: activeTab === 'unassigned' ? 'none' : '1px solid var(--border-subtle)',
            transition: 'var(--transition)',
          }}
        >
          <Inbox size={16} />
          <span>Available Unassigned</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'unassigned' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {unassignedList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assigned')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            fontWeight: 700,
            background: activeTab === 'assigned' ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'assigned' ? '#fff' : '#94a3b8',
            border: activeTab === 'assigned' ? 'none' : '1px solid var(--border-subtle)',
            transition: 'var(--transition)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>My Assigned Chats</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'assigned' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {assignedList.length}
          </span>
        </button>
      </div>

      {/* Conversations Container */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                margin: '0 auto 1rem auto',
                animation: 'pulseGlow 1s infinite linear',
              }}
            />
            Loading queue conversations...
          </div>
        ) : currentList.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Inbox size={24} color="#818cf8" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>
              {activeTab === 'unassigned' ? 'Queue is clear!' : 'No chats assigned to you'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: '380px', margin: '0 auto' }}>
              {activeTab === 'unassigned'
                ? 'All incoming customer tickets have been claimed by agents.'
                : 'Claim an available ticket from the unassigned queue to start helping customers.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {currentList.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  if (activeTab === 'assigned') {
                    navigate(`/agent/conversations/${conv.id}`);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: activeTab === 'assigned' ? 'pointer' : 'default',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab === 'assigned') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab === 'assigned') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={20} color="#818cf8" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        Customer: {conv.customer?.name || 'Customer'}
                      </span>
                      <StatusBadge status={conv.status} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Email: <span style={{ color: '#cbd5e1' }}>{conv.customer?.email}</span> • ID: #{conv.id.slice(0, 8)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.775rem' }}>
                    <Clock size={12} />
                    <span>{formatDate(conv.lastMessageAt || conv.createdAt)}</span>
                  </div>

                  {activeTab === 'unassigned' ? (
                    <button
                      onClick={(e) => handleClaim(e, conv.id)}
                      disabled={claimingId === conv.id}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1rem', fontSize: '0.825rem' }}
                      title="Claim this conversation atomically"
                    >
                      <Sparkles size={14} />
                      <span>{claimingId === conv.id ? 'Claiming...' : 'Claim Conversation'}</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      <ArrowRight size={14} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
