import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Notifications.css';

const Notifications = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
      fetchUnreadCount();
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications');
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notifications-header">
          <h2>Notifications</h2>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="mark-all-read-btn">
              Mark all as read
            </button>
          )}
          <button onClick={onClose} className="close-notifications-btn">×</button>
        </div>
        <div className="notifications-list">
          {loading ? (
            <div className="loading">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="no-notifications">No notifications</div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-item ${notification.isRead === 0 ? 'unread' : ''}`}
                onClick={() => {
                  if (notification.isRead === 0) markAsRead(notification.id);
                  if (notification.link) window.location.href = notification.link;
                }}
              >
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
                {notification.isRead === 0 && <div className="unread-indicator" />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;




