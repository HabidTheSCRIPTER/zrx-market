const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../db/config');

// Cache for news updates (refresh every hour)
let newsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Parse HTML table rows to extract updates
function parseTableRows(html) {
  const updates = [];
  
  // Remove scripts and styles to clean HTML
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Find the updates table - look for table rows with update information
  // Pattern: <tr> ... <td>Update X</td> ... <td>Date</td> ... <td>Features</td> ... </tr>
  const tableRowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
  const rows = [...cleanHtml.matchAll(tableRowPattern)];
  
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    
    // Skip header rows
    if (rowHtml.includes('<th') || rowHtml.toLowerCase().includes('release date') || rowHtml.toLowerCase().includes('main features')) {
      continue;
    }
    
    // Extract all table cells from this row
    const cellPattern = /<td[^>]*>(.*?)<\/td>/gis;
    const cells = [...rowHtml.matchAll(cellPattern)];
    
    if (cells.length >= 3) {
      // Extract text from each cell, handling links and formatting
      const cellTexts = cells.map((cell, index) => {
        let text = cell[1];
        
        // Extract link text if present
        const linkMatch = text.match(/<a[^>]*>([^<]+)<\/a>/i);
        if (linkMatch) {
          text = linkMatch[1] + ' ' + text.replace(/<a[^>]*>.*?<\/a>/gi, '');
        }
        
        // Clean up HTML
        text = text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        
        return text;
      });
      
      // Look for update number or link text in first cell
      const updateCell = cellTexts[0] || '';
      const dateCell = cellTexts[1] || '';
      const featuresCell = cellTexts[2] || '';
      
      // Check if this looks like an update row (has "Update" and a date)
      const updateMatch = updateCell.match(/Update\s*(\d+)/i) || updateCell.match(/(\d+\.\d+\.\d+)/); // Also match version numbers
      const datePatterns = [
        /(\w+\s+\d{1,2},\s+\d{4})/, // "May 31, 2025"
        /(\d{1,2}\/\d{1,2}\/\d{4})/, // "05/31/2025"
        /(\w+\s+\d{1,2}\s+\d{4})/, // "May 31 2025"
        /(\d{4}-\d{2}-\d{2})/ // "2025-05-31"
      ];
      
      let dateMatch = null;
      for (const pattern of datePatterns) {
        const match = dateCell.match(pattern);
        if (match) {
          dateMatch = match;
          break;
        }
      }
      
      // Also check if date is in the update cell
      if (!dateMatch) {
        for (const pattern of datePatterns) {
          const match = updateCell.match(pattern);
          if (match) {
            dateMatch = match;
            break;
          }
        }
      }
      
      if ((updateMatch || dateMatch) && dateMatch && featuresCell.length > 5) {
        const updateNum = updateMatch ? (updateMatch[1] || updateMatch[0]) : 'Unknown';
        const date = dateMatch[0];
        const features = featuresCell;
        
        updates.push({
          update: updateMatch ? (updateMatch[0].includes('.') ? `Version ${updateNum}` : `Update ${updateNum}`) : 'Update',
          date: date,
          content: features
        });
      }
    }
  }
  
  return updates;
}

// Fetch and parse updates from Steal a Brainrot wiki
async function fetchStealABrainrotUpdates() {
  try {
    const response = await axios.get('https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)/Updates', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    const html = response.data;
    let updates = parseTableRows(html);
    
    console.log(`Parsed ${updates.length} updates from Steal a Brainrot table`);
    
    // If table parsing didn't work, try alternative method
    if (updates.length === 0) {
      console.log('Table parsing failed, trying alternative parsing method...');
      // Look for update patterns in the HTML
      const updatePattern = /Update\s*(\d+)[\s\S]*?(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})[\s\S]*?(Added|Added|Fixed|Changed)[\s\S]{0,500}/gi;
      const matches = [...html.matchAll(updatePattern)];
      
      for (const match of matches) {
        const updateNum = match[1];
        const date = match[2];
        const content = match[0].substring(0, 500).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (content.length > 50) {
          updates.push({
            update: `Update ${updateNum}`,
            date: date,
            content: content
          });
        }
      }
    }
    
    return updates.slice(0, 30).reverse(); // Most recent first
  } catch (error) {
    console.error('Error fetching Steal a Brainrot updates:', error.message);
    throw error;
  }
}

// Fetch and parse updates from Grow a Garden wiki
async function fetchGrowAGardenUpdates() {
  try {
    const response = await axios.get('https://growagarden.fandom.com/wiki/Update_Log', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    const html = response.data;
    const updates = parseTableRows(html);
    
    console.log(`Parsed ${updates.length} updates from Grow a Garden table`);
    
    return updates.slice(0, 20).reverse();
  } catch (error) {
    console.error('Error fetching Grow a Garden updates:', error.message);
    // Don't throw - this is optional
    return [];
  }
}

// Fetch and combine updates from both sources
async function fetchChangelog() {
  const allUpdates = [];
  
  try {
    // Fetch Steal a Brainrot updates (primary source)
    const brainrotUpdates = await fetchStealABrainrotUpdates();
    console.log(`Fetched ${brainrotUpdates.length} Steal a Brainrot updates`);
    brainrotUpdates.forEach(update => {
      allUpdates.push({
        ...update,
        game: 'Steal a Brainrot'
      });
    });
  } catch (error) {
    console.error('Failed to fetch Steal a Brainrot updates:', error.message);
  }
  
  try {
    // Fetch Grow a Garden updates (secondary source)
    const gardenUpdates = await fetchGrowAGardenUpdates();
    console.log(`Fetched ${gardenUpdates.length} Grow a Garden updates`);
    gardenUpdates.forEach(update => {
      allUpdates.push({
        ...update,
        game: 'Grow a Garden'
      });
    });
  } catch (error) {
    console.error('Failed to fetch Grow a Garden updates:', error.message);
  }
  
  // Sort by date (most recent first) - improved date comparison
  allUpdates.sort((a, b) => {
    // Try to parse dates for sorting - handle various formats
    let dateA, dateB;
    
    try {
      // Handle formats like "May 31, 2025" or "11/29/2025"
      dateA = new Date(a.date);
      dateB = new Date(b.date);
      
      // If parsing failed, try alternative formats
      if (isNaN(dateA) && a.date) {
        // Try to extract date components
        const parts = a.date.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
        if (parts) {
          dateA = new Date(parts[1] + ' ' + parts[2] + ', ' + parts[3]);
        }
      }
      
      if (isNaN(dateB) && b.date) {
        const parts = b.date.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
        if (parts) {
          dateB = new Date(parts[1] + ' ' + parts[2] + ', ' + parts[3]);
        }
      }
      
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA; // Most recent first
      }
    } catch (e) {
      // Fall back to string comparison if date parsing fails
      return (b.date || '').localeCompare(a.date || '');
    }
    
    return 0;
  });
  
  console.log(`Total updates fetched: ${allUpdates.length}`);
  
  // Store in cache
  newsCache = allUpdates.slice(0, 30);
  cacheTimestamp = Date.now();
  
  // Store in database for persistence
  try {
    await dbHelpers.run('DELETE FROM news_updates');
    
    for (const update of allUpdates.slice(0, 30)) {
      const content = `${update.update || ''} - ${update.content}`.substring(0, 1000);
      await dbHelpers.run(
        'INSERT INTO news_updates (date, content, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [update.date || update.update || 'Unknown Date', content]
      );
    }
  } catch (dbError) {
    console.error('Error storing news in database:', dbError);
  }
  
  return allUpdates.slice(0, 30);
}

// Get news updates
router.get('/', async (req, res) => {
  try {
    // Check cache first
    if (newsCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      if (Array.isArray(newsCache) && newsCache.length > 0) {
        return res.json(newsCache);
      }
    }
    
    // Try to fetch fresh data
    let updates = [];
    try {
      updates = await fetchChangelog();
      if (Array.isArray(updates) && updates.length > 0) {
        return res.json(updates);
      }
    } catch (fetchError) {
      console.error('Error fetching fresh news:', fetchError.message);
    }
    
    // If fetch failed or returned empty, try database cache
    try {
      const cached = await dbHelpers.all(
        'SELECT * FROM news_updates ORDER BY createdAt DESC LIMIT 30'
      );
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const dbUpdates = cached.map(u => ({
          update: u.content?.split(' - ')[0] || 'Update',
          date: u.date,
          content: u.content?.split(' - ').slice(1).join(' - ') || u.content || '',
          game: 'Steal a Brainrot' // Default
        }));
        // Update memory cache
        newsCache = dbUpdates;
        cacheTimestamp = Date.now();
        return res.json(dbUpdates);
      }
    } catch (dbError) {
      console.error('Error fetching from database:', dbError);
    }
    
    // Return cached data even if stale
    if (newsCache && Array.isArray(newsCache) && newsCache.length > 0) {
      return res.json(newsCache);
    }
    
    // Return empty array if we can't get any data
    console.warn('No news updates available from any source');
    return res.json([]);
  } catch (error) {
    console.error('Error getting news:', error);
    return res.json([]);
  }
});

// Force refresh news
router.post('/refresh', async (req, res) => {
  try {
    const updates = await fetchChangelog();
    newsCache = updates;
    cacheTimestamp = Date.now();
    res.json({ message: 'News refreshed successfully', count: updates.length });
  } catch (error) {
    console.error('Error refreshing news:', error);
    res.status(500).json({ error: 'Failed to refresh news: ' + error.message });
  }
});

module.exports = router;
