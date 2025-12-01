const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { validateTrade } = require('../middleware/validation');
const { formLimiter } = require('../middleware/rateLimit');
const { createNotification, NotificationTypes } = require('../utils/notifications');


// Helper function for safe JSON parsing
function safeJSONParse(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}


// Get all trades with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const gameCategory = req.query.gameCategory; // Get gameCategory from query parameters

    // Build base query with optional user_stats join for rating filter
    const minRating = req.query.minRating;
    // Use COALESCE to handle missing isCrossTrade column gracefully
    let query = 'SELECT t.*, u.username, u.avatar, COALESCE(t.isCrossTrade, 0) as isCrossTrade FROM trades t JOIN users u ON t.creatorId = u.discordId';
    
    // Add user_stats join if minRating filter is used
    if (minRating) {
      query += ' LEFT JOIN user_stats us ON u.discordId = us.discordId';
    }
    
    query += ' WHERE t.status = ?';
    let params = ['active'];

    if (search) {
      query += ' AND (t.offered LIKE ? OR t.wanted LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Add gameCategory filter if provided
    if (gameCategory) {
      // Check if either offered or wanted items contain an item from the selected gameCategory
      query += ' AND (EXISTS(SELECT 1 FROM json_each(t.offered) WHERE json_each.value ->> \'gameCategory\' = ?) OR EXISTS(SELECT 1 FROM json_each(t.wanted) WHERE json_each.value ->> \'gameCategory\' = ?))';
      params.push(gameCategory, gameCategory);
    }

    // Add minRating filter if provided
    if (minRating) {
      query += ' AND (us.avgRating >= ? OR us.avgRating IS NULL)';
      params.push(parseFloat(minRating));
    }

    // Add sorting
    const sortBy = req.query.sortBy || 'newest';
    switch (sortBy) {
      case 'oldest':
        query += ' ORDER BY t.createdAt ASC';
        break;
      case 'views':
        query += ' ORDER BY t.views DESC, t.createdAt DESC';
        break;
      case 'favorites':
        query += ' ORDER BY (SELECT COUNT(*) FROM json_each(t.favorites)) DESC, t.createdAt DESC';
        break;
      default: // newest
        query += ' ORDER BY t.createdAt DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    let trades = await dbHelpers.all(query, params);
    // Parse JSON strings for offered and wanted items safely
    trades = trades.map(trade => ({
      ...trade,
      offered: safeJSONParse(trade.offered),
      wanted: safeJSONParse(trade.wanted),
    }));

    const countResult = await dbHelpers.get(
      'SELECT COUNT(*) as total FROM trades WHERE status = ?',
      ['active']
    );

    res.json({
      trades,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('❌ ERROR FETCHING TRADES:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error errno:', error.errno);
    console.error('SQL Query:', query);
    console.error('Query params:', params);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    
    // Check if it's a missing column error
    if (error.message && error.message.includes('no such column')) {
      console.error('⚠️  DATABASE SCHEMA ISSUE: Missing column detected!');
      console.error('⚠️  This usually means the database migrations haven\'t run yet.');
      console.error('⚠️  Please redeploy Railway to run migrations.');
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get trades that a user is involved in (as creator or through messages)
router.get('/user/involved', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.discordId;
    
    // Get trades where user is creator
    const createdTrades = await dbHelpers.all(
      `SELECT t.*, u.username, u.avatar 
       FROM trades t 
       JOIN users u ON t.creatorId = u.discordId 
       WHERE t.creatorId = ? AND t.status = 'active'
       ORDER BY t.createdAt DESC`,
      [userId]
    );

    // Get trades where user has messaged about (via messages table)
    const messagedTrades = await dbHelpers.all(
      `SELECT DISTINCT t.*, u.username, u.avatar 
       FROM trades t 
       JOIN messages m ON t.id = m.tradeId
       JOIN users u ON t.creatorId = u.discordId
       WHERE (m.senderId = ? OR m.recipientId = ?) 
       AND t.status = 'active'
       AND t.creatorId != ?
       ORDER BY t.createdAt DESC`,
      [userId, userId, userId]
    );

    // Combine and deduplicate
    const allTrades = [...createdTrades, ...messagedTrades];
    const uniqueTrades = Array.from(
      new Map(allTrades.map(trade => [trade.id, trade])).values()
    );

    // Parse JSON strings
    const parsedTrades = uniqueTrades.map(trade => ({
      ...trade,
      offered: safeJSONParse(trade.offered),
      wanted: safeJSONParse(trade.wanted),
    }));

    res.json(parsedTrades);
  } catch (error) {
    console.error('❌ ERROR FETCHING USER TRADES:');
    console.error('User ID:', req.user?.discordId);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    if (error.message && error.message.includes('no such column')) {
      console.error('⚠️  DATABASE SCHEMA ISSUE: Missing column detected!');
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single trade
router.get('/:id', async (req, res) => {
  try {
    let trade;
    try {
      trade = await dbHelpers.get(
        `SELECT t.*, u.username, u.avatar, COALESCE(t.isCrossTrade, 0) as isCrossTrade FROM trades t 
         JOIN users u ON t.creatorId = u.discordId 
         WHERE t.id = ?`,
        [req.params.id]
      );
    } catch (dbError) {
      console.error('❌ ERROR FETCHING SINGLE TRADE:');
      console.error('Trade ID:', req.params.id);
      console.error('Error message:', dbError.message);
      console.error('Error code:', dbError.code);
      console.error('Full error:', dbError);
      console.error('Stack trace:', dbError.stack);
      if (dbError.message && dbError.message.includes('no such column')) {
        console.error('⚠️  DATABASE SCHEMA ISSUE: Missing column (isCrossTrade)');
      }
      throw dbError; // Re-throw to be caught by outer catch
    }

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Parse JSON strings for offered and wanted items safely
    trade = {
      ...trade,
      offered: safeJSONParse(trade.offered),
      wanted: safeJSONParse(trade.wanted),
    };

    res.json(trade);
  } catch (error) {
    console.error('❌ ERROR FETCHING SINGLE TRADE (outer catch):');
    console.error('Trade ID:', req.params.id);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    if (error.message && error.message.includes('no such column')) {
      console.error('⚠️  DATABASE SCHEMA ISSUE: Missing column detected!');
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create trade
router.post('/', ensureAuth, formLimiter, validateTrade, async (req, res) => {
  try {
    const { offered, wanted, value } = req.body;
    const creatorId = req.user.discordId;

    // Check if user already has an active trade
    const existingTrade = await dbHelpers.get(
      'SELECT id, createdAt FROM trades WHERE creatorId = ? AND status = ?',
      [creatorId, 'active']
    );

    if (existingTrade) {
      const tradeAge = new Date() - new Date(existingTrade.createdAt);
      const hoursOld = tradeAge / (1000 * 60 * 60);
      const remainingHours = (5 - hoursOld).toFixed(1);
      
      return res.status(400).json({ 
        error: `You already have an active trade. Please delete your existing trade (#${existingTrade.id}) before creating a new one.${remainingHours > 0 ? ` Your current trade will auto-expire in ${remainingHours} hours.` : ' Your current trade will be auto-deleted soon.'}` 
      });
    }

    console.log('Received trade creation request:', {
      offeredType: typeof offered,
      wantedType: typeof wanted,
      offeredIsArray: Array.isArray(offered),
      wantedIsArray: Array.isArray(wanted),
      offeredLength: Array.isArray(offered) ? offered.length : 'N/A',
      wantedLength: Array.isArray(wanted) ? wanted.length : 'N/A'
    });

    // Validate that offered and wanted are arrays
    if (!Array.isArray(offered)) {
      console.error('Invalid offered items:', offered);
      return res.status(400).json({ error: 'Offered items must be an array' });
    }
    if (!Array.isArray(wanted)) {
      console.error('Invalid wanted items:', wanted);
      return res.status(400).json({ error: 'Wanted items must be an array' });
    }

    // Filter out empty items and ensure all items have both name and category
    // Also preserve value if it exists on the item
    const offeredItems = offered
      .filter(item => item && item.name && item.gameCategory && item.name.trim() && item.gameCategory.trim())
      .map(item => ({
        name: item.name.trim(),
        gameCategory: item.gameCategory.trim(),
        ...(item.value && { value: item.value }), // Include value if present
        ...(item.mutation && { mutation: item.mutation }), // Include mutation if present
        ...(item.trait && { trait: item.trait }), // Include trait if present
        ...(item.weight && { weight: item.weight }) // Include weight if present
      }));
    
    const wantedItems = wanted
      .filter(item => item && item.name && item.gameCategory && item.name.trim() && item.gameCategory.trim())
      .map(item => ({
        name: item.name.trim(),
        gameCategory: item.gameCategory.trim(),
        ...(item.value && { value: item.value }), // Include value if present
        ...(item.mutation && { mutation: item.mutation }), // Include mutation if present
        ...(item.trait && { trait: item.trait }), // Include trait if present
        ...(item.weight && { weight: item.weight }) // Include weight if present
      }));

    console.log('After filtering:', {
      offeredItemsCount: offeredItems.length,
      wantedItemsCount: wantedItems.length,
      offeredItems: offeredItems,
      wantedItems: wantedItems
    });

    // Validate that we have at least one item in each
    if (offeredItems.length === 0) {
      console.error('No valid offered items after filtering');
      return res.status(400).json({ error: 'At least one offered item with both category and name is required' });
    }
    if (wantedItems.length === 0) {
      console.error('No valid wanted items after filtering');
      return res.status(400).json({ error: 'At least one wanted item with both category and name is required' });
    }

    // Determine if it's a cross-trade
    let isCrossTrade = 0;
    if (offeredItems.length > 0 && wantedItems.length > 0) {
      const offeredCategories = new Set(offeredItems.map(item => item.gameCategory).filter(Boolean));
      const wantedCategories = new Set(wantedItems.map(item => item.gameCategory).filter(Boolean));

      for (const offeredCat of offeredCategories) {
        if (offeredCat && !wantedCategories.has(offeredCat)) {
          isCrossTrade = 1;
          break;
        }
      }
      if (isCrossTrade === 0) { // If not determined yet, check the other way
        for (const wantedCat of wantedCategories) {
          if (wantedCat && !offeredCategories.has(wantedCat)) {
            isCrossTrade = 1;
            break;
          }
        }
      }
    }

    const result = await dbHelpers.run(
      `INSERT INTO trades (creatorId, offered, wanted, value, isCrossTrade)
       VALUES (?, ?, ?, ?, ?)`,
      [
        creatorId,
        JSON.stringify(offeredItems),
        JSON.stringify(wantedItems),
        value || null,
        isCrossTrade
      ]
    );

    const trade = await dbHelpers.get(
      'SELECT t.*, u.username, u.avatar FROM trades t JOIN users u ON t.creatorId = u.discordId WHERE t.id = ?',
      [result.lastID]
    );

    res.status(201).json(trade);
  } catch (error) {
    console.error('Error creating trade:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update trade (moderator only)
router.put('/:id', ensureAuth, ensureModerator, validateTrade, async (req, res) => {
  try {
    const { offered, wanted, value, robloxUsername, status } = req.body;

    const offeredItems = offered.filter(item => item.name || item.gameCategory);
    const wantedItems = wanted.filter(item => item.name || item.gameCategory);

    // Determine if it's a cross-trade
    let isCrossTrade = 0;
    if (offeredItems.length > 0 && wantedItems.length > 0) {
      const offeredCategories = new Set(offeredItems.map(item => item.gameCategory));
      const wantedCategories = new Set(wantedItems.map(item => item.gameCategory));

      for (const offeredCat of offeredCategories) {
        if (!wantedCategories.has(offeredCat)) {
          isCrossTrade = 1;
          break;
        }
      }
      if (isCrossTrade === 0) { // If not determined yet, check the other way
        for (const wantedCat of wantedCategories) {
          if (!offeredCategories.has(wantedCat)) {
            isCrossTrade = 1;
            break;
          }
        }
      }
    }

    await dbHelpers.run(
      `UPDATE trades SET offered = ?, wanted = ?, value = ?, robloxUsername = ?, status = ?, isCrossTrade = ?
       WHERE id = ?`,
      [JSON.stringify(offeredItems), JSON.stringify(wantedItems), value || null, robloxUsername || null, status || 'active', isCrossTrade, req.params.id]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'update_trade', req.params.id, JSON.stringify(req.body)]
    );

    const trade = await dbHelpers.get(
      'SELECT t.*, u.username, u.avatar FROM trades t JOIN users u ON t.creatorId = u.discordId WHERE t.id = ?',
      [req.params.id]
    );

    res.json(trade);
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete trade (creator only - so they can create a new one)
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    // Get the trade to verify ownership
    const trade = await dbHelpers.get(
      'SELECT creatorId FROM trades WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found or already deleted' });
    }

    // Only the creator can delete their own trade
    if (trade.creatorId !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only delete your own trades' });
    }

    // Delete the trade
    await dbHelpers.run('DELETE FROM trades WHERE id = ?', [req.params.id]);

    res.json({ message: 'Trade deleted successfully. You can now create a new trade.' });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete trade
router.post('/:id/complete', ensureAuth, async (req, res) => {
  try {
    const trade = await dbHelpers.get(
      'SELECT * FROM trades WHERE id = ?',
      [req.params.id]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Only creator or someone who messaged about the trade can complete it
    const hasMessaged = await dbHelpers.get(
      'SELECT id FROM messages WHERE tradeId = ? AND (senderId = ? OR recipientId = ?) LIMIT 1',
      [req.params.id, req.user.discordId, req.user.discordId]
    );

    if (trade.creatorId !== req.user.discordId && !hasMessaged) {
      return res.status(403).json({ error: 'You can only complete trades you created or participated in' });
    }

    if (trade.status !== 'active') {
      return res.status(400).json({ error: 'Trade is not active' });
    }

    await dbHelpers.run(
      'UPDATE trades SET status = ?, completedBy = ?, completedAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', req.user.discordId, req.params.id]
    );

    // Update user stats
    await dbHelpers.run(
      'UPDATE users SET completedTrades = completedTrades + 1 WHERE discordId = ?',
      [trade.creatorId]
    );

    // Notify trade creator if different user
    if (trade.creatorId !== req.user.discordId) {
      await createNotification(
        trade.creatorId,
        NotificationTypes.TRADE_COMPLETED,
        'Trade Completed',
        `Your trade #${trade.id} has been marked as completed`,
        `/trades`
      );
    }

    res.json({ message: 'Trade marked as completed' });
  } catch (error) {
    console.error('Error completing trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel trade
router.post('/:id/cancel', ensureAuth, async (req, res) => {
  try {
    const trade = await dbHelpers.get(
      'SELECT * FROM trades WHERE id = ?',
      [req.params.id]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.creatorId !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only cancel your own trades' });
    }

    if (trade.status !== 'active') {
      return res.status(400).json({ error: 'Trade is not active' });
    }

    await dbHelpers.run(
      'UPDATE trades SET status = ?, cancelledAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', req.params.id]
    );

    // Update user stats
    await dbHelpers.run(
      'UPDATE users SET cancelledTrades = cancelledTrades + 1 WHERE discordId = ?',
      [req.user.discordId]
    );

    res.json({ message: 'Trade cancelled' });
  } catch (error) {
    console.error('Error cancelling trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Favorite/unfavorite trade
router.post('/:id/favorite', ensureAuth, async (req, res) => {
  try {
    const existing = await dbHelpers.get(
      'SELECT id FROM trade_favorites WHERE userId = ? AND tradeId = ?',
      [req.user.discordId, req.params.id]
    );

    if (existing) {
      await dbHelpers.run(
        'DELETE FROM trade_favorites WHERE userId = ? AND tradeId = ?',
        [req.user.discordId, req.params.id]
      );
      await dbHelpers.run(
        'UPDATE trades SET favoriteCount = favoriteCount - 1 WHERE id = ?',
        [req.params.id]
      );
      res.json({ favorited: false });
    } else {
      await dbHelpers.run(
        'INSERT INTO trade_favorites (userId, tradeId) VALUES (?, ?)',
        [req.user.discordId, req.params.id]
      );
      await dbHelpers.run(
        'UPDATE trades SET favoriteCount = favoriteCount + 1 WHERE id = ?',
        [req.params.id]
      );
      res.json({ favorited: true });
    }
  } catch (error) {
    console.error('Error favoriting trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment view count
router.post('/:id/view', async (req, res) => {
  try {
    await dbHelpers.run(
      'UPDATE trades SET viewCount = viewCount + 1 WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

