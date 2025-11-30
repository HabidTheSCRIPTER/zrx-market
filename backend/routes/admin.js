const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Verify/Unverify user
router.post('/verify-user', ensureAuth, ensureModerator, formLimiter, async (req, res) => {
  try {
    const { discordId, verified } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified must be a boolean' });
    }

    await dbHelpers.run(
      'UPDATE users SET verified = ? WHERE discordId = ?',
      [verified ? 1 : 0, discordId]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, verified ? 'verify_user' : 'unverify_user', discordId, '']
    );

    const user = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [discordId]
    );

    res.json(user);
  } catch (error) {
    console.error('Error updating user verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Blacklist user
router.post('/blacklist', ensureAuth, ensureModerator, formLimiter, async (req, res) => {
  try {
    const { discordId, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    await dbHelpers.run(
      'INSERT OR REPLACE INTO blacklist (discordId, reason) VALUES (?, ?)',
      [discordId, reason]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'blacklist_user', discordId, reason]
    );

    res.json({ message: 'User blacklisted successfully' });
  } catch (error) {
    console.error('Error blacklisting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from blacklist
router.delete('/blacklist/:discordId', ensureAuth, ensureModerator, async (req, res) => {
  try {
    await dbHelpers.run(
      'DELETE FROM blacklist WHERE discordId = ?',
      [req.params.discordId]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'unblacklist_user', req.params.discordId, '']
    );

    res.json({ message: 'User removed from blacklist' });
  } catch (error) {
    console.error('Error removing from blacklist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin logs
router.get('/logs', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const logs = await dbHelpers.all(
      `SELECT l.*, u.username as actorUsername FROM admin_logs l
       LEFT JOIN users u ON l.actorId = u.discordId
       ORDER BY l.createdAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countResult = await dbHelpers.get(
      'SELECT COUNT(*) as total FROM admin_logs'
    );

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get blacklist
router.get('/blacklist', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const blacklist = await dbHelpers.all(
      'SELECT * FROM blacklist ORDER BY createdAt DESC'
    );
    res.json(blacklist);
  } catch (error) {
    console.error('Error fetching blacklist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send Discord embed message
router.post('/send-discord-embed', ensureAuth, ensureModerator, formLimiter, async (req, res) => {
  try {
    const { channelId, title, description, imageUrl, color, mentionUserId } = req.body;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: 'Discord bot token not configured' });
    }

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    const embed = {
      color: color ? parseInt(color.replace('#', ''), 16) : 0x5865F2,
      timestamp: new Date().toISOString()
    };

    if (title) embed.title = title;
    if (description) embed.description = description;
    if (imageUrl) embed.image = { url: imageUrl };

    let content = '';
    if (mentionUserId) {
      content = `<@${mentionUserId}>`;
    }

    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        content: content || undefined,
        embeds: [embed]
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'send_discord_embed', channelId, JSON.stringify({ title, description, imageUrl })]
    );

    res.json({ 
      success: true, 
      messageId: response.data.id,
      message: 'Discord embed sent successfully'
    });
  } catch (error) {
    console.error('Error sending Discord embed:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.message || 'Failed to send Discord embed',
      details: error.response?.data 
    });
  }
});

module.exports = router;

