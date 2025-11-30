import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Disputes.css';

const Disputes = () => {
  const { user, isModerator } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    tradeId: '',
    accusedId: '',
    reason: '',
    evidence: []
  });
  const [userTrades, setUserTrades] = useState([]);

  useEffect(() => {
    if (user) {
      fetchDisputes();
      fetchUserTrades();
    }
  }, [user, statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const endpoint = isModerator() 
        ? `/api/disputes?status=${statusFilter}`
        : '/api/disputes/my-disputes';
      const response = await axios.get(endpoint);
      setDisputes(response.data);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTrades = async () => {
    try {
      const response = await axios.get('/api/trades/user/involved');
      setUserTrades(response.data);
    } catch (error) {
      console.error('Error fetching user trades:', error);
    }
  };

  const handleTradeSelect = (tradeId) => {
    const trade = userTrades.find(t => t.id === parseInt(tradeId));
    if (trade) {
      // Auto-fill accusedId (the other party)
      const otherParty = trade.creatorId === user.discordId 
        ? trade.messages?.[0]?.senderId || trade.messages?.[0]?.recipientId
        : trade.creatorId;
      setFormData({ ...formData, tradeId, accusedId: otherParty || '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/disputes', formData);
      setShowCreateForm(false);
      setFormData({ tradeId: '', accusedId: '', reason: '', evidence: [] });
      fetchDisputes();
      alert('Dispute created successfully');
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert(error.response?.data?.error || 'Failed to create dispute');
    }
  };

  const handleStatusUpdate = async (disputeId, status, resolution = '') => {
    try {
      await axios.patch(`/api/disputes/${disputeId}/status`, { status, resolution });
      fetchDisputes();
    } catch (error) {
      console.error('Error updating dispute:', error);
      alert('Failed to update dispute');
    }
  };

  if (!user) {
    return (
      <div className="disputes-page">
        <h1>Disputes</h1>
        <p>Please log in to view disputes.</p>
      </div>
    );
  }

  return (
    <div className="disputes-page">
      <div className="disputes-header">
        <h1>Disputes</h1>
        {!isModerator() && (
          <button onClick={() => setShowCreateForm(true)} className="create-dispute-btn">
            + Create Dispute
          </button>
        )}
      </div>

      {isModerator() && (
        <div className="status-filters">
          <button
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          <button
            className={statusFilter === 'open' ? 'active' : ''}
            onClick={() => setStatusFilter('open')}
          >
            Open
          </button>
          <button
            className={statusFilter === 'investigating' ? 'active' : ''}
            onClick={() => setStatusFilter('investigating')}
          >
            Investigating
          </button>
          <button
            className={statusFilter === 'resolved' ? 'active' : ''}
            onClick={() => setStatusFilter('resolved')}
          >
            Resolved
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="dispute-form-container">
          <h2>Create Dispute</h2>
          <form onSubmit={handleSubmit} className="dispute-form">
            <div className="form-group">
              <label>Trade</label>
              <select
                value={formData.tradeId}
                onChange={(e) => handleTradeSelect(e.target.value)}
                required
              >
                <option value="">Select a trade</option>
                {userTrades.map(trade => (
                  <option key={trade.id} value={trade.id}>
                    Trade #{trade.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                rows={4}
                placeholder="Describe the issue..."
              />
            </div>
            <div className="form-actions">
              <button type="submit">Submit Dispute</button>
              <button type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="empty-disputes">
          <p>No disputes found.</p>
        </div>
      ) : (
        <div className="disputes-list">
          {disputes.map(dispute => (
            <div key={dispute.id} className={`dispute-card status-${dispute.status}`}>
              <div className="dispute-header">
                <div className="dispute-info">
                  <h3>Dispute #{dispute.id}</h3>
                  <span className={`status-badge status-${dispute.status}`}>
                    {dispute.status}
                  </span>
                </div>
                <div className="dispute-parties">
                  <div>
                    <strong>Reporter:</strong> {dispute.reporterUsername}
                  </div>
                  <div>
                    <strong>Accused:</strong> {dispute.accusedUsername}
                  </div>
                </div>
              </div>
              <div className="dispute-content">
                <p><strong>Trade ID:</strong> #{dispute.tradeId}</p>
                <p><strong>Reason:</strong> {dispute.reason}</p>
                {dispute.resolution && (
                  <p><strong>Resolution:</strong> {dispute.resolution}</p>
                )}
                {dispute.moderatorUsername && (
                  <p><strong>Moderator:</strong> {dispute.moderatorUsername}</p>
                )}
                <p className="dispute-date">
                  Created: {new Date(dispute.createdAt).toLocaleString()}
                </p>
              </div>
              {isModerator() && dispute.status !== 'resolved' && dispute.status !== 'dismissed' && (
                <div className="dispute-actions">
                  <button
                    onClick={() => handleStatusUpdate(dispute.id, 'investigating')}
                    className="action-btn investigating"
                  >
                    Mark Investigating
                  </button>
                  <button
                    onClick={() => {
                      const resolution = prompt('Enter resolution:');
                      if (resolution) {
                        handleStatusUpdate(dispute.id, 'resolved', resolution);
                      }
                    }}
                    className="action-btn resolved"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter dismissal reason:');
                      if (reason) {
                        handleStatusUpdate(dispute.id, 'dismissed', reason);
                      }
                    }}
                    className="action-btn dismissed"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Disputes;




