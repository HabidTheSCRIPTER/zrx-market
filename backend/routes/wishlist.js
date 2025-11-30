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

// Get user's wishlist
router.get('/', ensureAuth, async (req, res) => {
  try {
    const trades = await dbHelpers.all(
      `SELECT t.*, u.username, u.avatar, w.createdAt as favoritedAt
       FROM wishlist w
       JOIN trades t ON w.tradeId = t.id
       JOIN users u ON t.creatorId = u.discordId
       WHERE w.userId = ?
       ORDER BY w.createdAt DESC`,
      [req.user.discordId]
    );

    res.json(trades.map(trade => ({
      ...trade,
      offered: safeJSONParse(trade.offered),
      wanted: safeJSONParse(trade.wanted)
    })));
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to wishlist
router.post('/:tradeId', ensureAuth, async (req, res) => {
  try {
    const trade = await dbHelpers.get(
      'SELECT id FROM trades WHERE id = ?',
      [req.params.tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const existing = await dbHelpers.get(
      'SELECT id FROM wishlist WHERE userId = ? AND tradeId = ?',
      [req.user.discordId, req.params.tradeId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Trade already in wishlist' });
    }

    await dbHelpers.run(
      'INSERT INTO wishlist (userId, tradeId) VALUES (?, ?)',
      [req.user.discordId, req.params.tradeId]
    );

    res.json({ message: 'Added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from wishlist
router.delete('/:tradeId', ensureAuth, async (req, res) => {
  try {
    await dbHelpers.run(
      'DELETE FROM wishlist WHERE userId = ? AND tradeId = ?',
      [req.user.discordId, req.params.tradeId]
    );

    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




