import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messageOverlayOpen, setMessageOverlayOpen] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [messageTradeId, setMessageTradeId] = useState(null);
  const [messageReportId, setMessageReportId] = useState(null);
  const [isBridged, setIsBridged] = useState(false);
  const messageOverlayRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = '/auth/discord';
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isModerator = () => {
    if (!user) return false;
    
    if (user.isOwner) {
      return true;
    }
    
    if (user.roles) {
      const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;
      const moderatorRoleId = import.meta.env.VITE_MODERATOR_ROLE_ID || '1391972977586864218';
      return roles.includes(moderatorRoleId);
    }
    
    return false;
  };

  const isVerified = () => {
    return user && user.verified === 1;
  };

  const openMessageOverlay = (recipient = null, tradeId = null, reportId = null, bridged = false) => {
    setMessageRecipient(recipient);
    setMessageTradeId(tradeId);
    setMessageReportId(reportId);
    setIsBridged(bridged);
    setMessageOverlayOpen(true);
  };

  const closeMessageOverlay = () => {
    setMessageOverlayOpen(false);
    setMessageRecipient(null);
    setMessageTradeId(null);
    setMessageReportId(null);
    setIsBridged(false);
  };

  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
  };

  const hideAlert = () => {
    setAlert({ show: false, message: '', type: 'info' });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        checkAuth,
        isModerator,
        isVerified,
        messageOverlayOpen,
        messageRecipient,
        messageTradeId,
        messageReportId,
        isBridged,
        openMessageOverlay,
        closeMessageOverlay,
        messageOverlayRef,
        showToast,
        removeToast,
        toasts,
        showAlert,
        hideAlert,
        alert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

