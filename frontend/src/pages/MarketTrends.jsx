import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MarketTrends.css';

const MarketTrends = () => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/analytics/market');
      setMarketData(response.data || {});
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketData({});
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="market-trends-page">
        <h1>Market Trends</h1>
        <div className="loading">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="market-trends-page">
      <h1>Market Trends & Statistics</h1>

      <div className="market-stats-grid">
        <div className="stat-card">
          <h2>Active Trades</h2>
          <div className="stat-value">{marketData?.totalActiveTrades || 0}</div>
          <p className="stat-description">Currently available trades</p>
        </div>
      </div>

      <div className="trends-section">
        <h2>Most Popular Items</h2>
        {Array.isArray(marketData?.popularItems) && marketData.popularItems.length > 0 ? (
          <div className="popular-items-list">
            {marketData.popularItems.map((item, index) => (
              <div key={index} className="popular-item">
                <span className="item-rank">#{index + 1}</span>
                <span className="item-name">{item.name}</span>
                <span className="item-count">{item.count} trades</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No data available</p>
        )}
      </div>

      <div className="trends-section">
        <h2>Trades by Category</h2>
        {Array.isArray(marketData?.tradesByCategory) && marketData.tradesByCategory.length > 0 ? (
          <div className="category-stats">
            {marketData.tradesByCategory.map((cat, index) => (
              <div key={index} className="category-stat">
                <span className="category-name">{cat.category || 'Unknown'}</span>
                <div className="category-bar">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${(cat.count / marketData.totalActiveTrades) * 100}%` }}
                  />
                </div>
                <span className="category-count">{cat.count} trades</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No data available</p>
        )}
      </div>

      <div className="trends-section">
        <h2>Price Trends (Last 7 Days)</h2>
        <p className="section-description">Average trading prices for popular items based on completed trades</p>
        {Array.isArray(marketData?.priceTrends) && marketData.priceTrends.length > 0 ? (
          <div className="price-trends-list">
            {marketData.priceTrends.map((trend, index) => (
              <div key={index} className="price-trend-card">
                <div className="price-trend-header">
                  <h3>{trend.name}</h3>
                  <span className={`trend-badge trend-${trend.trend}`}>
                    {trend.trend === 'up' ? '📈' : trend.trend === 'down' ? '📉' : '➡️'} {trend.trend}
                  </span>
                </div>
                <div className="price-trend-stats">
                  <div className="price-stat">
                    <span className="price-label">Average:</span>
                    <span className="price-value">{formatPrice(trend.averagePrice)}</span>
                  </div>
                  <div className="price-stat">
                    <span className="price-label">Range:</span>
                    <span className="price-value">
                      {formatPrice(trend.minPrice)} - {formatPrice(trend.maxPrice)}
                    </span>
                  </div>
                  <div className="price-stat">
                    <span className="price-label">Trades:</span>
                    <span className="price-value">{trend.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">Not enough price data available yet. Check back later!</p>
        )}
      </div>
    </div>
  );
};

const formatPrice = (price) => {
  if (price >= 1000000000) {
    return `${(price / 1000000000).toFixed(2)}B/s`;
  } else if (price >= 1000000) {
    return `${(price / 1000000).toFixed(2)}M/s`;
  } else {
    return `${price.toFixed(0)}`;
  }
};

export default MarketTrends;
