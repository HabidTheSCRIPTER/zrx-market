import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else {
      // If no user but we're on dashboard, check auth again
      setLoading(false);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [analyticsRes, tradesRes, favoritesRes] = await Promise.allSettled([
        axios.get('/api/analytics/user'),
        axios.get(`/api/trades?creatorId=${user.discordId}&limit=5`),
        axios.get('/api/wishlist')
      ]);

      // Handle analytics
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data);
      } else {
        console.warn('Failed to load analytics:', analyticsRes.reason);
      }

      // Handle trades
      if (tradesRes.status === 'fulfilled') {
        let trades = tradesRes.value.data.trades || tradesRes.value.data || [];
        // Ensure it's an array and parse JSON strings
        if (!Array.isArray(trades)) {
          trades = [];
        }
        // Parse JSON strings for offered/wanted if needed
        trades = trades.map(trade => ({
          ...trade,
          offered: typeof trade.offered === 'string' ? JSON.parse(trade.offered) : (Array.isArray(trade.offered) ? trade.offered : []),
          wanted: typeof trade.wanted === 'string' ? JSON.parse(trade.wanted) : (Array.isArray(trade.wanted) ? trade.wanted : [])
        }));
        setRecentTrades(trades.slice(0, 5));
      } else {
        console.warn('Failed to load trades:', tradesRes.reason);
        setRecentTrades([]); // Set empty array on error
      }

      // Handle favorites
      if (favoritesRes.status === 'fulfilled') {
        let favorites = favoritesRes.value.data || [];
        // Ensure it's an array
        if (!Array.isArray(favorites)) {
          favorites = [];
        }
        // Parse JSON strings for offered/wanted if needed
        favorites = favorites.map(trade => ({
          ...trade,
          offered: typeof trade.offered === 'string' ? JSON.parse(trade.offered) : (Array.isArray(trade.offered) ? trade.offered : []),
          wanted: typeof trade.wanted === 'string' ? JSON.parse(trade.wanted) : (Array.isArray(trade.wanted) ? trade.wanted : [])
        }));
        setFavorites(favorites.slice(0, 5));
      } else {
        console.warn('Failed to load favorites:', favoritesRes.reason);
        setFavorites([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set defaults on complete failure
      setAnalytics(null);
      setRecentTrades([]);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1>My Dashboard</h1>

      <div className="dashboard-grid">
        <div className="dashboard-card stats-card">
          <h2>Trade Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{analytics?.tradeStats?.totalTrades || 0}</div>
              <div className="stat-label">Total Trades</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{analytics?.tradeStats?.completedTrades || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{analytics?.tradeStats?.activeTrades || 0}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{analytics?.tradeStats?.totalViews || 0}</div>
              <div className="stat-label">Total Views</div>
            </div>
          </div>
        </div>

        <div className="dashboard-card rating-card">
          <h2>Reputation</h2>
          <div className="rating-display">
            <div className="rating-value">
              {analytics?.userStats?.averageRating?.toFixed(1) || 'N/A'}
              <span className="rating-stars">
                {'⭐'.repeat(Math.round(analytics?.userStats?.averageRating || 0))}
              </span>
            </div>
            <div className="rating-count">
              {analytics?.userStats?.totalRatings || 0} reviews
            </div>
          </div>
        </div>

        {analytics?.topItems && Array.isArray(analytics.topItems) && analytics.topItems.length > 0 && (
          <div className="dashboard-card top-items-card">
            <h2>Your Most Traded Items</h2>
            <div className="top-items-list">
              {analytics.topItems.slice(0, 5).map((item, index) => (
                <div key={index} className="top-item">
                  <span className="item-rank">#{index + 1}</span>
                  <span className="item-name">{item?.name || item}</span>
                  <span className="item-count">{item?.count || 0}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-card recent-trades-card">
          <h2>Recent Trades</h2>
          {recentTrades.length === 0 ? (
            <p className="no-data">No trades yet</p>
          ) : (
            <div className="trades-list">
              {recentTrades.map(trade => (
                <Link key={trade.id} to={`/trades`} className="trade-item-link">
                  <div className="trade-item">
                    <div className="trade-item-header">
                      <span className="trade-id">#{trade.id}</span>
                      <span className={`status-badge status-${trade.status}`}>
                        {trade.status}
                      </span>
                    </div>
                    <div className="trade-item-content">
                      {Array.isArray(trade.offered) && trade.offered.slice(0, 2).map((item, i) => (
                        <span key={i} className="trade-item-name">{item?.name || item}</span>
                      ))}
                      {Array.isArray(trade.offered) && trade.offered.length > 2 && <span>+{trade.offered.length - 2} more</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to={`/profile/${user.discordId}/trades`} className="view-all-link">
            View All Trades →
          </Link>
        </div>

        <div className="dashboard-card favorites-card">
          <h2>Favorites</h2>
          {favorites.length === 0 ? (
            <p className="no-data">No favorites yet</p>
          ) : (
            <div className="favorites-list">
              {favorites.map(trade => (
                <Link key={trade.id} to={`/trades`} className="trade-item-link">
                  <div className="trade-item">
                    <div className="trade-item-header">
                      <span className="trade-id">#{trade.id}</span>
                    </div>
                    <div className="trade-item-content">
                      {Array.isArray(trade.offered) && trade.offered.slice(0, 2).map((item, i) => (
                        <span key={i} className="trade-item-name">{item?.name || item}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/wishlist" className="view-all-link">
            View All Favorites →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
