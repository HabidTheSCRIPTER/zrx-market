const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../db/config');

// Cache for brainrot values (refresh every 6 hours)
let valuesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Fetch brainrot values from wiki
async function fetchBrainrotValues() {
  try {
    // Try to fetch from the Brainrots category page or individual pages
    // The wiki has individual pages for each brainrot with their values
    
    // For now, we'll create a mapping based on known values
    // In production, you'd want to scrape the wiki pages
    const response = await axios.get('https://stealabrainrot.fandom.com/wiki/Category:Brainrots', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    
    // Extract brainrot names and values from the category page
    // The wiki structure may vary, so we'll need to parse it
    const values = {};
    
    // Try to extract from list items or links
    const brainrotPattern = /<a[^>]*href="\/wiki\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const matches = [...html.matchAll(brainrotPattern)];
    
    // For each brainrot, try to fetch its value from its individual page
    // This is a simplified approach - in production you'd want more robust parsing
    
    // Store in cache and database
    valuesCache = values;
    cacheTimestamp = Date.now();
    
    // Store in database
    try {
      await dbHelpers.run('DELETE FROM brainrot_values');
      
      for (const [name, value] of Object.entries(values)) {
        await dbHelpers.run(
          'INSERT INTO brainrot_values (name, value, rarity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [name, value.value || 0, value.rarity || 'Unknown']
        );
      }
    } catch (dbError) {
      console.error('Error storing values in database:', dbError);
    }
    
    return values;
  } catch (error) {
    console.error('Error fetching brainrot values:', error);
    
    // Try to get from database cache
    try {
      const cached = await dbHelpers.all('SELECT * FROM brainrot_values');
      if (cached && cached.length > 0) {
        const values = {};
        cached.forEach(item => {
          values[item.name] = {
            value: item.value,
            rarity: item.rarity
          };
        });
        return values;
      }
    } catch (dbError) {
      console.error('Error fetching from database:', dbError);
    }
    
    throw error;
  }
}

// Get all brainrot values
router.get('/', async (req, res) => {
  try {
    // Check cache
    if (valuesCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      return res.json(valuesCache);
    }
    
    // Try database first
    try {
      const cached = await dbHelpers.all('SELECT * FROM brainrot_values ORDER BY name');
      if (cached && cached.length > 0) {
        const values = {};
        cached.forEach(item => {
          values[item.name] = {
            value: parseFloat(item.value) || 0,
            rarity: item.rarity || 'Unknown'
          };
        });
        valuesCache = values;
        cacheTimestamp = Date.now();
        return res.json(values);
      }
    } catch (dbError) {
      console.error('Error fetching from database:', dbError);
    }
    
    // If no cache, return default values structure (will be populated by admin)
    res.json({});
  } catch (error) {
    console.error('Error getting brainrot values:', error);
    res.status(500).json({ error: 'Failed to fetch brainrot values' });
  }
});

// Update brainrot values (admin only - can be added later)
router.post('/update', async (req, res) => {
  try {
    const { values } = req.body;
    
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Invalid values format' });
    }
    
    await dbHelpers.run('DELETE FROM brainrot_values');
    
    for (const [name, data] of Object.entries(values)) {
      await dbHelpers.run(
        'INSERT INTO brainrot_values (name, value, rarity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [name, data.value || 0, data.rarity || 'Unknown']
      );
    }
    
    // Update cache
    valuesCache = values;
    cacheTimestamp = Date.now();
    
    res.json({ message: 'Values updated successfully', count: Object.keys(values).length });
  } catch (error) {
    console.error('Error updating brainrot values:', error);
    res.status(500).json({ error: 'Failed to update values' });
  }
});

module.exports = router;




