const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');

// Get user notifications
router.get('/', ensureAuth, async (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    let query = 'SELECT * FROM notifications WHERE userId = ?';
    const params = [req.user.discordId];

    if (unreadOnly) {
      query += ' AND isRead = 0';
    }

    query += ' ORDER BY createdAt DESC LIMIT 50';

    const notifications = await dbHelpers.all(query, params);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', ensureAuth, async (req, res) => {
  try {
    await dbHelpers.run(
      'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?',
      [req.params.id, req.user.discordId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all as read
router.patch('/read-all', ensureAuth, async (req, res) => {
  try {
    await dbHelpers.run(
      'UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0',
      [req.user.discordId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', ensureAuth, async (req, res) => {
  try {
    const result = await dbHelpers.get(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0',
      [req.user.discordId]
    );
    res.json({ count: result.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




