import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { getBrainrotImage } from '../utils/tradeConstants';
import './Wishlist.css';

const Wishlist = () => {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user]);

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/wishlist');
      setWishlist(response.data);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (tradeId) => {
    try {
      await axios.delete(`/api/wishlist/${tradeId}`);
      setWishlist(prev => prev.filter(trade => trade.id !== tradeId));
      showToast('Removed from wishlist', 'success');
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      showToast(error.response?.data?.error || 'Failed to remove from wishlist', 'error');
    }
  };

  if (!user) {
    return (
      <div className="wishlist-page">
        <h1>Wishlist</h1>
        <p>Please log in to view your wishlist.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wishlist-page">
        <h1>My Wishlist</h1>
        <div className="loading">Loading wishlist...</div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <h1>My Wishlist</h1>
      {wishlist.length === 0 ? (
        <div className="empty-wishlist">
          <p>Your wishlist is empty.</p>
          <Link to="/trades" className="browse-trades-btn">
            Browse Trades
          </Link>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map(trade => (
            <div 
              key={trade.id} 
              className="wishlist-card"
              onClick={() => navigate('/trades')}
              style={{ cursor: 'pointer' }}
            >
              <div className="wishlist-card-header" onClick={(e) => e.stopPropagation()}>
                <Link to={`/profile/${trade.creatorId}`} className="trade-creator" onClick={(e) => e.stopPropagation()}>
                  <img src={trade.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt={trade.username} />
                  <span>{trade.username}</span>
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWishlist(trade.id);
                  }}
                  className="remove-btn"
                  title="Remove from wishlist"
                >
                  ×
                </button>
              </div>
              <div className="wishlist-card-content">
                <div className="trade-section">
                  <strong>Offered:</strong>
                  <div className="items-list">
                    {trade.offered?.map((item, i) => {
                      const isBrainrot = item.gameCategory === 'STEAL A BRAINROT';
                      const itemImage = isBrainrot ? getBrainrotImage(item.name) : null;
                      return (
                        <div key={i} className="item-tag">
                          {itemImage && (
                            <img 
                              src={itemImage} 
                              alt={item.name}
                              className="item-tag-image"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <span>{item.name}</span>
                          {item.value && <span> ({item.value} {item.valueUnit || ''})</span>}
                          {item.gameCategory && <span className="category-badge">{item.gameCategory}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="trade-section">
                  <strong>Wanted:</strong>
                  <div className="items-list">
                    {trade.wanted?.map((item, i) => {
                      const isBrainrot = item.gameCategory === 'STEAL A BRAINROT';
                      const itemImage = isBrainrot ? getBrainrotImage(item.name) : null;
                      return (
                        <div key={i} className="item-tag">
                          {itemImage && (
                            <img 
                              src={itemImage} 
                              alt={item.name}
                              className="item-tag-image"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <span>{item.name}</span>
                          {item.value && <span> ({item.value} {item.valueUnit || ''})</span>}
                          {item.gameCategory && <span className="category-badge">{item.gameCategory}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="wishlist-card-footer" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => removeFromWishlist(trade.id)}
                  className="remove-from-wishlist-btn"
                  title="Remove from wishlist"
                >
                  Remove
                </button>
                <span className="favorited-date">
                  Added {new Date(trade.favoritedAt || trade.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;




