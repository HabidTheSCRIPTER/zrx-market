const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../db/config');
const { ensureAuth } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Get user's templates
router.get('/', ensureAuth, async (req, res) => {
  try {
    const templates = await dbHelpers.all(
      'SELECT * FROM trade_templates WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.discordId]
    );

    res.json(templates.map(t => ({
      ...t,
      offered: JSON.parse(t.offered || '[]'),
      wanted: JSON.parse(t.wanted || '[]')
    })));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create template
router.post('/', ensureAuth, formLimiter, async (req, res) => {
  try {
    const { name, offered, wanted, value } = req.body;

    if (!name || !offered || !wanted) {
      return res.status(400).json({ error: 'Name, offered, and wanted are required' });
    }

    if (!Array.isArray(offered) || !Array.isArray(wanted)) {
      return res.status(400).json({ error: 'Offered and wanted must be arrays' });
    }

    const result = await dbHelpers.run(
      'INSERT INTO trade_templates (userId, name, offered, wanted, value) VALUES (?, ?, ?, ?, ?)',
      [req.user.discordId, name, JSON.stringify(offered), JSON.stringify(wanted), value || null]
    );

    const template = await dbHelpers.get(
      'SELECT * FROM trade_templates WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      ...template,
      offered: JSON.parse(template.offered),
      wanted: JSON.parse(template.wanted)
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update template
router.put('/:id', ensureAuth, formLimiter, async (req, res) => {
  try {
    const { name, offered, wanted } = req.body;
    const template = await dbHelpers.get(
      'SELECT userId FROM trade_templates WHERE id = ?',
      [req.params.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only edit your own templates' });
    }

    if (!name || !offered || !wanted) {
      return res.status(400).json({ error: 'Name, offered, and wanted are required' });
    }

    if (!Array.isArray(offered) || !Array.isArray(wanted)) {
      return res.status(400).json({ error: 'Offered and wanted must be arrays' });
    }

    await dbHelpers.run(
      'UPDATE trade_templates SET name = ?, offered = ?, wanted = ? WHERE id = ?',
      [name, JSON.stringify(offered), JSON.stringify(wanted), req.params.id]
    );

    const updated = await dbHelpers.get(
      'SELECT * FROM trade_templates WHERE id = ?',
      [req.params.id]
    );

    res.json({
      ...updated,
      offered: JSON.parse(updated.offered || '[]'),
      wanted: JSON.parse(updated.wanted || '[]')
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete template
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const template = await dbHelpers.get(
      'SELECT userId FROM trade_templates WHERE id = ?',
      [req.params.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only delete your own templates' });
    }

    await dbHelpers.run(
      'DELETE FROM trade_templates WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

