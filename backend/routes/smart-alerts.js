const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');

// Get user's smart alerts
router.get('/', ensureAuth, async (req, res) => {
  try {
    const alerts = await dbHelpers.all(
      'SELECT * FROM smart_alerts WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.discordId]
    );
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching smart alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new smart alert
router.post('/', ensureAuth, async (req, res) => {
  try {
    const { name, itemName, gameCategory, maxPrice, minPrice, priceUnit, mutation, traits } = req.body;
    
    if (!name || !itemName) {
      return res.status(400).json({ error: 'Name and item name are required' });
    }

    const result = await dbHelpers.run(
      `INSERT INTO smart_alerts (userId, name, itemName, gameCategory, maxPrice, minPrice, priceUnit, mutation, traits, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.user.discordId,
        name,
        itemName,
        gameCategory || null,
        maxPrice || null,
        minPrice || null,
        priceUnit || null,
        mutation || null,
        traits ? JSON.stringify(traits) : null
      ]
    );

    const alert = await dbHelpers.get('SELECT * FROM smart_alerts WHERE id = ?', [result.lastID]);
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating smart alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a smart alert
router.patch('/:id', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, itemName, gameCategory, maxPrice, minPrice, priceUnit, mutation, traits, isActive } = req.body;

    // Verify ownership
    const existing = await dbHelpers.get('SELECT * FROM smart_alerts WHERE id = ? AND userId = ?', [id, req.user.discordId]);
    if (!existing) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (itemName !== undefined) {
      updates.push('itemName = ?');
      params.push(itemName);
    }
    if (gameCategory !== undefined) {
      updates.push('gameCategory = ?');
      params.push(gameCategory);
    }
    if (maxPrice !== undefined) {
      updates.push('maxPrice = ?');
      params.push(maxPrice);
    }
    if (minPrice !== undefined) {
      updates.push('minPrice = ?');
      params.push(minPrice);
    }
    if (priceUnit !== undefined) {
      updates.push('priceUnit = ?');
      params.push(priceUnit);
    }
    if (mutation !== undefined) {
      updates.push('mutation = ?');
      params.push(mutation);
    }
    if (traits !== undefined) {
      updates.push('traits = ?');
      params.push(traits ? JSON.stringify(traits) : null);
    }
    if (isActive !== undefined) {
      updates.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, req.user.discordId);

    await dbHelpers.run(
      `UPDATE smart_alerts SET ${updates.join(', ')} WHERE id = ? AND userId = ?`,
      params
    );

    const updated = await dbHelpers.get('SELECT * FROM smart_alerts WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating smart alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a smart alert
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await dbHelpers.get('SELECT * FROM smart_alerts WHERE id = ? AND userId = ?', [id, req.user.discordId]);
    if (!existing) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await dbHelpers.run('DELETE FROM smart_alerts WHERE id = ? AND userId = ?', [id, req.user.discordId]);
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting smart alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

