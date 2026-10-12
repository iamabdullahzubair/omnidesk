import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { MessageSquare, LogOut, Radio, User, Shield } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dashboardPath = user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard';

  return (
    <header
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(9, 13, 22, 0.8)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0.875rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand */}
        <Link
          to={user ? dashboardPath : '/login'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}
          >
            <MessageSquare size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#fff' }}>
              Omni<span style={{ color: '#818cf8' }}>Desk</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Real-Time Support
            </div>
          </div>
        </Link>

        {/* User state and actions */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Live WebSocket Status Indicator */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                color: isConnected ? '#34d399' : '#f87171',
              }}
              title={isConnected ? 'Real-Time WebSocket Connected' : 'Reconnecting to WebSocket...'}
            >
              <Radio
                size={12}
                style={{
                  animation: isConnected ? 'pulseGlow 2s infinite' : 'none',
                }}
              />
              <span>{isConnected ? 'Socket Live' : 'Reconnecting...'}</span>
            </div>

            {/* Profile Info & Role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {user.role === 'agent' ? <Shield size={16} color="#818cf8" /> : <User size={16} color="#94a3b8" />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                  {user.name}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: user.role === 'agent' ? '#818cf8' : '#94a3b8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {user.role}
                </span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
              }}
              title="Sign out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
