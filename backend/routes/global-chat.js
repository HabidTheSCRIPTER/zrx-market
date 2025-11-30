const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');
const { messageSendLimiter } = require('../middleware/rateLimit');

// Bad words filter - common profanity and inappropriate words
const BAD_WORDS = [
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga',
  'retard', 'fag', 'faggot', 'pussy', 'dick', 'cock', 'whore', 'slut',
  'bastard', 'son of a bitch', 'motherfucker', 'mf', 'wtf', 'omfg',
  // Add more as needed
];

// Link detection regex
const LINK_REGEX = /https?:\/\/[^\s]+/gi;

// Function to filter bad words
function filterBadWords(text) {
  let filtered = text;
  let isFiltered = false;
  
  BAD_WORDS.forEach(word => {
    // Escape special regex characters
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    if (regex.test(filtered)) {
      filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
      isFiltered = true;
    }
  });
  
  return { filtered, isFiltered };
}

// Function to remove links
function removeLinks(text) {
  const hasLinks = LINK_REGEX.test(text);
  const filtered = text.replace(LINK_REGEX, '[Link Removed]');
  return { filtered, isFiltered: hasLinks };
}

// Get global chat messages
router.get('/', ensureAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const messages = await dbHelpers.all(
      `SELECT gcm.*, u.username, u.avatar, u.verified
       FROM global_chat_messages gcm
       JOIN users u ON gcm.userId = u.discordId
       ORDER BY gcm.createdAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    
    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching global chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send global chat message
router.post('/', ensureAuth, messageSendLimiter, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.discordId;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (content.length > 500) {
      return res.status(400).json({ error: 'Message is too long (max 500 characters)' });
    }
    
    // Filter bad words
    const badWordsFilter = filterBadWords(content);
    
    // Remove links
    const linkFilter = removeLinks(badWordsFilter.filtered);
    
    const finalContent = linkFilter.filtered.trim();
    const isFiltered = badWordsFilter.isFiltered || linkFilter.isFiltered;
    
    // Check if message is empty after filtering
    if (!finalContent) {
      return res.status(400).json({ error: 'Message was filtered and is now empty' });
    }
    
    const result = await dbHelpers.run(
      `INSERT INTO global_chat_messages (userId, username, avatar, content, isFiltered)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, req.user.username, req.user.avatar, finalContent, isFiltered ? 1 : 0]
    );
    
    const message = await dbHelpers.get(
      `SELECT gcm.*, u.username, u.avatar, u.verified
       FROM global_chat_messages gcm
       JOIN users u ON gcm.userId = u.discordId
       WHERE gcm.id = ?`,
      [result.lastID]
    );
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending global chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message (moderator only)
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const userRoles = req.user.roles ? JSON.parse(req.user.roles) : [];
    const moderatorRoleId = process.env.MODERATOR_ROLE_ID;
    const isModerator = req.user.isOwner || (userRoles && userRoles.includes(moderatorRoleId));
    
    if (!isModerator) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await dbHelpers.run('DELETE FROM global_chat_messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting global chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

