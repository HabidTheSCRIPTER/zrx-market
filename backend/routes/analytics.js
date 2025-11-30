const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');

// Helper function for safe JSON parsing
function safeJSONParse(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Get user analytics
router.get('/user', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.discordId;

    // Trade stats
    const tradeStats = await dbHelpers.get(
      `SELECT 
        COUNT(*) as totalTrades,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTrades,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledTrades,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeTrades,
        SUM(viewCount) as totalViews,
        SUM(favoriteCount) as totalFavorites
       FROM trades WHERE creatorId = ?`,
      [userId]
    );

    // Trades by month (last 6 months)
    const tradesByMonth = await dbHelpers.all(
      `SELECT 
        strftime('%Y-%m', createdAt) as month,
        COUNT(*) as count
       FROM trades
       WHERE creatorId = ? AND createdAt >= datetime('now', '-6 months')
       GROUP BY month
       ORDER BY month`,
      [userId]
    );

    // Most traded items
    const allTrades = await dbHelpers.all(
      'SELECT offered, wanted FROM trades WHERE creatorId = ?',
      [userId]
    );

    const itemCounts = {};
    allTrades.forEach(trade => {
      const offered = safeJSONParse(trade.offered);
      const wanted = safeJSONParse(trade.wanted);
      
      [...offered, ...wanted].forEach(item => {
        if (item.name) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
        }
      });
    });

    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // User stats
    const user = await dbHelpers.get(
      'SELECT averageRating, totalRatings FROM users WHERE discordId = ?',
      [userId]
    );

    res.json({
      tradeStats,
      tradesByMonth,
      topItems,
      userStats: {
        averageRating: user?.averageRating || 0,
        totalRatings: user?.totalRatings || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get market analytics (public)
router.get('/market', async (req, res) => {
  try {
    // Total trades
    const totalTrades = await dbHelpers.get(
      'SELECT COUNT(*) as count FROM trades WHERE status = "active"'
    );

    // Most popular items
    const allActiveTrades = await dbHelpers.all(
      'SELECT offered, wanted FROM trades WHERE status = "active"'
    );

    const itemCounts = {};
    allActiveTrades.forEach(trade => {
      const offered = safeJSONParse(trade.offered);
      const wanted = safeJSONParse(trade.wanted);
      
      [...offered, ...wanted].forEach(item => {
        if (item.name) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
        }
      });
    });

    const popularItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    // Trades by category
    const tradesByCategory = await dbHelpers.all(
      `SELECT 
        json_extract(json_each.value, '$.gameCategory') as category,
        COUNT(*) as count
       FROM trades, json_each(trades.offered) as json_each
       WHERE trades.status = 'active'
       GROUP BY category
       ORDER BY count DESC`
    );

    // Price analytics for popular items (last 7 days)
    const priceAnalytics = {};
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrades = await dbHelpers.all(
      `SELECT offered, wanted, createdAt FROM trades 
       WHERE status = 'completed' AND createdAt >= datetime(?, '-7 days')
       ORDER BY createdAt DESC`,
      [sevenDaysAgo.toISOString()]
    );

    // Extract price data for each item
    recentTrades.forEach(trade => {
      const offered = safeJSONParse(trade.offered);
      const wanted = safeJSONParse(trade.wanted);
      
      [...offered, ...wanted].forEach(item => {
        if (item.name && item.value) {
          const itemKey = item.name;
          if (!priceAnalytics[itemKey]) {
            priceAnalytics[itemKey] = {
              prices: [],
              dates: [],
              total: 0,
              count: 0
            };
          }
          
          // Parse value (handle M/s and B/s units)
          let numericValue = parseFloat(item.value);
          if (item.valueUnit === 'B/s') {
            numericValue *= 1000000000; // Convert billions to base units
          } else if (item.valueUnit === 'M/s') {
            numericValue *= 1000000; // Convert millions to base units
          }
          
          if (!isNaN(numericValue) && numericValue > 0) {
            priceAnalytics[itemKey].prices.push(numericValue);
            priceAnalytics[itemKey].dates.push(trade.createdAt);
            priceAnalytics[itemKey].total += numericValue;
            priceAnalytics[itemKey].count += 1;
          }
        }
      });
    });

    // Calculate averages for items with at least 3 data points
    const itemPriceTrends = Object.entries(priceAnalytics)
      .filter(([_, data]) => data.count >= 3)
      .map(([name, data]) => ({
        name,
        averagePrice: data.total / data.count,
        minPrice: Math.min(...data.prices),
        maxPrice: Math.max(...data.prices),
        count: data.count,
        trend: data.prices.length >= 2 
          ? (data.prices[data.prices.length - 1] > data.prices[0] ? 'up' : 'down')
          : 'stable'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totalActiveTrades: totalTrades.count,
      popularItems,
      tradesByCategory,
      priceTrends: itemPriceTrends
    });
  } catch (error) {
    console.error('Error fetching market analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

