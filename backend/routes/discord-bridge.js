const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Initialize Discord bridge for a report (create thread)
router.post('/initialize', ensureAuth, ensureModerator, formLimiter, async (req, res) => {
  try {
    const { reportId, accusedDiscordId } = req.body;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const reportsChannelId = process.env.REPORTS_CHANNEL_ID || '1443391819638636585';

    if (!botToken) {
      return res.status(500).json({ error: 'Discord bot token not configured' });
    }

    if (!reportId || !accusedDiscordId) {
      return res.status(400).json({ error: 'Report ID and accused Discord ID are required' });
    }

    // Get report details
    const report = await dbHelpers.get(
      'SELECT * FROM reports WHERE id = ?',
      [reportId]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get accused user info
    const accusedUser = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [accusedDiscordId]
    );

    if (!accusedUser) {
      return res.status(404).json({ error: 'Accused user not found' });
    }

    // Get reporter info
    const reporter = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [report.reporterId]
    );

    // Get admin/moderator info (the one initiating the chat)
    const admin = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [req.user.discordId]
    );

    // Create initial message in reports channel
    const initialMessage = await axios.post(
      `https://discord.com/api/v10/channels/${reportsChannelId}/messages`,
      {
        content: `🔗 **Bridged Chat Session**\n\n**Report:** #${report.id}\n**Reporter:** ${reporter?.username || 'Unknown'} (<@${report.reporterId}>)\n**Accused:** ${accusedUser.username} (<@${accusedDiscordId}>)\n**Moderator:** ${admin.username} (<@${req.user.discordId}>)\n\n*Messages from the website will appear as if from ${accusedUser.username}*\n*Messages from Discord will appear as ${admin.username}*`
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const initialMessageId = initialMessage.data.id;

    // Create a private thread from the message
    const thread = await axios.post(
      `https://discord.com/api/v10/channels/${reportsChannelId}/messages/${initialMessageId}/threads`,
      {
        name: `Report #${report.id} - ${accusedUser.username}`,
        type: 11, // PRIVATE_THREAD
        invitable: false
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const threadId = thread.data.id;

    // Add accused user and moderator to thread
    try {
      await axios.put(
        `https://discord.com/api/v10/channels/${threadId}/thread-members/${accusedDiscordId}`,
        {},
        {
          headers: {
            Authorization: `Bot ${botToken}`
          }
        }
      );
    } catch (e) {
      console.warn('Could not add accused user to thread:', e.message);
    }

    // Store thread ID in database (we'll use a bridge_sessions table)
    await dbHelpers.run(
      `CREATE TABLE IF NOT EXISTS bridge_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportId INTEGER NOT NULL,
        threadId TEXT NOT NULL,
        accusedDiscordId TEXT NOT NULL,
        moderatorDiscordId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reportId) REFERENCES reports(id)
      )`
    );

    await dbHelpers.run(
      `INSERT INTO bridge_sessions (reportId, threadId, accusedDiscordId, moderatorDiscordId)
       VALUES (?, ?, ?, ?)`,
      [reportId, threadId, accusedDiscordId, req.user.discordId]
    );

    res.json({
      success: true,
      threadId,
      message: 'Discord bridge initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing Discord bridge:', error);
    res.status(500).json({
      error: 'Failed to initialize Discord bridge',
      details: error.response?.data || error.message
    });
  }
});

// Send message from website to Discord (appears as accused user)
router.post('/send-to-discord', ensureAuth, ensureModerator, formLimiter, async (req, res) => {
  try {
    const { reportId, content } = req.body;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: 'Discord bot token not configured' });
    }

    // Get bridge session
    const session = await dbHelpers.get(
      'SELECT * FROM bridge_sessions WHERE reportId = ?',
      [reportId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Bridge session not found. Please initialize the bridge first.' });
    }

    // Get accused user info
    const accusedUser = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [session.accusedDiscordId]
    );

    // Send message to Discord thread - we'll use webhook to make it appear as the accused user
    // First, try to get or create a webhook for this thread
    let webhookUrl = null;
    try {
      // Check if webhook exists in database
      const webhookData = await dbHelpers.get(
        'SELECT webhookUrl FROM bridge_sessions WHERE threadId = ?',
        [session.threadId]
      );
      
      if (webhookData && webhookData.webhookUrl) {
        webhookUrl = webhookData.webhookUrl;
      } else {
        // Create webhook for the thread
        const webhook = await axios.post(
          `https://discord.com/api/v10/channels/${session.threadId}/webhooks`,
          {
            name: accusedUser.username,
            avatar: accusedUser.avatar || null
          },
          {
            headers: {
              Authorization: `Bot ${botToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        webhookUrl = `https://discord.com/api/webhooks/${webhook.data.id}/${webhook.data.token}`;
        
        // Store webhook URL in database
        await dbHelpers.run(
          'ALTER TABLE bridge_sessions ADD COLUMN webhookUrl TEXT',
          () => {} // Ignore error if column already exists
        );
        await dbHelpers.run(
          'UPDATE bridge_sessions SET webhookUrl = ? WHERE threadId = ?',
          [webhookUrl, session.threadId]
        );
      }
    } catch (webhookError) {
      console.warn('Could not create/use webhook, falling back to bot message:', webhookError.message);
    }

    let message;
    let messageId;
    if (webhookUrl) {
      // Use webhook to send message as the accused user
      const webhookResponse = await axios.post(webhookUrl, {
        content: content,
        username: accusedUser.username,
        avatar_url: accusedUser.avatar || undefined
      });
      // Webhook responses don't include message ID directly, we'll use a placeholder
      messageId = webhookResponse.data?.id || `webhook-${Date.now()}`;
    } else {
      // Fallback: send as bot with accused user's name
      const botResponse = await axios.post(
        `https://discord.com/api/v10/channels/${session.threadId}/messages`,
        {
          content: `**[${accusedUser.username}]** ${content}`
        },
        {
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      messageId = botResponse.data.id;
    }

    // Store message in database as if from accused user (but actually from moderator)
    const dbMessage = await dbHelpers.run(
      `INSERT INTO messages (senderId, recipientId, content, isBridged, reportId, discordThreadId, discordMessageId)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        session.accusedDiscordId, // Appears as from accused
        session.moderatorDiscordId, // To moderator
        content,
        reportId,
        session.threadId,
        messageId
      ]
    );

    res.json({
      success: true,
      messageId: messageId,
      dbMessageId: dbMessage.lastID
    });
  } catch (error) {
    console.error('Error sending message to Discord:', error);
    res.status(500).json({
      error: 'Failed to send message to Discord',
      details: error.response?.data || error.message
    });
  }
});

// Webhook endpoint to receive messages from Discord and forward to website
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook secret if needed
    const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-webhook-secret'] !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { threadId, authorId, content, messageId } = req.body;

    if (!threadId || !authorId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find bridge session by thread ID
    const session = await dbHelpers.get(
      'SELECT * FROM bridge_sessions WHERE threadId = ?',
      [threadId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Bridge session not found' });
    }

    // Get author info
    const author = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [authorId]
    );

    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Store message in database as if from moderator (but actually from Discord user)
    // The message appears as from the moderator on the website
    const dbMessage = await dbHelpers.run(
      `INSERT INTO messages (senderId, recipientId, content, isBridged, reportId, discordThreadId, discordMessageId)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        session.moderatorDiscordId, // Appears as from moderator on website
        session.accusedDiscordId, // To accused user
        content,
        session.reportId,
        threadId,
        messageId
      ]
    );

    res.json({
      success: true,
      messageId: dbMessage.lastID
    });
  } catch (error) {
    console.error('Error processing Discord webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      details: error.message
    });
  }
});

// Get bridge session info
router.get('/session/:reportId', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const { reportId } = req.params;

    const session = await dbHelpers.get(
      'SELECT * FROM bridge_sessions WHERE reportId = ?',
      [reportId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Bridge session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching bridge session:', error);
    res.status(500).json({ error: 'Failed to fetch bridge session' });
  }
});

module.exports = router;

