import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { GAME_CATEGORIES, getItemsForCategory } from '../utils/tradeConstants';
import SearchableSelect from './SearchableSelect';
import { PET_MUTATIONS, BRAINROT_MUTATIONS, BRAINROT_TRAITS, calculateItemValue, getValueUnit } from '../utils/valueCalculation';
import AdvancedCategorySelect from './AdvancedCategorySelect';
import './MessageButton.css';

const MessageButton = () => {
  const { user, messageOverlayOpen, messageRecipient, messageTradeId, messageReportId, isBridged, openMessageOverlay, closeMessageOverlay, showToast } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [conversations, setConversations] = useState([]); // New state for conversations
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messageListRef = useRef(null);
  const [lastMessageId, setLastMessageId] = useState(null); // Track last message ID for polling
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0); // Track previous unread count for sound notifications
  const audioRef = useRef(null); // Reference for notification sound
  const [tradeData, setTradeData] = useState(null); // Trade data for current chat
  const [mmRequestStatus, setMmRequestStatus] = useState(null); // MM request status
  const [showOfferModal, setShowOfferModal] = useState(false); // Show/hide offer modal
  const [showCalculator, setShowCalculator] = useState(false); // Show/hide calculator
  const [mmCooldownRemaining, setMmCooldownRemaining] = useState(0); // MM request cooldown in milliseconds
  const [offerFormData, setOfferFormData] = useState({
    offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]
  }); // Offer form data (only offered items)

  // Fetch trade data when tradeId is available
  useEffect(() => {
    const currentTradeId = messageTradeId || (messages.length > 0 ? messages[0].tradeId : null);
    if (currentTradeId && currentRecipient) {
      fetchTradeData(currentTradeId);
      fetchMMRequestStatus(currentTradeId);
    } else {
      setTradeData(null);
      setMmRequestStatus(null);
    }
  }, [messageTradeId, currentRecipient, messages]);
  
  // Poll for MM request status updates when in a trade conversation
  useEffect(() => {
    if (!currentRecipient || !messageTradeId) return;
    
    const interval = setInterval(() => {
      const currentTradeId = messageTradeId || (messages.length > 0 ? messages[0].tradeId : null);
      if (currentTradeId) {
        fetchMMRequestStatus(currentTradeId);
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [currentRecipient, messageTradeId, messages]);

  // Update internal state when context changes
  useEffect(() => {
    if (messageOverlayOpen) {
      // If messageRecipient is provided from context (e.g., when clicking message button on trade), use it
      if (messageRecipient) {
        setCurrentRecipient(messageRecipient);
        fetchMessages(messageRecipient, messageTradeId);
      } else if (!currentRecipient) {
        // If no recipient is set, show conversation list
        fetchConversations();
      }
    } else {
      // When overlay closes, reset current recipient and clear messages
      setCurrentRecipient(null);
      setMessages([]);
      setLastMessageId(null);
      setTradeData(null);
      setMmRequestStatus(null);
      fetchUnreadCount(); // Re-fetch unread count when overlay closes
    }
  }, [messageOverlayOpen, messageRecipient, messageTradeId]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Start polling for unread count every 10 seconds (reduced frequency)
      const unreadInterval = setInterval(() => {
        fetchUnreadCount();
      }, 10000);
      return () => clearInterval(unreadInterval);
    }
  }, [user]);

  // Poll for new messages when a conversation is open - reduced frequency to avoid rate limiting
  useEffect(() => {
    if (!currentRecipient || !messageOverlayOpen) return;

    // Poll for new messages every 5 seconds (reduced from 2 seconds)
    const messageInterval = setInterval(() => {
      fetchMessages(currentRecipient, messageTradeId, true); // Pass true to indicate polling
    }, 5000);

    return () => clearInterval(messageInterval);
  }, [currentRecipient, messageTradeId, messageOverlayOpen]);

  // Poll for conversation updates when overlay is open but no specific conversation is selected
  useEffect(() => {
    if (!currentRecipient && messageOverlayOpen) {
      const conversationInterval = setInterval(() => {
        fetchConversations();
      }, 10000); // Poll every 10 seconds (reduced from 3 seconds)
      return () => clearInterval(conversationInterval);
    }
  }, [currentRecipient, messageOverlayOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const response = await axios.get('/api/messages/conversations');
      console.log('Fetched conversations:', response.data);
      const conversationsList = response.data || [];
      // Only update if we got a valid response
      if (Array.isArray(conversationsList)) {
        setConversations(conversationsList);
        filterConversations(conversationsList, conversationSearch);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      console.error('Error details:', error.response?.data);
      // Don't clear conversations on error - keep the last known state
      // Only clear if it's a 401/403 (auth error)
      if (error.response?.status === 401 || error.response?.status === 403) {
        setConversations([]);
        setFilteredConversations([]);
      }
      // Otherwise, keep existing conversations to prevent flickering
    }
  };

  const filterConversations = (conversationsList, searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredConversations(conversationsList);
      return;
    }
    
    const search = searchTerm.toLowerCase().trim();
    const filtered = conversationsList.filter(conv => 
      conv.otherUsername?.toLowerCase().includes(search) ||
      conv.lastMessageContent?.toLowerCase().includes(search) ||
      (conv.tradeId && `trade ${conv.tradeId}`.includes(search))
    );
    setFilteredConversations(filtered);
  };

  // Filter conversations when search term changes
  useEffect(() => {
    filterConversations(conversations, conversationSearch);
  }, [conversationSearch]);

  const fetchMessages = async (recipient, tradeId, isPolling = false) => {
    if (!user || !recipient || !recipient.discordId) {
      console.warn('Cannot fetch messages: missing user or recipient', { user: !!user, recipient });
      return;
    }
    try {
      const params = { recipientId: recipient.discordId };
      if (tradeId) params.tradeId = tradeId;
      if (messageReportId) params.reportId = messageReportId;
      // Add lastMessageId for polling to only get new messages
      if (isPolling && lastMessageId) {
        params.lastMessageId = lastMessageId;
      }

      const response = await axios.get('/api/messages', { params });
      
      // If polling and we have messages, only add new ones
      if (isPolling && lastMessageId && response.data.length > 0) {
        const newMessages = response.data.filter(msg => msg.id > lastMessageId);
        if (newMessages.length > 0) {
          // Check if any new messages are received (not sent by current user)
          const receivedMessages = newMessages.filter(msg => msg.senderId !== user.discordId);
          if (receivedMessages.length > 0) {
            playNotificationSound(); // Play sound for received messages
          }
          
          setMessages((prevMessages) => [...prevMessages, ...newMessages]);
          setLastMessageId(Math.max(...newMessages.map(m => m.id)));
          markMessagesAsRead(recipient.discordId, tradeId); // Mark new messages as read
        }
      } else {
        // Initial load - replace all messages
        setMessages(response.data || []);
        if (response.data && response.data.length > 0) {
          setLastMessageId(Math.max(...response.data.map(m => m.id)));
          markMessagesAsRead(recipient.discordId, tradeId); // Mark as read when opened
        } else {
          setLastMessageId(null);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const response = await axios.get('/api/messages/unreadCount');
      const newCount = response.data.count;
      
      // Play sound notification if unread count increased
      if (newCount > previousUnreadCount && previousUnreadCount > 0) {
        playNotificationSound();
      }
      
      setPreviousUnreadCount(newCount);
      setUnreadCount(newCount);
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - don't spam errors, just skip this fetch
        return;
      }
      console.error('Error fetching unread count:', error);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const markMessagesAsRead = async (recipientId, tradeId = null) => {
    if (!user) return;
    try {
      await axios.post('/api/messages/markAsRead', { recipientId, tradeId });
      fetchUnreadCount(); // Update unread count after marking as read
      fetchConversations(); // Update conversation list to reflect read status
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    const messageToSend = newMessage.trim();
    if (messageToSend === '' || !user) {
      return;
    }
    
    // Try multiple ways to get the recipient
    let recipient = currentRecipient || messageRecipient;
    
    // If still no recipient but we have messages, derive it from the messages
    if (!recipient && messages.length > 0) {
      const firstMessage = messages[0];
      // Determine who the other person is (not the current user)
      const otherUserId = firstMessage.senderId === user.discordId 
        ? firstMessage.recipientId 
        : firstMessage.senderId;
      const otherUsername = firstMessage.senderId === user.discordId
        ? firstMessage.recipientUsername
        : firstMessage.senderUsername;
      const otherAvatar = firstMessage.senderId === user.discordId
        ? firstMessage.recipientAvatar
        : firstMessage.senderAvatar;
      
      if (otherUserId) {
        recipient = {
          discordId: otherUserId,
          username: otherUsername,
          avatar: otherAvatar
        };
        // Set it as current recipient so it persists
        setCurrentRecipient(recipient);
      }
    }
    
    if (!recipient || !recipient.discordId) {
      console.error('No recipient available to send message to', { 
        currentRecipient, 
        messageRecipient,
        messagesCount: messages.length 
      });
      showToast('Please select a conversation to send a message.', 'warning');
      return;
    }
    
    // Get the tradeId and reportId from context or from messages
    const tradeId = messageTradeId || (messages.length > 0 ? messages[0].tradeId : null);
    const reportId = messageReportId || (messages.length > 0 ? messages[0].reportId : null);
    
    try {
      console.log('Sending message to:', recipient.discordId, 'Trade ID:', tradeId, 'Report ID:', reportId, 'Bridged:', isBridged);
      
      // If this is a bridged conversation, send to Discord bridge first
      if (isBridged && reportId) {
        try {
          await axios.post('/api/discord-bridge/send-to-discord', {
            reportId: reportId,
            content: messageToSend
          });
        } catch (bridgeError) {
          console.error('Error sending to Discord bridge:', bridgeError);
          // Continue to send regular message as fallback
        }
      }
      
      const response = await axios.post('/api/messages', {
        recipientId: recipient.discordId,
        content: messageToSend,
        tradeId: tradeId || null,
        reportId: reportId || null,
        isBridged: isBridged ? 1 : 0
      });
      
      if (!response.data) {
        throw new Error('No response data from server');
      }
      
      // Add the new message to the list
      setMessages((prevMessages) => {
        const updated = [...prevMessages, response.data];
        setLastMessageId(response.data.id);
        return updated;
      });
      
      setNewMessage('');
      fetchConversations(); // Update conversations after sending a message
      fetchUnreadCount(); // Update unread count
      
      // Scroll to bottom after sending
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error 
        ? error.response.data.error
        : error.response?.data?.errors
        ? error.response.data.errors.map(e => e.msg || e).join(', ')
        : error.message
        ? error.message
        : 'Failed to send message. Please try again.';
      showToast(errorMessage, 'error');
    }
  };

  const fetchTradeData = async (tradeId) => {
    if (!tradeId) return;
    try {
      const response = await axios.get(`/api/trades/${tradeId}`);
      setTradeData(response.data);
    } catch (error) {
      console.error('Error fetching trade data:', error);
      setTradeData(null);
    }
  };

  const fetchMMRequestStatus = async (tradeId) => {
    if (!tradeId) return;
    try {
      const response = await axios.get(`/api/middleman/chat-status/${tradeId}`);
      setMmRequestStatus(response.data);
      if (response.data.cooldownRemaining) {
        setMmCooldownRemaining(response.data.cooldownRemaining);
      } else {
        setMmCooldownRemaining(0);
      }
    } catch (error) {
      console.error('Error fetching MM request status:', error);
      setMmRequestStatus({ hasRequest: false });
      setMmCooldownRemaining(0);
    }
  };

  // Countdown timer for MM cooldown
  useEffect(() => {
    if (mmCooldownRemaining > 0) {
      const interval = setInterval(() => {
        setMmCooldownRemaining(prev => {
          const newValue = prev - 1000;
          return newValue > 0 ? newValue : 0;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mmCooldownRemaining]);

  const handleRequestMM = async () => {
    // Check cooldown
    if (mmCooldownRemaining > 0) {
      const minutes = Math.floor(mmCooldownRemaining / 60000);
      const seconds = Math.floor((mmCooldownRemaining % 60000) / 1000);
      showToast(`Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before requesting MM again.`, 'warning');
      return;
    }

    // Get tradeId from multiple sources
    const tradeId = messageTradeId || (messages.length > 0 ? messages[0].tradeId : null);
    const recipient = currentRecipient || messageRecipient;

    if (!tradeId || !recipient) {
      showToast('Trade ID or recipient missing. Please ensure you are in a trade conversation.', 'error');
      return;
    }

    try {
      const response = await axios.post('/api/middleman/request-from-chat', {
        tradeId: tradeId,
        recipientId: recipient.discordId
      });

      if (response.data.bothRequested) {
        showToast('✅ Both parties have requested MM! The request has been sent to Discord and will appear on the waitlist.', 'success');
      } else {
        showToast('✅ Your MM request has been recorded. Waiting for the other party to also request MM.', 'info');
      }

      // Update cooldown from response if provided
      if (response.data.cooldownRemaining) {
        setMmCooldownRemaining(response.data.cooldownRemaining);
      } else {
        // Set 20 minute cooldown
        setMmCooldownRemaining(20 * 60 * 1000);
      }

      fetchMMRequestStatus(tradeId);
    } catch (error) {
      console.error('Error requesting MM:', error);
      if (error.response?.status === 429) {
        const cooldownMs = error.response?.data?.cooldownRemaining || 20 * 60 * 1000;
        setMmCooldownRemaining(cooldownMs);
        showToast(error.response?.data?.error || 'Please wait before requesting MM again.', 'warning');
      } else {
        showToast(error.response?.data?.error || 'Failed to request middleman', 'error');
      }
    }
  };

  const handleAddOfferItem = () => {
    setOfferFormData({
      ...offerFormData,
      offeredItems: [...offerFormData.offeredItems, { name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]
    });
  };

  const handleRemoveOfferItem = (index) => {
    const updated = offerFormData.offeredItems.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updated.push({ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' });
    }
    setOfferFormData({ ...offerFormData, offeredItems: updated });
  };

  const handleOfferItemChange = (index, field, value) => {
    const updated = [...offerFormData.offeredItems];
    const item = updated[index];
    updated[index] = { ...item, [field]: value };
    
    // Auto-calculate value for STEAL A BRAINROT items when mutation or traits change
    if (updated[index].gameCategory === 'STEAL A BRAINROT' && updated[index].name) {
      if (field === 'mutation' || field === 'traits' || field === 'name') {
        const calculatedValue = calculateItemValue({
          name: updated[index].name,
          gameCategory: 'STEAL A BRAINROT',
          mutation: field === 'mutation' ? value : (updated[index].mutation || 'Default'),
          traits: field === 'traits' ? value : (updated[index].traits || [])
        });
        
        if (calculatedValue) {
          updated[index].value = calculatedValue.toString();
          updated[index].valueUnit = getValueUnit(calculatedValue);
        }
      }
    }
    
    setOfferFormData({ ...offerFormData, offeredItems: updated });
  };

  const handleSendOffer = async (e) => {
    e.preventDefault();
    
    // Validate at least one item is filled
    const hasValidItem = offerFormData.offeredItems.some(item => 
      item.name && item.gameCategory
    );

    if (!hasValidItem) {
      showToast('Please add at least one item to your offer', 'warning');
      return;
    }

    try {
      const recipient = currentRecipient || messageRecipient;
      if (!recipient || !recipient.discordId) {
        showToast('Please select a conversation to send a message.', 'warning');
        return;
      }
      
      const tradeId = messageTradeId || (messages.length > 0 ? messages[0].tradeId : null);
      const reportId = messageReportId || (messages.length > 0 ? messages[0].reportId : null);

      // Format offer message
      const itemsText = offerFormData.offeredItems
        .filter(item => item.name && item.gameCategory)
        .map(item => {
          let text = item.name;
          if (item.mutation && item.mutation !== 'Default' && item.mutation !== 'None') {
            text += ` (${item.mutation})`;
          }
          if (item.traits && item.traits.length > 0) {
            text += ` [${item.traits.join(', ')}]`;
          }
          if (item.weight) {
            text += ` - ${item.weight}kg`;
          }
          if (item.value) {
            text += ` - ${item.value}${item.valueUnit ? ' ' + item.valueUnit : ''}`;
          }
          return text;
        })
        .join(', ');

      const offerMessage = `💰 **OFFER:** ${itemsText}`;
      
      const response = await axios.post('/api/messages', {
        recipientId: recipient.discordId,
        content: offerMessage,
        tradeId: tradeId || null,
        reportId: reportId || null,
        isBridged: isBridged ? 1 : 0
      });
      
      if (response.data) {
        setMessages((prevMessages) => [...prevMessages, response.data]);
        setLastMessageId(response.data.id);
        setNewMessage('');
        setShowOfferModal(false);
        setOfferFormData({
          offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]
        });
        fetchConversations();
        fetchUnreadCount();
        showToast('✅ Offer sent successfully!', 'success');
      }
    } catch (error) {
      console.error('Error sending offer:', error);
      showToast(error.response?.data?.error || 'Failed to send offer', 'error');
    }
  };

  const startConversation = (recipient, tradeId = null) => {
    if (!recipient || !recipient.discordId) {
      console.error('Invalid recipient provided to startConversation:', recipient);
      showToast('Error: Invalid recipient. Please try again.', 'error');
      return;
    }
    console.log('Setting current recipient:', recipient);
    setCurrentRecipient({
      discordId: recipient.discordId,
      username: recipient.username || 'Unknown User',
      avatar: recipient.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'
    });
    setLastMessageId(null); // Reset last message ID when starting new conversation
    setMessages([]); // Clear previous messages
    setTradeData(null);
    setMmRequestStatus(null);
    fetchMessages(recipient, tradeId); // Start new conversation
  };

  if (!user) return null;

  return (
    <>
      <button onClick={() => openMessageOverlay()} className="message-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Messages {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </button>

      <div className={`message-overlay ${messageOverlayOpen ? '' : 'hidden'}`}>
        <div className="message-overlay-content">
          <div className="message-overlay-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {currentRecipient && (
                <button 
                  onClick={() => {
                    setCurrentRecipient(null);
                    setMessages([]);
                    setLastMessageId(null);
                    fetchConversations();
                  }} 
                  className="back-btn"
                  title="Back to conversations"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                </button>
              )}
              <h3>{currentRecipient ? `Chat with ${currentRecipient.username}` : 'Conversations'}</h3>
            </div>
            <button onClick={closeMessageOverlay} className="close-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {!currentRecipient ? (
            <div className="conversation-list">
              <div className="conversation-search">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              {(filteredConversations.length > 0 ? filteredConversations : conversations).length === 0 && (
                <p>{conversationSearch ? 'No conversations match your search.' : 'No conversations yet.'}</p>
              )}
              {(filteredConversations.length > 0 ? filteredConversations : conversations).map((conv) => (
                <div 
                  key={conv.otherUserDiscordId + (conv.tradeId || '')} 
                  className="conversation-item" 
                  onClick={() => {
                    const recipient = {
                      discordId: conv.otherUserDiscordId,
                      username: conv.otherUsername,
                      avatar: conv.otherAvatar
                    };
                    console.log('Starting conversation with:', recipient);
                    startConversation(recipient, conv.tradeId);
                  }}
                >
                  <img src={conv.otherAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt={conv.otherUsername} />
                  <div className="conversation-info">
                    <span>{conv.otherUsername} {conv.tradeId && `(Trade: ${conv.tradeId})`}</span>
                    <p className="last-message">{conv.lastMessageContent}</p>
                  </div>
                  {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Trade Display */}
              {tradeData && (
                <div className="trade-display-in-chat">
                  <div className="trade-display-header">
                    <h4>📦 Trade #{tradeData.id}</h4>
                    <div className="trade-display-actions">
                      <button 
                        onClick={() => setShowCalculator(!showCalculator)} 
                        className="calculator-toggle-btn"
                        title="Toggle Calculator"
                      >
                        {showCalculator ? '📊 Hide' : '💰 Calculator'}
                      </button>
                      <span className="trade-value">{tradeData.value || 'No value specified'}</span>
                    </div>
                  </div>
                  {showCalculator && (
                    <div className="calculator-in-chat">
                      <TradeCalculator 
                        initialOffered={Array.isArray(tradeData.offered) ? tradeData.offered.filter(i => i.gameCategory === 'STEAL A BRAINROT') : []}
                        initialWanted={Array.isArray(tradeData.wanted) ? tradeData.wanted.filter(i => i.gameCategory === 'STEAL A BRAINROT') : []}
                      />
                    </div>
                  )}
                  <div className="trade-display-items">
                    <div className="trade-display-section">
                      <strong>Offering:</strong>
                      <div className="trade-items-preview">
                        {Array.isArray(tradeData.offered) && tradeData.offered.length > 0
                          ? tradeData.offered.slice(0, 3).map((item, i) => (
                              <span key={i}>{typeof item === 'string' ? item : item.name}</span>
                            ))
                          : <span>N/A</span>}
                        {Array.isArray(tradeData.offered) && tradeData.offered.length > 3 && (
                          <span>+{tradeData.offered.length - 3} more</span>
                        )}
                      </div>
                    </div>
                    <div className="trade-display-section">
                      <strong>Wants:</strong>
                      <div className="trade-items-preview">
                        {Array.isArray(tradeData.wanted) && tradeData.wanted.length > 0
                          ? tradeData.wanted.slice(0, 3).map((item, i) => (
                              <span key={i}>{typeof item === 'string' ? item : item.name}</span>
                            ))
                          : <span>N/A</span>}
                        {Array.isArray(tradeData.wanted) && tradeData.wanted.length > 3 && (
                          <span>+{tradeData.wanted.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MM Request Button */}
              {tradeData && currentRecipient && (
                <div className="mm-request-section">
                  {mmRequestStatus?.hasRequest ? (
                    mmRequestStatus.bothRequested ? (
                      <div className="mm-status">
                        <span className="mm-status-success">✅ Both parties requested MM - On waitlist!</span>
                      </div>
                    ) : (
                      // Check if current user hasn't requested yet - show button
                      (mmRequestStatus.userIsUser1 && !mmRequestStatus.user1Requested) ||
                      (!mmRequestStatus.userIsUser1 && !mmRequestStatus.user2Requested) ? (
                        <button 
                          onClick={handleRequestMM} 
                          className="request-mm-btn"
                          disabled={mmCooldownRemaining > 0}
                        >
                          {mmCooldownRemaining > 0 ? (
                            `⏳ Cooldown: ${Math.floor(mmCooldownRemaining / 60000)}:${Math.floor((mmCooldownRemaining % 60000) / 1000).toString().padStart(2, '0')}`
                          ) : (
                            '🛡️ Request Middleman (Other party requested)'
                          )}
                        </button>
                      ) : (
                        <div className="mm-status">
                          <span className="mm-status-waiting">⏳ Waiting for other party...</span>
                        </div>
                      )
                    )
                  ) : (
                    <button 
                      onClick={handleRequestMM} 
                      className="request-mm-btn"
                      disabled={mmCooldownRemaining > 0}
                    >
                      {mmCooldownRemaining > 0 ? (
                        `⏳ Cooldown: ${Math.floor(mmCooldownRemaining / 60000)}:${Math.floor((mmCooldownRemaining % 60000) / 1000).toString().padStart(2, '0')}`
                      ) : (
                        '🛡️ Request Middleman'
                      )}
                    </button>
                  )}
                </div>
              )}

              {isBridged && messageReportId && (
                <p className="bridge-context" style={{ color: '#5865F2', fontSize: '0.85rem', padding: '0.5rem', background: 'rgba(88, 101, 242, 0.1)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                  🔗 Bridged with Discord - Messages sync between website and Discord
                </p>
              )}
              <div className="message-list" ref={messageListRef}>
                {messages.length === 0 ? (
                  <div className="no-messages">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-item ${msg.senderId === user.discordId ? 'sent' : 'received'}`}
                    >
                      {msg.senderId !== user.discordId && (
                        <strong>{msg.senderUsername}</strong>
                      )}
                      <div className="message-content">{msg.content}</div>
                      <span className="timestamp">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="message-input-area">
                <div className="message-input-row">
                  {tradeData && (
                    <button
                      onClick={() => setShowOfferModal(true)}
                      className="offer-btn"
                      title="Send an offer"
                    >
                      💰 Offer
                    </button>
                  )}
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!currentRecipient && !messageRecipient}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!currentRecipient && !messageRecipient || newMessage.trim() === ''}
                    title={(!currentRecipient && !messageRecipient) ? 'Select a conversation to send a message' : 'Send message'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-send"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="offer-modal-overlay" onClick={() => setShowOfferModal(false)}>
          <div className="offer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="offer-modal-header">
              <h3>💰 Make an Offer</h3>
              <button onClick={() => setShowOfferModal(false)} className="close-modal-btn">×</button>
            </div>
            <form onSubmit={handleSendOffer} className="offer-form">
              <div className="offer-form-section">
                <h4>Offered Items</h4>
                {offerFormData.offeredItems.map((item, index) => (
                  <div key={index} className="offer-item-input-group">
                    <SearchableSelect
                      value={item.gameCategory || ''}
                      onChange={(value) => handleOfferItemChange(index, 'gameCategory', value)}
                      options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                      placeholder="Category"
                      required={true}
                      style={{ flex: '1 1 150px' }}
                    />
                    <SearchableSelect
                      value={item.name || ''}
                      onChange={(value) => handleOfferItemChange(index, 'name', value)}
                      options={getItemsForCategory(item.gameCategory).map(itemName => ({ value: itemName, label: itemName }))}
                      placeholder="Item"
                      required={true}
                      disabled={!item.gameCategory}
                      style={{ flex: '1 1 180px' }}
                    />
                    {item.gameCategory === 'GROW A GARDEN' && (
                      <>
                        <SearchableSelect
                          value={item.mutation || 'None'}
                          onChange={(value) => handleOfferItemChange(index, 'mutation', value)}
                          options={PET_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                          placeholder="Mutation"
                          style={{ flex: '0 1 110px' }}
                        />
                        <input
                          type="text"
                          placeholder="Weight"
                          value={item.weight || ''}
                          onChange={(e) => handleOfferItemChange(index, 'weight', e.target.value)}
                          style={{ flex: '0 1 80px' }}
                        />
                      </>
                    )}
                    {item.gameCategory === 'STEAL A BRAINROT' && (
                      <>
                        <SearchableSelect
                          value={item.mutation || 'Default'}
                          onChange={(value) => handleOfferItemChange(index, 'mutation', value)}
                          options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                          placeholder="Mutation"
                          style={{ flex: '0 1 110px' }}
                        />
                        <div style={{ flex: '0 1 150px' }}>
                          <AdvancedCategorySelect
                            value={Array.isArray(item.traits) ? item.traits : []}
                            onChange={(value) => handleOfferItemChange(index, 'traits', value)}
                            options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}
                            placeholder="Traits"
                            multiSelect={true}
                            showCounts={false}
                          />
                        </div>
                      </>
                    )}
                    <input
                      type="text"
                      placeholder={item.gameCategory === 'STEAL A BRAINROT' ? 'Value (auto-calculated)' : 'Value'}
                      value={item.value || ''}
                      onChange={(e) => handleOfferItemChange(index, 'value', e.target.value)}
                      readOnly={item.gameCategory === 'STEAL A BRAINROT'}
                      style={{ 
                        flex: '0 1 100px',
                        background: item.gameCategory === 'STEAL A BRAINROT' ? '#2f3136' : 'inherit',
                        cursor: item.gameCategory === 'STEAL A BRAINROT' ? 'not-allowed' : 'text'
                      }}
                    />
                    <SearchableSelect
                      value={item.valueUnit || ''}
                      onChange={(value) => handleOfferItemChange(index, 'valueUnit', value)}
                      options={[
                        { value: '', label: 'Unit' },
                        { value: 'M/s', label: 'M/s' },
                        { value: 'B/s', label: 'B/s' }
                      ]}
                      placeholder="Unit"
                      disabled={item.gameCategory === 'STEAL A BRAINROT'}
                      style={{ flex: '0 1 80px' }}
                    />
                    <button type="button" onClick={() => handleRemoveOfferItem(index)} className="remove-item-btn">×</button>
                  </div>
                ))}
                <button type="button" onClick={handleAddOfferItem} className="add-item-btn">+ Add Item</button>
              </div>
              <div className="offer-form-actions">
                <button type="button" onClick={() => setShowOfferModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="send-offer-btn">Send Offer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageButton;
