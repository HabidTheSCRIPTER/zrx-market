import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Trades.css';

const Trades = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTrades();
  }, [page, search]);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/trades', {
        params: { page, limit: 20, search }
      });
      setTrades(response.data.trades || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching trades:', error);
      // Set empty state on error to prevent crashes
      setTrades([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (tradeId) => {
    const link = `${window.location.origin}/trades/${tradeId}`;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="trades">
      <h1>Trading Hub</h1>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search trades..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {loading ? (
        <div className="loading">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="no-trades">No trades found.</div>
      ) : (
        <>
          <div className="trades-grid">
            {trades.map((trade) => (
              <div key={trade.id} className="trade-card">
                <div className="trade-header">
                  <div className="trade-user">
                    <img
                      src={trade.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                      alt={trade.username}
                      className="trade-avatar"
                    />
                    <span>{trade.username}</span>
                  </div>
                  <button
                    onClick={() => copyLink(trade.id)}
                    className="copy-link-btn"
                    title="Copy link"
                  >
                    🔗
                  </button>
                </div>
                <div className="trade-content">
                  <div className="trade-section">
                    <strong>Offered:</strong> {trade.offered}
                  </div>

                  <div className="trade-section">
                    <strong>Wanted:</strong> {trade.wanted}
                  </div>
                  {trade.value && (
                    <div className="trade-section">
                      <strong>Value:</strong> {trade.value}
                    </div>
                  )}
                  {trade.notes && (
                    <div className="trade-section">
                      <strong>Notes:</strong> {trade.notes}
                    </div>
                  )}
                  {trade.robloxUsername && (
                    <div className="trade-section">
                      <strong>Roblox:</strong> {trade.robloxUsername}
                    </div>
                  )}
                </div>
                <div className="trade-footer">
                  <small>{new Date(trade.createdAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Trades;


