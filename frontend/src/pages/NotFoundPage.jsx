import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  const { user } = useAuth();
  const homePath = user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '480px',
          padding: '3rem 2rem',
          borderRadius: '24px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <HelpCircle size={32} color="#818cf8" />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
          404
        </h1>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.75rem' }}>
          Page Not Found
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
          The requested support ticket, conversation, or page does not exist or has been moved.
        </p>

        <Link to={user ? homePath : '/login'} className="btn-primary">
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};
