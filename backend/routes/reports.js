const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get users that the reporter has interacted with (messages)
router.get('/interactions', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.discordId;
    console.log(`[INTERACTIONS] Fetching interactions for user: ${userId}`);
    
    // First, check if user has any messages at all
    const messageCount = await dbHelpers.get(
      'SELECT COUNT(*) as count FROM messages WHERE senderId = ? OR recipientId = ?',
      [userId, userId]
    );
    
    console.log(`[INTERACTIONS] Total messages for user ${userId}: ${messageCount?.count || 0}`);
    
    // Get all unique user IDs the current user has messaged with
    // The CASE statement already handles getting the "other" user, so we just need to filter
    // where the current user is either sender or recipient (but not both - no self-messages)
    const userPairs = await dbHelpers.all(
      `SELECT DISTINCT 
        CASE 
          WHEN senderId = ? THEN recipientId 
          ELSE senderId 
        END as otherUserId
       FROM messages
       WHERE (senderId = ? OR recipientId = ?)
       AND NOT (senderId = ? AND recipientId = ?)`,
      [userId, userId, userId, userId, userId]
    );

    console.log(`[INTERACTIONS] Found ${userPairs?.length || 0} unique user pairs`);

    if (!userPairs || userPairs.length === 0) {
      console.log(`[INTERACTIONS] No message interactions found for user ${userId}`);
      return res.json([]);
    }

    // Extract unique user IDs
    const otherUserIds = [...new Set(userPairs.map(pair => pair.otherUserId).filter(Boolean))];
    console.log(`[INTERACTIONS] Unique user IDs: ${otherUserIds.join(', ')}`);

    // Get user info for each ID
    const interactions = await Promise.all(
      otherUserIds.map(async (otherUserId) => {
        try {
          const user = await dbHelpers.get(
            'SELECT discordId, username, avatar FROM users WHERE discordId = ?',
            [otherUserId]
          );
          
          if (user) {
            return {
              discordId: user.discordId,
              username: user.username || 'Unknown User',
              avatar: user.avatar || null
            };
          } else {
            console.log(`[INTERACTIONS] User ${otherUserId} not found in users table`);
            return null;
          }
        } catch (err) {
          console.error(`[INTERACTIONS] Error fetching user ${otherUserId}:`, err);
          return null;
        }
      })
    );

    // Filter out null values and sort by username
    const validInteractions = interactions
      .filter(interaction => interaction !== null)
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    console.log(`[INTERACTIONS] Returning ${validInteractions.length} valid interactions for user ${userId}`);
    console.log(`[INTERACTIONS] Interactions:`, validInteractions.map(i => `${i.username} (${i.discordId})`).join(', '));
    
    res.json(validInteractions || []);
  } catch (error) {
    console.error('[INTERACTIONS] Error fetching interactions:', error);
    console.error('[INTERACTIONS] Error stack:', error.stack);
    // Return empty array instead of error to prevent frontend from breaking
    res.json([]);
  }
});

// Get all reports (moderator only)
router.get('/', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const status = req.query.status || null;
    let query = `SELECT r.*, u.username as reporterUsername, u.avatar as reporterAvatar
                 FROM reports r
                 JOIN users u ON r.reporterId = u.discordId`;
    let params = [];

    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.createdAt DESC';

    const reports = await dbHelpers.all(query, params);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to send report notification to Discord channel
async function sendReportToDiscord(report) {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = '1443391819638636585'; // Scammer reports channel
    
    if (!botToken) {
      console.warn('⚠️  DISCORD_BOT_TOKEN not set. Cannot send report to Discord.');
      return null;
    }

    // Get reporter and accused user info
    const reporter = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [report.reporterId]
    );
    
    const accused = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [report.accusedDiscordId]
    );

    const evidenceLinks = report.evidenceLinks ? JSON.parse(report.evidenceLinks) : [];
    
    // Build embed content
    const embed = {
      title: `🚨 Scammer Report #${report.id}`,
      color: 0xFF0000,
      fields: [
        {
          name: 'Reporter',
          value: `<@${report.reporterId}> (${reporter?.username || 'Unknown'})`,
          inline: true
        },
        {
          name: 'Accused',
          value: `<@${report.accusedDiscordId}> (${accused?.username || 'Unknown'})`,
          inline: true
        },
        {
          name: 'Details',
          value: report.details.length > 1024 ? report.details.substring(0, 1020) + '...' : report.details,
          inline: false
        }
      ],
      footer: {
        text: `Report ID: ${report.id}`
      },
      timestamp: new Date(report.createdAt).toISOString()
    };

    if (evidenceLinks.length > 0) {
      embed.fields.push({
        name: 'Evidence Links',
        value: evidenceLinks.join('\n'),
        inline: false
      });
    }

    // Create buttons
    const components = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 1, // PRIMARY
            custom_id: `report_request_info_${report.id}`,
            label: 'Request More Info',
            emoji: { name: '💬' }
          },
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS
            custom_id: `report_chat_accused_${report.id}`,
            label: 'Chat with Accused',
            emoji: { name: '📱' }
          },
          {
            type: 2, // BUTTON
            style: 5, // LINK
            label: 'View on Website',
            url: `${process.env.BASE_URL || 'http://localhost:5173'}/admin/reports/${report.id}`
          }
        ]
      }
    ];

    // Send message to Discord channel
    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        embeds: [embed],
        components: components
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const messageId = response.data.id;
    console.log(`✅ Sent scammer report #${report.id} to Discord channel ${channelId}`);

    // Store Discord message ID in database
    await dbHelpers.run(
      'UPDATE reports SET discordMessageId = ? WHERE id = ?',
      [messageId, report.id]
    );

    // Try to emit event to bot if it's available (for future use)
    if (global.middlemanBot) {
      global.middlemanBot.emit('newReport', report);
    }

    return messageId;
  } catch (error) {
    console.error('❌ Error sending report to Discord:', error.response?.data || error.message);
    // Don't throw - report was still created in database
    return null;
  }
}

// Create report
router.post('/', ensureAuth, formLimiter, upload.array('evidenceImages', 10), async (req, res) => {
  try {
    const { tradeId, accusedDiscordId } = req.body;
    const userId = req.user.discordId;

    if (!tradeId) {
      return res.status(400).json({ error: 'Trade ID is required' });
    }

    // Get the trade
    const trade = await dbHelpers.get(
      'SELECT * FROM trades WHERE id = ?',
      [tradeId]
    );

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Determine accused user from trade
    const accused = accusedDiscordId || (trade.creatorId === userId ? null : trade.creatorId);
    
    // If requester is not the creator, find the other user from messages
    let accusedUserId = accused;
    if (!accusedUserId) {
      const message = await dbHelpers.get(
        `SELECT senderId, recipientId FROM messages 
         WHERE tradeId = ? AND (senderId = ? OR recipientId = ?)
         LIMIT 1`,
        [tradeId, userId, userId]
      );
      if (message) {
        accusedUserId = message.senderId === userId ? message.recipientId : message.senderId;
      }
    }

    if (!accusedUserId) {
      return res.status(400).json({ error: 'Could not determine the accused user in this trade' });
    }

    // Validate that the accused user is someone the reporter has interacted with
    const hasInteracted = await dbHelpers.get(
      `SELECT 1 FROM messages 
       WHERE ((senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?))
       LIMIT 1`,
      [userId, accusedUserId, accusedUserId, userId]
    );

    if (!hasInteracted && trade.creatorId !== accusedUserId) {
      return res.status(400).json({ 
        error: 'You can only report someone you have messaged or traded with.' 
      });
    }

    // Handle uploaded images
    const evidenceLinks = req.files ? req.files.map(file => `/uploads/reports/${file.filename}`) : [];

    // Create details from trade
    const offered = JSON.parse(trade.offered || '[]');
    const wanted = JSON.parse(trade.wanted || '[]');
    const details = `Report for Trade #${tradeId}: ${offered.map(i => i.name).join(', ')} for ${wanted.map(i => i.name).join(', ')}${trade.value ? ` (${trade.value})` : ''}`;

    const result = await dbHelpers.run(
      `INSERT INTO reports (reporterId, accusedDiscordId, details, evidenceLinks)
       VALUES (?, ?, ?, ?)`,
      [userId, accusedUserId, details, JSON.stringify(evidenceLinks)]
    );

    const report = await dbHelpers.get(
      'SELECT * FROM reports WHERE id = ?',
      [result.lastID]
    );

    // Send report to Discord channel
    await sendReportToDiscord(report);

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update report status (moderator only)
router.patch('/:id/status', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const { status } = req.body;

    await dbHelpers.run(
      'UPDATE reports SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'update_report_status', req.params.id, JSON.stringify({ status })]
    );

    const report = await dbHelpers.get(
      'SELECT * FROM reports WHERE id = ?',
      [req.params.id]
    );

    res.json(report);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request more info for a report (moderator only)
router.post('/:id/request-info', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const report = await dbHelpers.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Update report to mark that more info was requested
    await dbHelpers.run(
      'UPDATE reports SET requestedMoreInfo = 1 WHERE id = ?',
      [req.params.id]
    );

    // Log admin action
    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [req.user.discordId, 'request_report_info', req.params.id, 'Requested more information']
    );

    // Notify via bot if available
    if (global.middlemanBot) {
      global.middlemanBot.emit('reportRequestMoreInfo', {
        reportId: req.params.id,
        moderatorId: req.user.discordId,
        reporterId: report.reporterId,
        accusedId: report.accusedDiscordId
      });
    }

    res.json({ message: 'More info requested successfully' });
  } catch (error) {
    console.error('Error requesting more info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

