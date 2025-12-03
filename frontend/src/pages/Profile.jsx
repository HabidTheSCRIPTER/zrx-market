import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReviewForm from './ReviewForm';
import './Profile.css';

const Profile = () => {
  const { discordId } = useParams();
  const { user: currentUser, showAlert } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewTradeId, setReviewTradeId] = useState(null);

  useEffect(() => {
    if (discordId) {
      fetchProfile();
    } else {
      setError('Invalid user ID');
      setLoading(false);
    }
  }, [discordId]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, reviewsData] = await Promise.all([
        axios.get(`/api/profiles/${discordId}`).catch(err => {
          if (err.response?.status === 404) {
            throw new Error('User not found');
          }
          throw err;
        }),
        axios
          .get(`/api/reviews/user/${discordId}`)
          .then(res => res.data)
          .catch(() => [])
      ]);
      const profileData = profileRes.data;
      if (!profileData || typeof profileData !== 'object') {
        throw new Error('Invalid profile data received');
      }
      setProfile(profileData);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
    } catch (error) {
      console.error('Error fetching profile:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load profile';
      setError(errorMessage);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile">
        <div className="error">{error || 'User not found'}</div>
        <button onClick={fetchProfile} className="retry-btn" style={{ marginTop: '1rem', padding: '10px 20px' }}>Retry</button>
      </div>
    );
  }

  const displayName = profile.username || profile.discordTag || 'Unknown User';
  const profileInitial = displayName?.trim()?.charAt(0)?.toUpperCase() || '?';
  const avatarUrl = typeof profile.avatar === 'string' && profile.avatar.trim() ? profile.avatar : null;
  const recentTrades = Array.isArray(profile.recentTrades) ? profile.recentTrades : [];
  const recentReviews = Array.isArray(profile.recentReviews) ? profile.recentReviews : [];
  const stats = (profile.stats && typeof profile.stats === 'object') ? profile.stats : {};
  const isOwnProfile = currentUser && currentUser.discordId === discordId;

  return (
    <div className="profile">
      <div className="profile-header">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} />
          ) : (
            <div className="avatar-placeholder">{profileInitial}</div>
          )}
        </div>
        <div className="profile-info">
          <h1>{displayName}</h1>
          {profile.verified === 1 && <span className="verified-badge">✓ Verified</span>}
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>
        <div className="profile-stats">
          <div className="stat-box">
            <div className="stat-value">{stats.totalTrades || 0}</div>
            <div className="stat-label">Total Trades</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.completedTrades || 0}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">
              {typeof stats.averageRating === 'number' ? stats.averageRating.toFixed(1) : 'N/A'}
              <span className="rating-stars">
                {'⭐'.repeat(Math.round(stats.averageRating || 0))}
              </span>
            </div>
            <div className="stat-label">Rating</div>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'trades' ? 'active' : ''}
          onClick={() => setActiveTab('trades')}
        >
          Trades
        </button>
        <button
          className={activeTab === 'reviews' ? 'active' : ''}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-section">
              <h2>Recent Trades</h2>
              {recentTrades.length > 0 ? (
                <div className="trades-grid">
                  {recentTrades.map(trade => (
                    <Link key={trade.id} to="/trades" className="trade-card-link">
                      <div className="trade-card-mini">
                        <div className="trade-card-header">
                          <span>Trade #{trade.id}</span>
                          <span className={`status-badge status-${trade.status}`}>
                            {trade.status}
                          </span>
                        </div>
                        <div className="trade-card-items">
                          <div className="trade-items">
                            <strong>Offered:</strong> {Array.isArray(trade.offered) ? trade.offered.slice(0, 2).map(i => i?.name || i).join(', ') : (trade.offered || 'N/A')}
                            {Array.isArray(trade.offered) && trade.offered.length > 2 && ` +${trade.offered.length - 2}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="no-data">No trades yet</p>
              )}
            </div>

            <div className="overview-section">
              <h2>Recent Reviews</h2>
              {recentReviews.length > 0 ? (
                <div className="reviews-list">
                  {recentReviews.map(review => (
                    <div key={review.id} className="review-card">
                      <div className="review-header">
                        <div className="reviewer-info">
                          <img src={review.reviewerAvatar} alt={review.reviewerUsername} className="reviewer-avatar" />
                          <span>{review.reviewerUsername}</span>
                        </div>
                        <div className="review-rating">
                          {'⭐'.repeat(review.rating)}
                        </div>
                      </div>
                      {review.comment && <p className="review-comment">{review.comment}</p>}
                      <small>{new Date(review.createdAt).toLocaleDateString()}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No reviews yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="trades-tab">
            <TradesList userId={discordId} />
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-tab">
            {!isOwnProfile && currentUser && (
              <button
                onClick={() => {
                  // Find a completed trade with this user to review
                  const completedTrade = recentTrades.find(t => t.status === 'completed');
                  if (completedTrade) {
                    setReviewTradeId(completedTrade.id);
                    setShowReviewForm(true);
                  } else {
                    showAlert('You can only review users after completing a trade with them.', 'warning');
                  }
                }}
                className="add-review-btn"
              >
                Leave a Review
              </button>
            )}
            {reviews.length > 0 ? (
              <div className="reviews-list">
                {reviews.map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="reviewer-info">
                        <img src={review.avatar} alt={review.username} className="reviewer-avatar" />
                        <span>{review.username}</span>
                      </div>
                      <div className="review-rating">
                        {'⭐'.repeat(review.rating)}
                      </div>
                    </div>
                    {review.comment && <p className="review-comment">{review.comment}</p>}
                    <small>{new Date(review.createdAt).toLocaleDateString()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No reviews yet</p>
            )}
          </div>
        )}
      </div>

      {showReviewForm && (
        <ReviewForm
          tradeId={reviewTradeId}
          revieweeId={discordId}
          revieweeUsername={displayName}
          onClose={() => {
            setShowReviewForm(false);
            setReviewTradeId(null);
          }}
          onSuccess={() => {
            fetchProfile();
            setShowReviewForm(false);
            setReviewTradeId(null);
          }}
        />
      )}
    </div>
  );
};

const TradesList = ({ userId }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchTrades();
  }, [userId, page]);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/profiles/${userId}/trades?page=${page}`);
      const tradesData = response.data?.trades;
      const pagination = response.data?.pagination;
      setTrades(Array.isArray(tradesData) ? tradesData : []);
      setTotalPages(
        typeof pagination?.totalPages === 'number' && pagination.totalPages > 0
          ? pagination.totalPages
          : 1
      );
    } catch (error) {
      console.error('Error fetching trades:', error);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading trades...</div>;

  return (
    <>
      <div className="trades-grid">
        {trades.map(trade => (
          <Link key={trade.id} to="/trades" className="trade-card-link">
            <div className="trade-card-mini">
              <div className="trade-card-header">
                <span>Trade #{trade.id}</span>
                <span className={`status-badge status-${trade.status}`}>
                  {trade.status}
                </span>
              </div>
              <div className="trade-card-items">
                <div className="trade-items">
                  <strong>Offered:</strong> {Array.isArray(trade.offered) ? trade.offered.slice(0, 2).map(i => i?.name || i).join(', ') : (trade.offered || 'N/A')}
                  {Array.isArray(trade.offered) && trade.offered.length > 2 && ` +${trade.offered.length - 2}`}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </>
  );
};

export default Profile;

