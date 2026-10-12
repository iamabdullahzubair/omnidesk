import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { CustomerDashboard } from './pages/CustomerDashboard.jsx';
import { AgentDashboard } from './pages/AgentDashboard.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// Role-protected route wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#94a3b8',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'pulseGlow 1s infinite linear',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    const fallbackPath = user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export const App = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="app-container">
      <Navbar />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate
                to={user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard'}
                replace
              />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate
                to={user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard'}
                replace
              />
            ) : (
              <RegisterPage />
            )
          }
        />

        {/* Customer Protected Routes */}
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRole="customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/conversations/:id"
          element={
            <ProtectedRoute allowedRole="customer">
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Agent Protected Routes */}
        <Route
          path="/agent/dashboard"
          element={
            <ProtectedRoute allowedRole="agent">
              <AgentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/conversations/:id"
          element={
            <ProtectedRoute allowedRole="agent">
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Root Redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate
                to={user?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard'}
                replace
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
};
