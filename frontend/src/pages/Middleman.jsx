import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Middleman.css';

const Middleman = () => {
  const { isModerator, showAlert } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    if (isModerator()) {
      fetchRequests();
    }
  }, [isModerator, statusFilter]);

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
      showAlert(error.response?.data?.error || 'Error updating status', 'error');
    }
  };

  if (!isModerator()) {
    return (
      <div className="middleman">
        <h1>Middleman Requests</h1>
        <p>You must be a moderator to view this page.</p>
      </div>
    );
  }

  return (
    <div className="middleman">
      <h1>Middleman Requests</h1>
      <div className="status-filter">
        <button
          className={statusFilter === 'pending' ? 'active' : ''}
          onClick={() => setStatusFilter('pending')}
        >
          Pending
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
    </div>
  );
};

export default Middleman;

