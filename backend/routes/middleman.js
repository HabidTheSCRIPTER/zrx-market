const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator, ensureVerified } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Get pending middleman requests (moderator only)
router.get('/pending', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const requests = await dbHelpers.all(
      `SELECT m.*, u.username, u.avatar FROM middleman m
       JOIN users u ON m.requesterId = u.discordId
       WHERE m.status = 'pending'
       ORDER BY m.createdAt DESC`
    );

    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all middleman requests (moderator only)
router.get('/all', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const status = req.query.status || null;
    let query = `SELECT m.*, u.username, u.avatar FROM middleman m
                 JOIN users u ON m.requesterId = u.discordId`;
    let params = [];

    if (status) {
      query += ' WHERE m.status = ?';
      params.push(status);
    }

    query += ' ORDER BY m.createdAt DESC';

    const requests = await dbHelpers.all(query, params);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single middleman request
router.get('/:id', ensureAuth, async (req, res) => {
  try {
    const request = await dbHelpers.get(
      `SELECT m.*, u.username, u.avatar FROM middleman m
       JOIN users u ON m.requesterId = u.discordId
       WHERE m.id = ?`,
      [req.params.id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only moderators or the requester can view
    const userRoles = req.user.roles ? JSON.parse(req.user.roles) : [];
    const isModerator = userRoles.includes(process.env.MODERATOR_ROLE_ID);

    if (!isModerator && request.requesterId !== req.user.discordId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create middleman request (verified users only)
router.post('/', ensureAuth, ensureVerified, formLimiter, async (req, res) => {
  try {
    const { user1, user2, item, value, proofLinks, robloxUsername } = req.body;

    const result = await dbHelpers.run(
      `INSERT INTO middleman (requesterId, user1, user2, item, value, proofLinks, robloxUsername)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.discordId,
        user1,
        user2,
        item,
        value || null,
        JSON.stringify(proofLinks || []),
        robloxUsername || null
      ]
    );

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [result.lastID]
    );

    // Notify bot to post embed (via shared state or event)
    // The bot will handle posting to Discord
    if (global.middlemanBot) {
      global.middlemanBot.emit('newRequest', request);
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating middleman request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request middleman from chat (for trades)
router.post('/request-from-chat', ensureAuth, ensureVerified, formLimiter, async (req, res) => {
  try {
    const { tradeId, recipientId } = req.body;
    const currentUserId = req.user.discordId;

    if (!tradeId || !recipientId) {
      return res.status(400).json({ error: 'Trade ID and recipient ID are required' });
    }

    // Get trade info
    const trade = await dbHelpers.get(
      'SELECT creatorId FROM trades WHERE id = ?',
      [tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Determine which user is user1 and which is user2
    // The creator is user1, the other party is user2
    const user1 = trade.creatorId;
    const user2 = currentUserId === user1 ? recipientId : currentUserId;

    // Check if current user is part of this trade
    if (currentUserId !== user1 && currentUserId !== user2) {
      return res.status(403).json({ error: 'You are not part of this trade' });
    }

    // Check cooldown
    const cooldownRow = await dbHelpers.get(
      'SELECT lastRequestAt FROM user_mm_cooldowns WHERE userId = ?',
      [currentUserId]
    );

    if (cooldownRow && cooldownRow.lastRequestAt) {
      const cooldownMs = 20 * 60 * 1000; // 20 minutes
      const timeSinceLastRequest = Date.now() - new Date(cooldownRow.lastRequestAt).getTime();
      if (timeSinceLastRequest < cooldownMs) {
        const remaining = cooldownMs - timeSinceLastRequest;
        return res.status(429).json({
          error: 'Please wait before requesting MM again.',
          cooldownRemaining: remaining
        });
      }
    }

    // Check if middleman request already exists for this trade
    let existingRequest = await dbHelpers.get(
      'SELECT * FROM middleman WHERE tradeId = ?',
      [tradeId]
    );

    let bothRequested = false;

    if (existingRequest) {
      // Update existing request
      const isUser1 = currentUserId === user1;
      const updateField = isUser1 ? 'user1RequestedMM' : 'user2RequestedMM';
      
      // Check if this user already requested
      if (existingRequest[updateField]) {
        return res.status(400).json({ error: 'You have already requested MM for this trade' });
      }

      // Update the request
      await dbHelpers.run(
        `UPDATE middleman SET ${updateField} = 1 WHERE id = ?`,
        [existingRequest.id]
      );

      // Check if both parties have requested
      const updatedRequest = await dbHelpers.get(
        'SELECT * FROM middleman WHERE id = ?',
        [existingRequest.id]
      );

      bothRequested = updatedRequest.user1RequestedMM && updatedRequest.user2RequestedMM;

      if (bothRequested) {
        // Update status to pending and notify bot
        await dbHelpers.run(
          'UPDATE middleman SET status = ? WHERE id = ?',
          ['pending', existingRequest.id]
        );

        const finalRequest = await dbHelpers.get(
          'SELECT * FROM middleman WHERE id = ?',
          [existingRequest.id]
        );

        // Notify bot
        if (global.middlemanBot) {
          global.middlemanBot.emit('newRequest', finalRequest);
        }

        // Set cooldown for both users
        const cooldownTime = new Date().toISOString();
        await dbHelpers.run(
          'INSERT OR REPLACE INTO user_mm_cooldowns (userId, lastRequestAt) VALUES (?, ?)',
          [user1, cooldownTime]
        );
        await dbHelpers.run(
          'INSERT OR REPLACE INTO user_mm_cooldowns (userId, lastRequestAt) VALUES (?, ?)',
          [user2, cooldownTime]
        );

        return res.json({
          bothRequested: true,
          request: finalRequest,
          cooldownRemaining: 20 * 60 * 1000
        });
      } else {
        return res.json({
          bothRequested: false,
          request: updatedRequest
        });
      }
    } else {
      // Create new request
      const isUser1 = currentUserId === user1;
      const user1RequestedMM = isUser1 ? 1 : 0;
      const user2RequestedMM = isUser1 ? 0 : 1;

      const result = await dbHelpers.run(
        `INSERT INTO middleman (requesterId, tradeId, user1, user2, user1RequestedMM, user2RequestedMM, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          currentUserId,
          tradeId,
          user1,
          user2,
          user1RequestedMM,
          user2RequestedMM,
          'pending' // Will be set to pending when both request
        ]
      );

      const newRequest = await dbHelpers.get(
        'SELECT * FROM middleman WHERE id = ?',
        [result.lastID]
      );

      return res.json({
        bothRequested: false,
        request: newRequest
      });
    }
  } catch (error) {
    console.error('Error requesting MM from chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update middleman request status (moderator only)
router.patch('/:id/status', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const { status, middlemanId } = req.body;

    if (!['pending', 'accepted', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await dbHelpers.run(
      'UPDATE middleman SET status = ?, middlemanId = ? WHERE id = ?',
      [status, middlemanId || null, req.params.id]
    );

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [req.params.id]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'update_middleman_status', req.params.id, JSON.stringify({ status, middlemanId })]
    );

    // Notify bot
    if (global.middlemanBot) {
      global.middlemanBot.emit('requestUpdated', request);
    }

    res.json(request);
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

