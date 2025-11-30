const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');

// Get all users
router.get('/', ensureAuth, async (req, res) => {
  try {
    const users = await dbHelpers.all('SELECT discordId, username, avatar FROM users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by Discord ID
router.get('/:discordId', ensureAuth, async (req, res) => {
  try {
    const user = await dbHelpers.get(
      'SELECT discordId, username, avatar FROM users WHERE discordId = ?',
      [req.params.discordId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
