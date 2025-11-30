const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');

// Get user profile
router.get('/:discordId', async (req, res) => {
  try {
    const user = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [req.params.discordId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's trade stats
    const tradeStats = await dbHelpers.get(
      `SELECT 
        COUNT(*) as totalTrades,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTrades,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledTrades,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeTrades
       FROM trades WHERE creatorId = ?`,
      [req.params.discordId]
    );

    // Get recent reviews
    const reviews = await dbHelpers.all(
      `SELECT r.*, u.username as reviewerUsername, u.avatar as reviewerAvatar
       FROM trade_reviews r
       JOIN users u ON r.reviewerId = u.discordId
       WHERE r.revieweeId = ?
       ORDER BY r.createdAt DESC
       LIMIT 10`,
      [req.params.discordId]
    );

    // Get recent trades
    const recentTrades = await dbHelpers.all(
      `SELECT id, offered, wanted, status, createdAt
       FROM trades
       WHERE creatorId = ?
       ORDER BY createdAt DESC
       LIMIT 10`,
      [req.params.discordId]
    );

    res.json({
      ...user,
      stats: {
        ...tradeStats,
        averageRating: user.averageRating || 0,
        totalRatings: user.totalRatings || 0
      },
      recentReviews: reviews,
      recentTrades: recentTrades.map(t => ({
        ...t,
        offered: JSON.parse(t.offered || '[]'),
        wanted: JSON.parse(t.wanted || '[]')
      }))
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile (bio)
router.patch('/:discordId', ensureAuth, async (req, res) => {
  try {
    if (req.user.discordId !== req.params.discordId) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

    const { bio } = req.body;
    await dbHelpers.run(
      'UPDATE users SET bio = ? WHERE discordId = ?',
      [bio || null, req.params.discordId]
    );

    const user = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [req.params.discordId]
    );

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's trade history
router.get('/:discordId/trades', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let query = 'SELECT * FROM trades WHERE creatorId = ?';
    const params = [req.params.discordId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const trades = await dbHelpers.all(query, params);

    const countResult = await dbHelpers.get(
      `SELECT COUNT(*) as total FROM trades WHERE creatorId = ?${status ? ' AND status = ?' : ''}`,
      status ? [req.params.discordId, status] : [req.params.discordId]
    );

    res.json({
      trades: trades.map(t => ({
        ...t,
        offered: JSON.parse(t.offered || '[]'),
        wanted: JSON.parse(t.wanted || '[]')
      })),
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user trades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




