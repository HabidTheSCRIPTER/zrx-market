import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import './Admin.css';

const Admin = () => {
  const { isModerator, openMessageOverlay, user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [verifyDiscordId, setVerifyDiscordId] = useState('');
  const [blacklistData, setBlacklistData] = useState({ discordId: '', reason: '' });
  const [discordEmbedData, setDiscordEmbedData] = useState({
    channelId: '',
    title: '',
    description: '',
    imageUrl: '',
    color: '#5865F2',
    mentionUserId: ''
  });
  const [sendingEmbed, setSendingEmbed] = useState(false);

  useEffect(() => {
    if (isModerator()) {
      fetchData();
      
      // Check URL parameters for auto-opening chat
      const params = new URLSearchParams(location.search);
      if (params.get('chat') === 'true' && params.get('accusedId')) {
        const reportId = params.get('reportId');
        const accusedId = params.get('accusedId');
        
        // Fetch user info and open chat
        handleChatWithAccusedFromUrl(accusedId, reportId);
      }
    }
  }, [isModerator, activeTab, location.search]);
  
  const handleChatWithAccusedFromUrl = async (accusedId, reportId) => {
    try {
      const response = await axios.get(`/api/users/${accusedId}`);
      const accusedUser = response.data;
      
      if (accusedUser) {
        openMessageOverlay({
          discordId: accusedUser.discordId,
          username: accusedUser.username,
          avatar: accusedUser.avatar
        }, null); // null for tradeId since this is for a report
        
        // Switch to reports tab if not already there
        if (activeTab !== 'reports') {
          setActiveTab('reports');
        }
      }
    } catch (error) {
      console.error('Error opening chat from URL:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'users':
          // Users would need a separate endpoint or be fetched from trades/middleman
          break;
        case 'reports':
          const reportsRes = await axios.get('/api/reports');
          setReports(reportsRes.data);
          break;
        case 'blacklist':
          const blacklistRes = await axios.get('/api/admin/blacklist');
          setBlacklist(blacklistRes.data);
          break;
        case 'logs':
          const logsRes = await axios.get('/api/admin/logs');
          setLogs(logsRes.data.logs);
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (discordId, verified) => {
    try {
      await axios.post('/api/admin/verify-user', { discordId, verified });
      setMessage(`User ${verified ? 'verified' : 'unverified'} successfully`);
      setVerifyDiscordId('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error updating verification');
    }
  };

  const handleBlacklist = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/blacklist', blacklistData);
      setMessage('User blacklisted successfully');
      setBlacklistData({ discordId: '', reason: '' });
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error blacklisting user');
    }
  };

  const handleRemoveBlacklist = async (discordId) => {
    try {
      await axios.delete(`/api/admin/blacklist/${discordId}`);
      setMessage('User removed from blacklist');
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error removing from blacklist');
    }
  };

  const updateReportStatus = async (id, status) => {
    try {
      await axios.patch(`/api/reports/${id}/status`, { status });
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error updating report');
    }
  };

  const handleChatWithAccused = async (report) => {
    try {
      // First, check if bridge session exists, if not create it
      let session;
      try {
        const sessionRes = await axios.get(`/api/discord-bridge/session/${report.id}`);
        session = sessionRes.data;
      } catch (error) {
        // Session doesn't exist, create it
        if (error.response?.status === 404) {
          const initRes = await axios.post('/api/discord-bridge/initialize', {
            reportId: report.id,
            accusedDiscordId: report.accusedDiscordId
          });
          session = initRes.data;
          setMessage('Discord bridge initialized! Messages will sync between website and Discord.');
          setTimeout(() => setMessage(''), 5000);
        } else {
          throw error;
        }
      }

      // Fetch accused user info
      const response = await axios.get(`/api/users/${report.accusedDiscordId}`);
      const accusedUser = response.data;
      
      if (accusedUser) {
        // Store reportId in context or pass it somehow so messages know it's bridged
        openMessageOverlay(
          {
            discordId: accusedUser.discordId,
            username: accusedUser.username,
            avatar: accusedUser.avatar
          },
          null, // null for tradeId since this is for a report
          report.id, // reportId for bridged conversations
          true // isBridged
        );
      } else {
        setMessage('Could not find user information for the accused person.');
      }
    } catch (error) {
      console.error('Error initializing chat with accused:', error);
      setMessage(error.response?.data?.error || 'Error: Could not initialize chat.');
    }
  };

  const handleRequestMoreInfo = async (reportId) => {
    try {
      await axios.post(`/api/reports/${reportId}/request-info`);
      setMessage('More info requested. The reporter will be notified.');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error requesting more info');
    }
  };

  if (!isModerator()) {
    return <div className="admin">You must be a moderator to access this page.</div>;
  }

  return (
    <div className="admin">
      <h1>Admin Panel</h1>
      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      <div className="admin-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Verify Users
        </button>
        <button
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
        <button
          className={activeTab === 'blacklist' ? 'active' : ''}
          onClick={() => setActiveTab('blacklist')}
        >
          Blacklist
        </button>
        <button
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          Activity Logs
        </button>
        <button
          className={activeTab === 'discord' ? 'active' : ''}
          onClick={() => setActiveTab('discord')}
        >
          Discord Messages
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="admin-section">
          <h2>Verify/Unverify User</h2>
          <div className="verify-form">
            <input
              type="text"
              placeholder="Discord ID"
              value={verifyDiscordId}
              onChange={(e) => setVerifyDiscordId(e.target.value)}
            />
            <button onClick={() => handleVerify(verifyDiscordId, true)}>
              Verify
            </button>
            <button onClick={() => handleVerify(verifyDiscordId, false)}>
              Unverify
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="admin-section">
          <h2>Scammer Reports</h2>
          {loading ? (
            <div className="loading">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="no-data">No reports found.</div>
          ) : (
            <div className="reports-list">
              {reports.map((report) => (
                <div key={report.id} className="report-card">
                  <div className="report-header">
                    <h3>Report #{report.id}</h3>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status}
                    </span>
                  </div>
                  <p><strong>Reporter:</strong> {report.reporterUsername}</p>
                  <p><strong>Accused:</strong> {report.accusedDiscordId}</p>
                  <p><strong>Details:</strong> {report.details}</p>
                  {report.evidenceLinks && (
                    <div>
                      <strong>Evidence:</strong>
                      <ul>
                        {JSON.parse(report.evidenceLinks).map((link, idx) => (
                          <li key={idx}>
                            <a href={link} target="_blank" rel="noopener noreferrer">
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="report-actions">
                    <button 
                      className="chat-accused-btn"
                      onClick={() => handleChatWithAccused(report)}
                    >
                      💬 Chat with Accused
                    </button>
                    <button 
                      className="request-info-btn"
                      onClick={() => handleRequestMoreInfo(report.id)}
                    >
                      ℹ️ Request More Info
                    </button>
                    <button onClick={() => updateReportStatus(report.id, 'reviewed')}>
                      Mark Reviewed
                    </button>
                    <button onClick={() => updateReportStatus(report.id, 'resolved')}>
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'blacklist' && (
        <div className="admin-section">
          <h2>Blacklist Management</h2>
          <form onSubmit={handleBlacklist} className="blacklist-form">
            <input
              type="text"
              placeholder="Discord ID"
              value={blacklistData.discordId}
              onChange={(e) => setBlacklistData({ ...blacklistData, discordId: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Reason"
              value={blacklistData.reason}
              onChange={(e) => setBlacklistData({ ...blacklistData, reason: e.target.value })}
              required
            />
            <button type="submit">Add to Blacklist</button>
          </form>
          {blacklist.length > 0 && (
            <div className="blacklist-list">
              {blacklist.map((item) => (
                <div key={item.discordId} className="blacklist-item">
                  <div>
                    <strong>{item.discordId}</strong>
                    <p>{item.reason}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </div>
                  <button onClick={() => handleRemoveBlacklist(item.discordId)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="admin-section">
          <h2>Activity Logs</h2>
          {loading ? (
            <div className="loading">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="no-data">No logs found.</div>
          ) : (
            <div className="logs-list">
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  <div className="log-header">
                    <strong>{log.actorUsername || log.actorId}</strong>
                    <span className="log-action">{log.action}</span>
                  </div>
                  {log.targetId && <p>Target: {log.targetId}</p>}
                  {log.details && <p>Details: {log.details}</p>}
                  <small>{new Date(log.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'discord' && (
        <div className="admin-section">
          <h2>Send Discord Embed Message</h2>
          <form 
            className="discord-embed-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSendingEmbed(true);
              setMessage('');
              try {
                const response = await axios.post('/api/admin/send-discord-embed', discordEmbedData);
                setMessage(`✅ ${response.data.message} (Message ID: ${response.data.messageId})`);
                setDiscordEmbedData({
                  channelId: '',
                  title: '',
                  description: '',
                  imageUrl: '',
                  color: '#5865F2',
                  mentionUserId: ''
                });
                setTimeout(() => setMessage(''), 5000);
              } catch (error) {
                setMessage(`❌ Error: ${error.response?.data?.error || error.message}`);
                setTimeout(() => setMessage(''), 5000);
              } finally {
                setSendingEmbed(false);
              }
            }}
          >
            <div className="form-group">
              <label>Channel ID *</label>
              <input
                type="text"
                value={discordEmbedData.channelId}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, channelId: e.target.value })}
                placeholder="1387655173782114375"
                required
              />
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={discordEmbedData.title}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, title: e.target.value })}
                placeholder="🛒 Store Item"
              />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea
                value={discordEmbedData.description}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, description: e.target.value })}
                placeholder="Buy this **spaghetti tualetti diamond with shark mutation**&#10;**250 M/s** for **25 USD**&#10;&#10;DM <@909463977787015228>"
                rows="6"
                required
              />
              <small className="form-hint">Supports Discord markdown (**, *, `, etc.)</small>
            </div>
            <div className="form-group">
              <label>Image URL</label>
              <input
                type="url"
                value={discordEmbedData.imageUrl}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, imageUrl: e.target.value })}
                placeholder="https://bloxystore.com/cdn/shop/files/spageh.png"
              />
            </div>
            <div className="form-group">
              <label>Color (Hex)</label>
              <input
                type="text"
                value={discordEmbedData.color}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, color: e.target.value })}
                placeholder="#5865F2"
                pattern="#[0-9A-Fa-f]{6}"
              />
            </div>
            <div className="form-group">
              <label>Mention User ID (optional)</label>
              <input
                type="text"
                value={discordEmbedData.mentionUserId}
                onChange={(e) => setDiscordEmbedData({ ...discordEmbedData, mentionUserId: e.target.value })}
                placeholder="909463977787015228"
              />
              <small className="form-hint">Will mention this user at the start of the message</small>
            </div>
            <button type="submit" disabled={sendingEmbed} className="submit-btn">
              {sendingEmbed ? 'Sending...' : 'Send Embed Message'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Admin;

