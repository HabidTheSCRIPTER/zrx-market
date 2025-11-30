const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Create review
router.post('/', ensureAuth, formLimiter, async (req, res) => {
  try {
    const { tradeId, revieweeId, rating, comment } = req.body;
    const reviewerId = req.user.discordId;

    if (!tradeId || !revieweeId || !rating) {
      return res.status(400).json({ error: 'Trade ID, reviewee ID, and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (reviewerId === revieweeId) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }

    // Check if trade exists and user participated
    const trade = await dbHelpers.get(
      'SELECT * FROM trades WHERE id = ?',
      [tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user participated in the trade
    const participated = await dbHelpers.get(
      'SELECT id FROM messages WHERE tradeId = ? AND (senderId = ? OR recipientId = ?) LIMIT 1',
      [tradeId, reviewerId, reviewerId]
    );

    if (trade.creatorId !== reviewerId && !participated) {
      return res.status(403).json({ error: 'You can only review trades you participated in' });
    }

    // Check if review already exists
    const existing = await dbHelpers.get(
      'SELECT id FROM trade_reviews WHERE tradeId = ? AND reviewerId = ? AND revieweeId = ?',
      [tradeId, reviewerId, revieweeId]
    );

    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this user for this trade' });
    }

    // Create review
    await dbHelpers.run(
      'INSERT INTO trade_reviews (tradeId, reviewerId, revieweeId, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [tradeId, reviewerId, revieweeId, rating, comment || null]
    );

    // Update reviewee's average rating
    const reviews = await dbHelpers.all(
      'SELECT rating FROM trade_reviews WHERE revieweeId = ?',
      [revieweeId]
    );

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await dbHelpers.run(
      'UPDATE users SET averageRating = ?, totalRatings = ? WHERE discordId = ?',
      [avgRating, reviews.length, revieweeId]
    );

    res.status(201).json({ message: 'Review created successfully' });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reviews for a user
router.get('/user/:discordId', async (req, res) => {
  try {
    const reviews = await dbHelpers.all(
      `SELECT r.*, u.username, u.avatar, t.id as tradeId
       FROM trade_reviews r
       JOIN users u ON r.reviewerId = u.discordId
       LEFT JOIN trades t ON r.tradeId = t.id
       WHERE r.revieweeId = ?
       ORDER BY r.createdAt DESC`,
      [req.params.discordId]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




