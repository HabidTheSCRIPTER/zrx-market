const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { formLimiter } = require('../middleware/rateLimit');
const { createNotification, NotificationTypes } = require('../utils/notifications');

// Get all offers for a trade
router.get('/trade/:tradeId', ensureAuth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    // Verify trade exists and user has permission
    const trade = await dbHelpers.get(
      'SELECT creatorId FROM trades WHERE id = ?',
      [tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Only trade creator or offerer can view offers
    const offers = await dbHelpers.all(
      `SELECT o.*, u.username, u.avatar, u.verified
       FROM trade_offers o
       JOIN users u ON o.offererId = u.discordId
       WHERE o.tradeId = ? AND (o.offererId = ? OR ? = ?)
       ORDER BY o.createdAt DESC`,
      [tradeId, req.user.discordId, req.user.discordId, trade.creatorId]
    );

    // Parse JSON fields
    const parsedOffers = offers.map(offer => ({
      ...offer,
      offeredItems: JSON.parse(offer.offeredItems || '[]'),
      wantedItems: JSON.parse(offer.wantedItems || '[]'),
      counterOffer: offer.counterOffer ? JSON.parse(offer.counterOffer) : null
    }));

    res.json(parsedOffers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all offers made by current user
router.get('/my-offers', ensureAuth, async (req, res) => {
  try {
    const offers = await dbHelpers.all(
      `SELECT o.*, t.creatorId, t.offered as tradeOffered, t.wanted as tradeWanted,
       u.username as tradeCreatorUsername, u.avatar as tradeCreatorAvatar
       FROM trade_offers o
       JOIN trades t ON o.tradeId = t.id
       JOIN users u ON t.creatorId = u.discordId
       WHERE o.offererId = ?
       ORDER BY o.createdAt DESC`,
      [req.user.discordId]
    );

    const parsedOffers = offers.map(offer => ({
      ...offer,
      offeredItems: JSON.parse(offer.offeredItems || '[]'),
      wantedItems: JSON.parse(offer.wantedItems || '[]'),
      tradeOffered: JSON.parse(offer.tradeOffered || '[]'),
      tradeWanted: JSON.parse(offer.tradeWanted || '[]'),
      counterOffer: offer.counterOffer ? JSON.parse(offer.counterOffer) : null
    }));

    res.json(parsedOffers);
  } catch (error) {
    console.error('Error fetching user offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new offer
router.post('/', ensureAuth, formLimiter, [
  body('tradeId').isInt().withMessage('Trade ID is required'),
  body('offeredItems').isArray().withMessage('Offered items must be an array'),
  body('wantedItems').isArray().withMessage('Wanted items must be an array'),
  body('message').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tradeId, offeredItems, wantedItems, message } = req.body;

    // Verify trade exists and is active
    const trade = await dbHelpers.get(
      'SELECT * FROM trades WHERE id = ?',
      [tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.status !== 'active') {
      return res.status(400).json({ error: 'Trade is not active' });
    }

    if (trade.creatorId === req.user.discordId) {
      return res.status(400).json({ error: 'Cannot make an offer on your own trade' });
    }

    // Check if user already has a pending offer on this trade
    const existingOffer = await dbHelpers.get(
      'SELECT id FROM trade_offers WHERE tradeId = ? AND offererId = ? AND status = ?',
      [tradeId, req.user.discordId, 'pending']
    );

    if (existingOffer) {
      return res.status(400).json({ error: 'You already have a pending offer on this trade' });
    }

    const result = await dbHelpers.run(
      `INSERT INTO trade_offers (tradeId, offererId, offeredItems, wantedItems, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        tradeId,
        req.user.discordId,
        JSON.stringify(offeredItems),
        JSON.stringify(wantedItems),
        message || null
      ]
    );

    const offer = await dbHelpers.get(
      `SELECT o.*, u.username, u.avatar, u.verified
       FROM trade_offers o
       JOIN users u ON o.offererId = u.discordId
       WHERE o.id = ?`,
      [result.lastID]
    );

    // Notify trade creator
    await createNotification(
      trade.creatorId,
      NotificationTypes.NEW_OFFER,
      'New Trade Offer',
      `${req.user.username} made an offer on your trade #${tradeId}`,
      `/trades?offer=${result.lastID}`
    );

    res.status(201).json({
      ...offer,
      offeredItems: JSON.parse(offer.offeredItems),
      wantedItems: JSON.parse(offer.wantedItems)
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept an offer
router.patch('/:id/accept', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await dbHelpers.get(
      `SELECT o.*, t.creatorId, t.status as tradeStatus
       FROM trade_offers o
       JOIN trades t ON o.tradeId = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only trade creator can accept offers
    if (offer.creatorId !== req.user.discordId) {
      return res.status(403).json({ error: 'Only the trade creator can accept offers' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    if (offer.tradeStatus !== 'active') {
      return res.status(400).json({ error: 'Trade is not active' });
    }

    // Update offer status
    await dbHelpers.run(
      'UPDATE trade_offers SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['accepted', id]
    );

    // Reject all other pending offers on this trade
    await dbHelpers.run(
      'UPDATE trade_offers SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE tradeId = ? AND id != ? AND status = ?',
      ['rejected', offer.tradeId, id, 'pending']
    );

    // Mark trade as completed
    await dbHelpers.run(
      'UPDATE trades SET status = ?, completedBy = ?, completedAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', offer.offererId, offer.tradeId]
    );

    // Notify offerer
    await createNotification(
      offer.offererId,
      NotificationTypes.OFFER_ACCEPTED,
      'Offer Accepted',
      `Your offer on trade #${offer.tradeId} has been accepted!`,
      `/trades?id=${offer.tradeId}`
    );

    res.json({ message: 'Offer accepted successfully' });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject an offer
router.patch('/:id/reject', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await dbHelpers.get(
      `SELECT o.*, t.creatorId
       FROM trade_offers o
       JOIN trades t ON o.tradeId = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only trade creator can reject offers
    if (offer.creatorId !== req.user.discordId) {
      return res.status(403).json({ error: 'Only the trade creator can reject offers' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    await dbHelpers.run(
      'UPDATE trade_offers SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['rejected', id]
    );

    // Notify offerer
    await createNotification(
      offer.offererId,
      NotificationTypes.OFFER_REJECTED,
      'Offer Rejected',
      `Your offer on trade #${offer.tradeId} has been rejected`,
      `/trades?id=${offer.tradeId}`
    );

    res.json({ message: 'Offer rejected' });
  } catch (error) {
    console.error('Error rejecting offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a counter-offer
router.post('/:id/counter', ensureAuth, [
  body('offeredItems').isArray().withMessage('Offered items must be an array'),
  body('wantedItems').isArray().withMessage('Wanted items must be an array'),
  body('message').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { offeredItems, wantedItems, message } = req.body;

    const offer = await dbHelpers.get(
      `SELECT o.*, t.creatorId
       FROM trade_offers o
       JOIN trades t ON o.tradeId = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only trade creator can make counter-offers
    if (offer.creatorId !== req.user.discordId) {
      return res.status(403).json({ error: 'Only the trade creator can make counter-offers' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Can only counter pending offers' });
    }

    await dbHelpers.run(
      'UPDATE trade_offers SET counterOffer = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify({ offeredItems, wantedItems, message: message || null }), id]
    );

    // Notify offerer
    await createNotification(
      offer.offererId,
      NotificationTypes.COUNTER_OFFER,
      'Counter-Offer Received',
      `The trade creator made a counter-offer on trade #${offer.tradeId}`,
      `/trades?offer=${id}`
    );

    res.json({ message: 'Counter-offer created successfully' });
  } catch (error) {
    console.error('Error creating counter-offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Withdraw an offer (by offerer)
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await dbHelpers.get(
      'SELECT * FROM trade_offers WHERE id = ?',
      [id]
    );

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only offerer can withdraw their own offer
    if (offer.offererId !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only withdraw your own offers' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Can only withdraw pending offers' });
    }

    await dbHelpers.run('DELETE FROM trade_offers WHERE id = ?', [id]);

    res.json({ message: 'Offer withdrawn successfully' });
  } catch (error) {
    console.error('Error withdrawing offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




