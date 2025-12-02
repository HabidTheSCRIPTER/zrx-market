import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './GlobalChat.css';

// Calculate navbar height dynamically
const getNavbarHeight = () => {
  const navbar = document.querySelector('.navbar');
  return navbar ? navbar.offsetHeight : 80;
};

const GlobalChat = () => {
  const { user, showToast } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messageListRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(80);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Calculate navbar height after DOM loads (only for desktop)
    const updateNavbarHeight = () => {
      if (window.innerWidth > 768) {
        const height = getNavbarHeight();
        if (height > 0) {
          setNavbarHeight(height);
        }
      }
    };
    
    // Wait for DOM to be ready
    if (document.readyState === 'complete') {
      updateNavbarHeight();
    } else {
      window.addEventListener('load', updateNavbarHeight);
      updateNavbarHeight(); // Also try immediately
    }
    
    window.addEventListener('resize', updateNavbarHeight);
    
    // Use MutationObserver to detect navbar changes
    const observer = new MutationObserver(updateNavbarHeight);
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      observer.observe(navbar, { attributes: true, childList: true, subtree: true });
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', updateNavbarHeight);
      window.removeEventListener('load', updateNavbarHeight);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchMessages();
      // Poll for new messages every 2 seconds
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get('/api/global-chat', {
        params: { limit: 100 }
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setMessages(data);
    } catch (error) {
      console.error('Error fetching global chat messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!user) {
      showToast('Please log in to send messages', 'warning');
      return;
    }
    
    if (!newMessage.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/global-chat', {
        content: newMessage
      });
      
      setMessages(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, response.data];
      });
      setNewMessage('');
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      showToast(error.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <button 
        className="global-chat-toggle collapsed"
        onClick={() => setIsCollapsed(false)}
        title="Open Global Chat"
        style={!isMobile ? { top: `${navbarHeight + 10}px` } : {}}
      >
        💬
      </button>
    );
  }

  return (
    <div className="global-chat" style={!isMobile ? { top: `${navbarHeight}px` } : {}}>
      <div className="global-chat-header">
        <h3>💬 Global Chat</h3>
        <button 
          className="global-chat-toggle-btn"
          onClick={() => setIsCollapsed(true)}
          title="Collapse Chat"
        >
          ←
        </button>
      </div>
      
      <div className="global-chat-messages" ref={messageListRef}>
        {(!Array.isArray(messages) || messages.length === 0) ? (
          <div className="no-messages">No messages yet. Be the first to chat!</div>
        ) : (
          (Array.isArray(messages) ? messages : []).map((message) => (
            <div key={message.id} className="global-chat-message">
              <img
                src={message.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt={message.username}
                className="global-chat-avatar"
              />
              <div className="global-chat-message-content">
                <div className="global-chat-message-header">
                  <span className="global-chat-username">
                    {message.username}
                    {message.verified === 1 && <span className="verified-badge">✓</span>}
                  </span>
                  <span className="global-chat-time">{formatTime(message.createdAt)}</span>
                </div>
                <div className={`global-chat-text ${message.isFiltered ? 'filtered' : ''}`}>
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {user ? (
        <form onSubmit={handleSendMessage} className="global-chat-input-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="global-chat-input"
            disabled={loading}
          />
          <button 
            type="submit" 
            className="global-chat-send-btn"
            disabled={loading || !newMessage.trim()}
          >
            ➤
          </button>
        </form>
      ) : (
        <div className="global-chat-login-prompt">
          <p>Please log in to chat</p>
        </div>
      )}
    </div>
  );
};

export default GlobalChat;

