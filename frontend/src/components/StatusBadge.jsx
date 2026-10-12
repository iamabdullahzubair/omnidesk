import React from 'react';

export const StatusBadge = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'open':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          color: '#34d399',
          border: 'rgba(16, 185, 129, 0.25)',
          label: 'Open',
        };
      case 'resolved':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          color: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.25)',
          label: 'Resolved',
        };
      case 'closed':
        return {
          bg: 'rgba(148, 163, 184, 0.12)',
          color: '#94a3b8',
          border: 'rgba(148, 163, 184, 0.25)',
          label: 'Closed',
        };
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.05)',
          color: '#cbd5e1',
          border: 'rgba(255, 255, 255, 0.1)',
          label: status,
        };
    }
  };

  const current = getStyle();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: current.bg,
        color: current.color,
        border: `1px solid ${current.border}`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: current.color,
        }}
      />
      {current.label}
    </span>
  );
};
