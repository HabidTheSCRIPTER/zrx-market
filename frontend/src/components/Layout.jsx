import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';
import MessageButton from './MessageButton';
import ToastContainer from './ToastContainer';
import GlobalChat from './GlobalChat';
import AlertModal from './AlertModal';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, isModerator, toasts, removeToast, alert, hideAlert } = useAuth();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Real-time polling for notifications - poll every 5 seconds
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 5000); // Poll every 5 seconds for real-time updates
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      // Silently fail
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-container">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
            ZRX MARKET
          </Link>
          <div
            className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}
            onClick={(e) => {
              // Close menu when clicking a link
              if (e.target.tagName === 'A') {
                closeMobileMenu();
              }
            }}
          >
            <Link to="/trades" className={location.pathname === '/trades' ? 'active' : ''}>
              Trades
            </Link>
            <Link to="/market-trends" className={location.pathname === '/market-trends' ? 'active' : ''}>
              Trends
            </Link>
            <Link to="/news" className={location.pathname === '/news' ? 'active' : ''}>
              News
            </Link>
            {user && (
              <>
                <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
                  Dashboard
                </Link>
                <Link to="/wishlist" className={location.pathname === '/wishlist' ? 'active' : ''}>
                  Wishlist
                </Link>
                <Link to="/templates" className={location.pathname === '/templates' ? 'active' : ''}>
                  Templates
                </Link>
                <Link to="/smart-alerts" className={location.pathname === '/smart-alerts' ? 'active' : ''}>
                  Alerts
                </Link>
                <Link to="/middlemen" className={location.pathname === '/middlemen' ? 'active' : ''}>
                  Middleman
                </Link>
                <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>
                  Report
                </Link>
                <Link to="/disputes" className={location.pathname === '/disputes' ? 'active' : ''}>
                  Disputes
                </Link>
                {isModerator() && (
                  <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="nav-auth">
            {user ? (
              <div className="user-menu">
                <img
                  src={user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                  alt={user.username}
                  className="user-avatar"
                />
                <span className="user-name">{user.username}</span>
                {user.verified === 1 && <span className="verified-badge">✓</span>}
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="notifications-btn"
                  title="Notifications"
                >
                  🔔
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                </button>
                <Link to={`/profile/${user.discordId}`} className="profile-link" title="View Profile">
                  👤
                </Link>
                <button onClick={logout} className="logout-btn">
                  Logout
                </button>
              </div>
            ) : (
              <a href="/auth/discord" className="login-btn">
                Login with Discord
              </a>
            )}
          </div>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div
          className={`mobile-menu-overlay ${mobileMenuOpen ? 'active' : ''}`}
          onClick={closeMobileMenu}
        />
      )}
      <div className="layout-content-wrapper">
        <GlobalChat />
        <main className="main-content">{children}</main>
      </div>
      <footer className="footer">
        <p>&copy; 2024 ZRX Market. All rights reserved.</p>
      </footer>
      <Notifications
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <MessageButton />
      <ToastContainer toasts={toasts || []} removeToast={removeToast} />
      <AlertModal
        show={alert.show}
        message={alert.message}
        type={alert.type}
        onClose={hideAlert}
      />
    </div>
  );
};

export default Layout;

