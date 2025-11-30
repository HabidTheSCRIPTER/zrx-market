import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Middleman.css';

const Middleman = () => {
  const { user, isModerator, isVerified } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [activeTab, setActiveTab] = useState('request'); // 'request' or 'view' (for moderators)
  
  // Middleman request form state
  const [middlemanData, setMiddlemanData] = useState({
    tradeId: '',
    user1: '',
    proofImages: []
  });
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isModerator() && activeTab === 'view') {
      fetchRequests();
    }
  }, [isModerator, statusFilter, activeTab]);

  useEffect(() => {
    if (user && activeTab === 'request') {
      fetchTrades();
    }
  }, [user, activeTab]);

  const fetchTrades = async () => {
    try {
      setLoadingTrades(true);
      const response = await axios.get('/api/trades/user/involved');
      setTrades(response.data || []);
    } catch (error) {
      console.error('[MIDDLEMAN] Error fetching trades:', error);
      setMessage('Error loading trades. Please refresh the page.');
      setTrades([]);
    } finally {
      setLoadingTrades(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setMiddlemanData({ ...middlemanData, proofImages: [...middlemanData.proofImages, ...files] });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      setMiddlemanData({ ...middlemanData, proofImages: [...middlemanData.proofImages, ...files] });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeImage = (index) => {
    const newImages = middlemanData.proofImages.filter((_, i) => i !== index);
    setMiddlemanData({ ...middlemanData, proofImages: newImages });
  };

  const handleMiddlemanSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    if (!isVerified()) {
      setMessage('You must be verified to request a middleman');
      setSubmitting(false);
      return;
    }

    if (!middlemanData.tradeId) {
      setMessage('Please select a trade');
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('tradeId', middlemanData.tradeId);
      formData.append('user2', user.discordId);
      
      // Append images
      middlemanData.proofImages.forEach((file, index) => {
        formData.append(`proofImages`, file);
      });

      await axios.post('/api/middleman', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setMessage('Middleman request created successfully!');
      setMiddlemanData({
        tradeId: '',
        user1: '',
        proofImages: []
      });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error creating middleman request');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/middleman/all', {
        params: { status: statusFilter }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status, middlemanId = null) => {
    try {
      await axios.patch(`/api/middleman/${id}/status`, { status, middlemanId });
      fetchRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error.response?.data?.error || 'Error updating status');
    }
  };

  return (
    <div className="middleman">
      <h1>Middleman</h1>
      
      {/* Tabs for switching between request and view (for moderators) */}
      <div className="tabs">
        <button
          className={activeTab === 'request' ? 'active' : ''}
          onClick={() => setActiveTab('request')}
        >
          Request Middleman
        </button>
        {isModerator() && (
          <button
            className={activeTab === 'view' ? 'active' : ''}
            onClick={() => setActiveTab('view')}
          >
            View Requests
          </button>
        )}
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Request Middleman Form */}
      {activeTab === 'request' && (
        <>
          {!user ? (
            <div className="no-requests">Please log in to request a middleman.</div>
          ) : (
            <form onSubmit={handleMiddlemanSubmit} className="form">
              {!isVerified() && (
                <div className="warning">
                  ⚠️ You must be verified to request a middleman. Contact an admin.
                </div>
              )}
              {loadingTrades ? (
                <div className="loading">Loading your trades...</div>
              ) : !trades || trades.length === 0 ? (
                <div className="no-interactions">
                  <p>You haven't created or been involved in any trades yet. You need to have trades before requesting a middleman.</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Select Trade *</label>
                    <select
                      value={middlemanData.tradeId}
                      onChange={(e) => {
                        const selectedTrade = trades.find(t => t.id === parseInt(e.target.value));
                        setMiddlemanData({ 
                          ...middlemanData, 
                          tradeId: e.target.value,
                          user1: selectedTrade ? (selectedTrade.creatorId === user.discordId ? '' : selectedTrade.creatorId) : ''
                        });
                      }}
                      required
                      className="user-select"
                    >
                      <option value="">-- Select a trade --</option>
                      {trades.map((trade) => {
                        const offeredStr = trade.offered?.map(i => i.name).join(', ') || 'N/A';
                        const wantedStr = trade.wanted?.map(i => i.name).join(', ') || 'N/A';
                        return (
                          <option key={trade.id} value={trade.id}>
                            Trade #{trade.id}: {offeredStr} for {wantedStr} {trade.value ? `(${trade.value})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="form-hint">Select the trade you need a middleman for</p>
                  </div>
                  <div className="form-group">
                    <label>Proof Images *</label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      style={{
                        border: '2px dashed #333',
                        borderRadius: '8px',
                        padding: '2rem',
                        textAlign: 'center',
                        backgroundColor: '#0a0a0a',
                        cursor: 'pointer'
                      }}
                      onClick={() => document.getElementById('proof-images-input').click()}
                    >
                      <input
                        id="proof-images-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        required={middlemanData.proofImages.length === 0}
                      />
                      <p style={{ margin: '0.5rem 0', color: '#888' }}>
                        {middlemanData.proofImages.length === 0 
                          ? 'Click or drag and drop images here' 
                          : `${middlemanData.proofImages.length} image(s) selected`}
                      </p>
                      {middlemanData.proofImages.length > 0 && (
                        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {middlemanData.proofImages.map((file, index) => (
                            <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Proof ${index + 1}`}
                                style={{
                                  width: '80px',
                                  height: '80px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  border: '1px solid #333'
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImage(index);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '-8px',
                                  background: '#dc3545',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" disabled={submitting || !isVerified() || loadingTrades || trades.length === 0 || !middlemanData.tradeId || middlemanData.proofImages.length === 0} className="submit-btn">
                    {submitting ? 'Creating...' : 'Request Middleman'}
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}

      {/* View Requests (Moderators Only) */}
      {activeTab === 'view' && !isModerator() && (
        <div className="no-requests">You must be a moderator to view requests.</div>
      )}

      {activeTab === 'view' && isModerator() && (
        <>
          <div className="status-filter">
        <button
          className={statusFilter === 'pending' ? 'active' : ''}
          onClick={() => setStatusFilter('pending')}
        >
          Pending
        </button>
        <button
          className={statusFilter === 'waiting_confirmation' ? 'active' : ''}
          onClick={() => setStatusFilter('waiting_confirmation')}
        >
          Waiting Confirmation
        </button>
        <button
          className={statusFilter === 'accepted' ? 'active' : ''}
          onClick={() => setStatusFilter('accepted')}
        >
          Accepted
        </button>
        <button
          className={statusFilter === 'declined' ? 'active' : ''}
          onClick={() => setStatusFilter('declined')}
        >
          Declined
        </button>
        <button
          className={statusFilter === 'completed' ? 'active' : ''}
          onClick={() => setStatusFilter('completed')}
        >
          Completed
        </button>
        <button
          className={statusFilter === null ? 'active' : ''}
          onClick={() => setStatusFilter(null)}
        >
          All
        </button>
      </div>
      {loading ? (
        <div className="loading">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="no-requests">No requests found.</div>
      ) : (
        <div className="requests-list">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <h3>Request #{request.id}</h3>
                <span className={`status-badge status-${request.status}`}>
                  {request.status}
                </span>
              </div>
              <div className="request-content">
                <p><strong>Requester:</strong> {request.username}</p>
                <p><strong>User 1:</strong> {request.user1}</p>
                <p><strong>User 2:</strong> {request.user2}</p>
                <p><strong>Item/Details:</strong> {request.item}</p>
                {request.value && <p><strong>Value:</strong> {request.value}</p>}
                {request.requestedTip && (
                  <p><strong>💰 Requested Tip:</strong> {request.requestedTip}</p>
                )}
                {request.user1Accepted === 1 && request.user2Accepted === 1 ? (
                  <p><strong>✅ Both parties confirmed</strong></p>
                ) : (
                  <p><strong>⏳ Waiting for confirmation:</strong> {
                    !request.user1Accepted && !request.user2Accepted 
                      ? 'Both users' 
                      : !request.user1Accepted 
                        ? 'User 1' 
                        : 'User 2'
                  }</p>
                )}
                {request.robloxUsername && (
                  <p><strong>Roblox:</strong> {request.robloxUsername}</p>
                )}
                {request.proofLinks && (
                  <div>
                    <strong>Proof Links:</strong>
                    <ul>
                      {JSON.parse(request.proofLinks).map((link, idx) => (
                        <li key={idx}>
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p><strong>Created:</strong> {new Date(request.createdAt).toLocaleString()}</p>
              </div>
              {request.status === 'pending' && (
                <div className="request-actions">
                  <button
                    onClick={() => updateStatus(request.id, 'accepted')}
                    className="btn-accept"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => updateStatus(request.id, 'declined')}
                    className="btn-decline"
                  >
                    Decline
                  </button>
                </div>
              )}
              {request.status === 'accepted' && (
                <div className="request-actions">
                  <button
                    onClick={() => updateStatus(request.id, 'completed')}
                    className="btn-complete"
                  >
                    Mark Complete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Middleman;

