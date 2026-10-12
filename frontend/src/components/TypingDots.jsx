import React from 'react';

export const TypingDots = ({ userName = 'Someone' }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        backgroundColor: 'rgba(31, 41, 55, 0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '9999px',
        fontSize: '0.8rem',
        color: '#94a3b8',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <span>{userName} is typing</span>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#818cf8',
            animation: 'typingBounce 1s infinite 0s',
          }}
        />
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#818cf8',
            animation: 'typingBounce 1s infinite 0.2s',
          }}
        />
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#818cf8',
            animation: 'typingBounce 1s infinite 0.4s',
          }}
        />
      </div>
    </div>
  );
};
