const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Create dispute
router.post('/', ensureAuth, formLimiter, async (req, res) => {
  try {
    const { tradeId, accusedId, reason, evidence } = req.body;
    const reporterId = req.user.discordId;

    if (!tradeId || !accusedId || !reason) {
      return res.status(400).json({ error: 'Trade ID, accused ID, and reason are required' });
    }

    // Verify trade exists and user participated
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
      [tradeId, reporterId, reporterId]
    );

    if (trade.creatorId !== reporterId && !participated) {
      return res.status(403).json({ error: 'You can only dispute trades you participated in' });
    }

    // Check if dispute already exists
    const existing = await dbHelpers.get(
      'SELECT id FROM disputes WHERE tradeId = ? AND reporterId = ?',
      [tradeId, reporterId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Dispute already exists for this trade' });
    }

    const result = await dbHelpers.run(
      `INSERT INTO disputes (tradeId, reporterId, accusedId, reason, evidence, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [tradeId, reporterId, accusedId, reason, JSON.stringify(evidence || [])]
    );

    const dispute = await dbHelpers.get(
      'SELECT * FROM disputes WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      ...dispute,
      evidence: JSON.parse(dispute.evidence || '[]')
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's disputes
router.get('/my-disputes', ensureAuth, async (req, res) => {
  try {
    const disputes = await dbHelpers.all(
      `SELECT d.*, t.offered, t.wanted,
       u1.username as reporterUsername, u1.avatar as reporterAvatar,
       u2.username as accusedUsername, u2.avatar as accusedAvatar
       FROM disputes d
       JOIN trades t ON d.tradeId = t.id
       JOIN users u1 ON d.reporterId = u1.discordId
       JOIN users u2 ON d.accusedId = u2.discordId
       WHERE d.reporterId = ? OR d.accusedId = ?
       ORDER BY d.createdAt DESC`,
      [req.user.discordId, req.user.discordId]
    );

    res.json(disputes.map(d => ({
      ...d,
      evidence: JSON.parse(d.evidence || '[]')
    })));
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all disputes (moderator only)
router.get('/', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const status = req.query.status || 'all';
    let query = `SELECT d.*, t.offered, t.wanted,
       u1.username as reporterUsername, u1.avatar as reporterAvatar,
       u2.username as accusedUsername, u2.avatar as accusedAvatar,
       u3.username as moderatorUsername
       FROM disputes d
       JOIN trades t ON d.tradeId = t.id
       JOIN users u1 ON d.reporterId = u1.discordId
       JOIN users u2 ON d.accusedId = u2.discordId
       LEFT JOIN users u3 ON d.moderatorId = u3.discordId`;

    const params = [];
    if (status !== 'all') {
      query += ' WHERE d.status = ?';
      params.push(status);
    } else {
      query += ' WHERE 1=1';
    }

    query += ' ORDER BY d.createdAt DESC';

    const disputes = await dbHelpers.all(query, params);

    res.json(disputes.map(d => ({
      ...d,
      evidence: JSON.parse(d.evidence || '[]')
    })));
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single dispute
router.get('/:id', ensureAuth, async (req, res) => {
  try {
    const dispute = await dbHelpers.get(
      `SELECT d.*, t.offered, t.wanted,
       u1.username as reporterUsername, u1.avatar as reporterAvatar,
       u2.username as accusedUsername, u2.avatar as accusedAvatar,
       u3.username as moderatorUsername
       FROM disputes d
       JOIN trades t ON d.tradeId = t.id
       JOIN users u1 ON d.reporterId = u1.discordId
       JOIN users u2 ON d.accusedId = u2.discordId
       LEFT JOIN users u3 ON d.moderatorId = u3.discordId
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Check permissions
    const isMod = ensureModerator();
    if (!isMod && dispute.reporterId !== req.user.discordId && dispute.accusedId !== req.user.discordId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...dispute,
      evidence: JSON.parse(dispute.evidence || '[]')
    });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dispute status (moderator only)
router.patch('/:id/status', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const updateFields = ['status = ?', 'moderatorId = ?'];
    const updateValues = [status, req.user.discordId];

    if (resolution) {
      updateFields.push('resolution = ?');
      updateValues.push(resolution);
    }

    if (status === 'resolved' || status === 'dismissed') {
      updateFields.push('resolvedAt = CURRENT_TIMESTAMP');
    }

    updateValues.push(req.params.id);

    await dbHelpers.run(
      `UPDATE disputes SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const dispute = await dbHelpers.get(
      'SELECT * FROM disputes WHERE id = ?',
      [req.params.id]
    );

    res.json({
      ...dispute,
      evidence: JSON.parse(dispute.evidence || '[]')
    });
  } catch (error) {
    console.error('Error updating dispute:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

