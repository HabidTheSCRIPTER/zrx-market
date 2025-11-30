import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Reports.css';

const Reports = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    tradeId: '',
    accusedDiscordId: '',
    evidenceImages: []
  });
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user]);

  const fetchTrades = async () => {
    try {
      setLoadingTrades(true);
      const response = await axios.get('/api/trades/user/involved');
      setTrades(response.data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      setMessage('Error loading trades. Please refresh the page.');
      setTrades([]);
    } finally {
      setLoadingTrades(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setFormData({ ...formData, evidenceImages: files });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!formData.tradeId) {
      setMessage('Please select a trade');
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('tradeId', formData.tradeId);
      formDataToSend.append('accusedDiscordId', formData.accusedDiscordId);
      
      formData.evidenceImages.forEach((file) => {
        formDataToSend.append('evidenceImages', file);
      });

      await axios.post('/api/reports', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setMessage('Report submitted successfully!');
      setFormData({
        tradeId: '',
        accusedDiscordId: '',
        evidenceImages: []
      });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error submitting report');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="reports">Please log in to submit a report.</div>;
  }

  return (
    <div className="reports">
      <h1>Report a Scammer</h1>
      <p className="description">
        Help keep the community safe by reporting scammers. You can only report someone you have messaged or traded with.
      </p>
      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      {loadingTrades ? (
        <div className="loading">Loading your trades...</div>
      ) : trades.length === 0 ? (
        <div className="no-interactions">
          <p>You haven't created or been involved in any trades yet. You can only report someone after you've been involved in a trade with them.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label>Select Trade *</label>
            <select
              value={formData.tradeId}
              onChange={(e) => {
                const selectedTrade = trades.find(t => t.id === parseInt(e.target.value));
                setFormData({ 
                  ...formData, 
                  tradeId: e.target.value,
                  accusedDiscordId: selectedTrade ? (selectedTrade.creatorId === user.discordId ? '' : selectedTrade.creatorId) : ''
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
            <p className="form-hint">
              Select the trade where the issue occurred
            </p>
          </div>
          <div className="form-group">
            <label>Evidence Images *</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              required
            />
            {formData.evidenceImages.length > 0 && (
              <p className="form-hint">{formData.evidenceImages.length} image(s) selected</p>
            )}
          </div>
          <button type="submit" disabled={loading || !formData.tradeId} className="submit-btn">
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Reports;

