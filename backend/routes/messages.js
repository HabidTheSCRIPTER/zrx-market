const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { messageLimiter, messageSendLimiter } = require('../middleware/rateLimit');
const { createNotification, NotificationTypes } = require('../utils/notifications');

// Get messages for a trade or user
router.get('/', ensureAuth, messageLimiter, async (req, res) => {
  try {
    const { tradeId, recipientId, lastMessageId, reportId } = req.query;

    let query = `SELECT m.*, u1.username as senderUsername, u1.avatar as senderAvatar,
                 u2.username as recipientUsername, u2.avatar as recipientAvatar
                 FROM messages m
                 JOIN users u1 ON m.senderId = u1.discordId
                 JOIN users u2 ON m.recipientId = u2.discordId
                 WHERE (m.senderId = ? OR m.recipientId = ?)`;
    let params = [req.user.discordId, req.user.discordId];

    if (tradeId) {
      query += ' AND m.tradeId = ?';
      params.push(tradeId);
    } else if (reportId) {
      query += ' AND m.reportId = ?';
      params.push(reportId);
    } else if (recipientId) {
      query += ' AND (m.senderId = ? AND m.recipientId = ? OR m.senderId = ? AND m.recipientId = ?)';
      params.push(recipientId, req.user.discordId, req.user.discordId, recipientId);
    }

    // If lastMessageId is provided, only fetch messages newer than it (for polling)
    if (lastMessageId) {
      query += ' AND m.id > ?';
      params.push(parseInt(lastMessageId));
    }

    query += ' ORDER BY m.createdAt ASC';

    const messages = await dbHelpers.all(query, params);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message
router.post('/', ensureAuth, messageSendLimiter, [
  body('recipientId').trim().notEmpty().withMessage('Recipient ID is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('tradeId').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === undefined || value === '' || value === 'null') return true;
    return !isNaN(parseInt(value));
  }).withMessage('Trade ID must be a number'),
  body('reportId').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === undefined || value === '' || value === 'null') return true;
    return !isNaN(parseInt(value));
  }).withMessage('Report ID must be a number'),
  body('isBridged').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === undefined || value === '' || value === 'null') return true;
    return !isNaN(parseInt(value));
  }).withMessage('isBridged must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: errors.array().map(e => e.msg).join(', '),
        errors: errors.array() 
      });
    }

    const { recipientId, content, tradeId, reportId, isBridged } = req.body;
    
    // Convert reportId and tradeId to integers if provided, null otherwise
    const parsedTradeId = tradeId && tradeId !== 'null' && tradeId !== '' ? parseInt(tradeId) : null;
    const parsedReportId = reportId && reportId !== 'null' && reportId !== '' ? parseInt(reportId) : null;
    const parsedIsBridged = isBridged !== undefined && isBridged !== null && isBridged !== 'null' ? (isBridged === 1 || isBridged === '1' || isBridged === true) : 0;

    // Validate recipient exists
    const recipient = await dbHelpers.get(
      'SELECT discordId, username, avatar FROM users WHERE discordId = ?',
      [recipientId]
    );

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient user not found' });
    }

    // Validate that content is not empty after trimming
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }

    // Get bridge session if this is a bridged message
    let discordThreadId = null;
    if (parsedIsBridged && parsedReportId) {
      const session = await dbHelpers.get(
        'SELECT threadId FROM bridge_sessions WHERE reportId = ?',
        [parsedReportId]
      );
      if (session) {
        discordThreadId = session.threadId;
      }
    }

    const result = await dbHelpers.run(
      `INSERT INTO messages (tradeId, senderId, recipientId, content, reportId, isBridged, discordThreadId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parsedTradeId,
        req.user.discordId,
        recipientId,
        trimmedContent,
        parsedReportId,
        parsedIsBridged ? 1 : 0,
        discordThreadId
      ]
    );

    if (!result || !result.lastID) {
      throw new Error('Failed to insert message into database');
    }

    const message = await dbHelpers.get(
      `SELECT m.*, u1.username as senderUsername, u1.avatar as senderAvatar,
       u2.username as recipientUsername, u2.avatar as recipientAvatar
       FROM messages m
       JOIN users u1 ON m.senderId = u1.discordId
       JOIN users u2 ON m.recipientId = u2.discordId
       WHERE m.id = ?`,
      [result.lastID]
    );

    if (!message) {
      throw new Error('Failed to retrieve created message');
    }

    // Create notification for recipient
    await createNotification(
      recipientId,
      NotificationTypes.NEW_MESSAGE,
      'New Message',
      `${req.user.username} sent you a message${tradeId ? ` about trade #${tradeId}` : ''}`,
      `/messages?recipient=${req.user.discordId}${tradeId ? `&trade=${tradeId}` : ''}`
    );

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get a user's active conversations with latest message and unread count
router.get('/conversations', ensureAuth, messageLimiter, async (req, res) => {
  try {
    const userId = req.user.discordId;
    
    // First, get all unique conversation pairs (other user + tradeId combinations)
    const conversationPairs = await dbHelpers.all(
      `SELECT DISTINCT
        CASE 
          WHEN senderId = ? THEN recipientId 
          ELSE senderId 
        END AS otherUserDiscordId,
        tradeId
       FROM messages
       WHERE senderId = ? OR recipientId = ?`,
      [userId, userId, userId]
    );

    // For each conversation pair, get the latest message and unread count
    const conversations = await Promise.all(
      conversationPairs.map(async (pair) => {
        const { otherUserDiscordId, tradeId } = pair;
        
        // Get the other user's info
        const otherUser = await dbHelpers.get(
          'SELECT discordId, username, avatar FROM users WHERE discordId = ?',
          [otherUserDiscordId]
        );

        if (!otherUser) {
          return null; // Skip if user doesn't exist
        }

        // Build query to get latest message
        let latestMessageQuery = `SELECT m.*, u1.username as senderUsername, u1.avatar as senderAvatar,
                                 u2.username as recipientUsername, u2.avatar as recipientAvatar
                                 FROM messages m
                                 JOIN users u1 ON m.senderId = u1.discordId
                                 JOIN users u2 ON m.recipientId = u2.discordId
                                 WHERE ((m.senderId = ? AND m.recipientId = ?) OR (m.senderId = ? AND m.recipientId = ?))`;
        
        let params = [userId, otherUserDiscordId, otherUserDiscordId, userId];

        // Add tradeId filter if it exists (handle NULL properly)
        if (tradeId !== null && tradeId !== undefined) {
          latestMessageQuery += ' AND m.tradeId = ?';
          params.push(tradeId);
        } else {
          latestMessageQuery += ' AND m.tradeId IS NULL';
        }

        latestMessageQuery += ' ORDER BY m.createdAt DESC LIMIT 1';

        const latestMessage = await dbHelpers.get(latestMessageQuery, params);

        // Count unread messages
        let unreadQuery = `SELECT COUNT(*) as count 
                          FROM messages 
                          WHERE recipientId = ? AND senderId = ? AND isRead = 0`;
        let unreadParams = [userId, otherUserDiscordId];
        
        if (tradeId !== null && tradeId !== undefined) {
          unreadQuery += ' AND tradeId = ?';
          unreadParams.push(tradeId);
        } else {
          unreadQuery += ' AND tradeId IS NULL';
        }

        const unreadResult = await dbHelpers.get(unreadQuery, unreadParams);
        const unreadCount = unreadResult ? unreadResult.count : 0;

        if (!latestMessage) {
          return null;
        }

        return {
          otherUserDiscordId: otherUser.discordId,
          otherUsername: otherUser.username,
          otherAvatar: otherUser.avatar,
          tradeId: tradeId || null,
          lastMessageTime: latestMessage.createdAt,
          lastMessageContent: latestMessage.content,
          unreadCount: unreadCount
        };
      })
    );

    // Filter out null values and sort by last message time
    const validConversations = conversations
      .filter(conv => conv !== null)
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    // Always return an array, even if empty
    res.json(validConversations || []);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    console.error('Error stack:', error.stack);
    // Return empty array instead of error to prevent frontend from breaking
    res.json([]);
  }
});

// Get total unread message count for the current user
router.get('/unreadCount', ensureAuth, messageLimiter, async (req, res) => {
  try {
    const result = await dbHelpers.get(
      `SELECT COUNT(*) as count FROM messages WHERE recipientId = ? AND isRead = 0`,
      [req.user.discordId]
    );
    res.json({ count: result.count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
router.post('/markAsRead', ensureAuth, async (req, res) => {
  try {
    const { recipientId, tradeId } = req.body;

    let query = `UPDATE messages SET isRead = 1 WHERE recipientId = ? AND senderId = ?`;
    let params = [req.user.discordId, recipientId];

    if (tradeId) {
      query += ` AND tradeId = ?`;
      params.push(tradeId);
    }

    await dbHelpers.run(query, params);
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message (moderator or sender)
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const message = await dbHelpers.get(
      'SELECT * FROM messages WHERE id = ?',
      [req.params.id]
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const userRoles = req.user.roles ? JSON.parse(req.user.roles) : [];
    const isModerator = userRoles.includes(process.env.MODERATOR_ROLE_ID);

    if (!isModerator && message.senderId !== req.user.discordId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbHelpers.run('DELETE FROM messages WHERE id = ?', [req.params.id]);

    if (isModerator) {
      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [req.user.discordId, 'delete_message', req.params.id, '']
      );
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;