const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbHelpers } = require('../db/config');
const { ensureAuth, ensureModerator, ensureVerified } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/middleman');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
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

// Function to create acceptance thread
async function createAcceptanceThread(request) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.MIDDLEMAN_CHANNEL_ID;

  if (!botToken || !channelId) {
    throw new Error('Discord bot token or channel ID not configured');
  }

  // Extract user IDs
  const user1Id = request.user1 ? String(request.user1).replace(/[<@!>]/g, '') : '';
  const user2Id = request.user2 ? String(request.user2).replace(/[<@!>]/g, '') : '';

  if (!user1Id || !user2Id) {
    throw new Error('Invalid user IDs in request');
  }

  // Get requester info
  const requester = await dbHelpers.get(
    'SELECT * FROM users WHERE discordId = ?',
    [request.requesterId]
  );

  const proofLinks = request.proofLinks ? JSON.parse(request.proofLinks) : [];
  
  // Convert relative paths to full URLs
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const fullProofUrls = proofLinks.map(link => {
    if (link.startsWith('http')) return link;
    return `${baseUrl}${link.startsWith('/') ? link : '/' + link}`;
  });

  // Create initial message
  const initialMessageResponse = await axios.post(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      content: `🔒 **Trade Agreement Required**\n\n<@${user1Id}> and <@${user2Id}> must both accept this trade by reacting with ✅ within 5 minutes.\n\nOnce both parties accept, the request will be added to the waitlist on the website and a middleman can accept it.\n\nIf both parties don't accept, this thread will be automatically deleted.`
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const initialMessageId = initialMessageResponse.data.id;

  // Create private thread from the message
  const threadResponse = await axios.post(
    `https://discord.com/api/v10/channels/${channelId}/messages/${initialMessageId}/threads`,
    {
      name: `MM-${request.id} | ${(request.item || 'Trade').substring(0, 50)}`,
      type: 12, // Private thread
      auto_archive_duration: 60 // 1 hour
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const threadId = threadResponse.data.id;
  console.log(`✅ Created acceptance thread: ${threadResponse.data.name} (${threadId})`);

  // Store thread ID in database
  await dbHelpers.run(
    'UPDATE middleman SET threadId = ? WHERE id = ?',
    [threadId, request.id]
  );

  // Wait a moment for Discord to fully initialize the thread
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify thread exists and bot can access it
  try {
    const threadCheck = await axios.get(
      `https://discord.com/api/v10/channels/${threadId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      }
    );
    console.log(`✅ Verified thread access. Thread type: ${threadCheck.data.type} (11=public, 12=private)`);
  } catch (error) {
    console.error(`❌ Cannot access thread ${threadId}:`, error.response?.data || error.message);
  }

  // Add users to thread
  const usersToAdd = [request.requesterId, user1Id, user2Id];
  const uniqueUsers = [...new Set(usersToAdd.filter(id => id && id.length > 0))];
  
  for (const userId of uniqueUsers) {
    try {
      // First, verify user is in the server
      const guildId = process.env.GUILD_ID;
      if (guildId) {
        try {
          await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
            {
              headers: {
                Authorization: `Bot ${botToken}`
              }
            }
          );
        } catch (memberError) {
          if (memberError.response?.status === 404) {
            console.error(`❌ User ${userId} is not in the server. Skipping thread add.`);
            continue;
          }
        }
      }

      // Add user to thread
      await axios.put(
        `https://discord.com/api/v10/channels/${threadId}/thread-members/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ Added user ${userId} to thread ${threadId}`);
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      if (status === 403) {
        // For private threads, 403 might mean the user needs to be mentioned first
        // or the bot's role hierarchy is too low
        console.error(`❌ Permission denied adding user ${userId} to thread.`);
        console.error(`   Error: ${JSON.stringify(errorData)}`);
        console.error(`   Possible causes:`);
        console.error(`   - Bot's role is lower than user's role in hierarchy`);
        console.error(`   - User needs to be mentioned in thread first`);
        console.error(`   - Thread permissions are restrictive`);
      } else if (status === 404) {
        console.error(`❌ User ${userId} not found or not in server.`);
      } else if (status === 429) {
        console.error(`❌ Rate limited when adding user ${userId}. Will retry...`);
        // Wait and retry once
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await axios.put(
            `https://discord.com/api/v10/channels/${threadId}/thread-members/${userId}`,
            {},
            {
              headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`✅ Added user ${userId} to thread after retry`);
        } catch (retryError) {
          console.error(`❌ Retry also failed for user ${userId}`);
        }
      } else {
        console.error(`⚠️ Could not add user ${userId} to thread:`, errorData || error.message);
      }
      console.log(`   User ${userId} can join the thread manually if needed.`);
    }
  }

  // Build embed for trade details
  const embed = {
    title: `📋 Trade Agreement - Request #${request.id}`,
    color: 0xFFA500,
    description: '**Both parties must accept this trade by reacting with ✅**\n\nYou have 5 minutes to both accept, or this thread will be deleted.',
    fields: [
      { name: '👤 Requester', value: `<@${request.requesterId}>`, inline: true },
      { name: '👥 User 1', value: `<@${user1Id}>`, inline: true },
      { name: '👥 User 2', value: `<@${user2Id}>`, inline: true },
      { name: '🛒 Item/Details', value: request.item || 'N/A', inline: false },
      { name: '💰 Value', value: request.value || 'N/A', inline: true },
      { name: '🎮 Roblox Username', value: request.robloxUsername || 'N/A', inline: true }
    ],
    footer: { text: `Request ID: ${request.id} | React with ✅ to accept` },
    timestamp: new Date(request.createdAt).toISOString()
  };

  // Add first image as embed image, rest as links
  if (fullProofUrls.length > 0) {
    embed.image = { url: fullProofUrls[0] };
    if (fullProofUrls.length > 1) {
      embed.fields.push({ 
        name: `📎 Proof Images (${fullProofUrls.length} total)`, 
        value: fullProofUrls.slice(1).map((url, idx) => `[Image ${idx + 2}](${url})`).join('\n'), 
        inline: false 
      });
    }
  }

  // Send acceptance message
  const acceptMessageResponse = await axios.post(
    `https://discord.com/api/v10/channels/${threadId}/messages`,
    {
      content: `<@${user1Id}> <@${user2Id}>\n\n**Please react with ✅ to accept this trade.**\n\n⏰ You have 5 minutes. If both parties don't accept, this thread will be deleted.`,
      embeds: [embed]
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const acceptMessageId = acceptMessageResponse.data.id;

  // Add ✅ reaction
  await axios.put(
    `https://discord.com/api/v10/channels/${threadId}/messages/${acceptMessageId}/reactions/✅/@me`,
    {},
    {
      headers: {
        Authorization: `Bot ${botToken}`
      }
    }
  );

  console.log(`✅ Acceptance thread created and ready. Message ID: ${acceptMessageId}`);
  // Note: Bot will automatically detect reactions and set up timers on startup
  
  return { threadId, messageId: acceptMessageId };
}

// Function to post middleman request to Discord
async function postMiddlemanRequestToDiscord(request) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.MIDDLEMAN_CHANNEL_ID;
  const roleId = process.env.MIDDLEMAN_ROLE_ID;

  console.log('📤 Attempting to post middleman request to Discord...');
  console.log('Channel ID from env:', channelId);
  console.log('Request ID:', request.id);

  if (!botToken || !channelId) {
    throw new Error('Discord bot token or channel ID not configured');
  }

  // Get requester info
  const requester = await dbHelpers.get(
    'SELECT * FROM users WHERE discordId = ?',
    [request.requesterId]
  );

  const proofLinks = request.proofLinks ? JSON.parse(request.proofLinks) : [];
  
  // Convert relative paths to full URLs
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const fullProofUrls = proofLinks.map(link => {
    if (link.startsWith('http')) return link;
    return `${baseUrl}${link.startsWith('/') ? link : '/' + link}`;
  });

  // Build embed payload
  const embed = {
    title: `Middleman Request #${request.id}`,
    color: 0x5865F2,
    fields: [
      { name: 'Requester', value: requester?.username || 'Unknown', inline: true },
      { name: 'User 1', value: request.user1, inline: true },
      { name: 'User 2', value: request.user2, inline: true },
      { name: 'Item/Details', value: request.item, inline: false },
      { name: 'Value', value: request.value || 'N/A', inline: true },
      { name: 'Roblox Username', value: request.robloxUsername || 'N/A', inline: true }
    ],
    footer: { text: `Request ID: ${request.id}` },
    timestamp: new Date(request.createdAt).toISOString()
  };

  // Add first image as embed image, rest as links
  if (fullProofUrls.length > 0) {
    embed.image = { url: fullProofUrls[0] };
    if (fullProofUrls.length > 1) {
      embed.fields.push({ 
        name: `📎 Proof Images (${fullProofUrls.length} total)`, 
        value: fullProofUrls.slice(1).map((url, idx) => `[Image ${idx + 2}](${url})`).join('\n'), 
        inline: false 
      });
    }
  }

  // Post to Discord
  // Try without role mention first (role mentions can cause 403 if bot can't mention roles)
  let content = 'New middleman request!';
  if (roleId) {
    // Try with role mention, but we'll catch if it fails
    content = `<@&${roleId}> New middleman request!`;
  }

  try {
    // First, verify the bot can access the channel and check permissions
    try {
      const channelCheck = await axios.get(
        `https://discord.com/api/v10/channels/${channelId}`,
        {
          headers: {
            Authorization: `Bot ${botToken}`
          }
        }
      );
      console.log('✅ Channel access verified. Channel name:', channelCheck.data.name);
      console.log('Channel type:', channelCheck.data.type, '(0=text, 2=voice, 4=category, 5=announcement, 15=forum)');
      
      // Get bot's member info to check permissions
      const guildId = process.env.GUILD_ID;
      if (guildId) {
        try {
          const botInfo = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/members/${channelCheck.data.guild_id ? (await axios.get(`https://discord.com/api/v10/oauth2/applications/@me`, { headers: { Authorization: `Bot ${botToken}` } })).data.id : null}`,
            {
              headers: {
                Authorization: `Bot ${botToken}`
              }
            }
          );
        } catch (e) {
          // Ignore - just trying to get bot user ID
        }
      }
    } catch (checkError) {
      console.error('❌ Cannot access channel:', checkError.response?.status, checkError.response?.data);
      throw new Error(`Cannot access channel ${channelId}. Bot may not be in server or lacks View Channel permission.`);
    }

    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        content: content,
        embeds: [embed]
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        },
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      }
    );

    const status = Number(response.status);
    console.log('Response status:', status, '(type:', typeof response.status, ')');
    
    if (status === 200 || status === 201) {
      console.log('✅ Successfully posted middleman request to Discord. Message ID:', response.data.id);
      return response.data;
    } else if (status === 403) {
      console.log('⚠️ Got 403, attempting retry without role mention...');
      // Handle 403 - try without role mention
      console.error('❌ 403 Forbidden - Bot lacks permissions');
      console.error('Error details:', JSON.stringify(response.data, null, 2));
      
      // Try again without role mention if that was the issue
      if (roleId && content.includes('@&')) {
        console.log('🔄 Retrying without role mention...');
        try {
          const retryResponse = await axios.post(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
              content: 'New middleman request!',
              embeds: [embed]
            },
            {
              headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('✅ Successfully posted without role mention. Message ID:', retryResponse.data.id);
          return retryResponse.data;
        } catch (retryError) {
          console.error('❌ Retry also failed:', retryError.response?.status, retryError.response?.data);
          throw new Error(`Bot doesn't have permission to send messages. Error: ${JSON.stringify(retryError.response?.data || retryError.message)}`);
        }
      } else {
        throw new Error(`Bot doesn't have permission to send messages in channel ${channelId}. Error: ${JSON.stringify(response.data)}`);
      }
    } else {
      // Log the full response for debugging
      console.error('❌ Unexpected response status:', status);
      console.error('Response data:', JSON.stringify(response.data, null, 2));
      throw new Error(`Unexpected status: ${status} - ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 403) {
        console.error('❌ 403 Forbidden - Bot lacks permissions');
        console.error('Channel ID:', channelId);
        console.error('Error details:', JSON.stringify(data, null, 2));
        throw new Error(`Bot doesn't have permission to send messages in channel ${channelId}. Error: ${JSON.stringify(data)}`);
      } else if (status === 404) {
        console.error('❌ 404 Not Found - Channel not found');
        console.error('Channel ID:', channelId);
        throw new Error(`Channel ${channelId} not found. Check MIDDLEMAN_CHANNEL_ID in .env`);
      } else if (status === 401) {
        console.error('❌ 401 Unauthorized - Invalid bot token');
        throw new Error('Invalid bot token. Check DISCORD_BOT_TOKEN in .env');
      } else {
        console.error(`❌ Error ${status}:`, JSON.stringify(data, null, 2));
        throw new Error(`Discord API error: ${status} - ${JSON.stringify(data)}`);
      }
    }
    throw error;
  }
}

// Get pending middleman requests (moderator only)
router.get('/pending', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const requests = await dbHelpers.all(
      `SELECT m.*, u.username, u.avatar FROM middleman m
       JOIN users u ON m.requesterId = u.discordId
       WHERE m.status = 'pending' OR m.status = 'waiting_confirmation'
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

// Create acceptance thread for a request (called by bot)
router.post('/:id/create-thread', async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [requestId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.threadId) {
      return res.json({ message: 'Thread already exists', threadId: request.threadId });
    }

    const { threadId } = await createAcceptanceThread(request);
    res.json({ threadId, message: 'Thread created successfully' });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
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
router.post('/', ensureAuth, ensureVerified, formLimiter, upload.array('proofImages', 10), async (req, res) => {
  try {
    const { tradeId, user2 } = req.body;
    const requesterId = req.user.discordId;

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

    // Parse trade data
    const offered = JSON.parse(trade.offered || '[]');
    const wanted = JSON.parse(trade.wanted || '[]');
    
    // Determine user1 (the other party)
    const user1 = trade.creatorId === requesterId 
      ? null // If requester is creator, we need to find the other user from messages
      : trade.creatorId;

    // If requester is not the creator, find the other user from messages
    let otherUserId = user1;
    if (!otherUserId) {
      const message = await dbHelpers.get(
        `SELECT senderId, recipientId FROM messages 
         WHERE tradeId = ? AND (senderId = ? OR recipientId = ?)
         LIMIT 1`,
        [tradeId, requesterId, requesterId]
      );
      if (message) {
        otherUserId = message.senderId === requesterId ? message.recipientId : message.senderId;
      }
    }

    if (!otherUserId) {
      return res.status(400).json({ error: 'Could not determine the other party in this trade' });
    }

    // Ensure user2 matches the requester
    if (user2 !== requesterId) {
      return res.status(400).json({ error: 'Invalid request. Please try again.' });
    }

    // Handle uploaded images
    const proofLinks = req.files ? req.files.map(file => `/uploads/middleman/${file.filename}`) : [];

    // Create item description from trade
    const item = `Trade #${tradeId}: ${offered.map(i => i.name).join(', ')} for ${wanted.map(i => i.name).join(', ')}`;

    const result = await dbHelpers.run(
      `INSERT INTO middleman (requesterId, user1, user2, item, value, proofLinks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        requesterId,
        otherUserId,
        user2,
        item,
        trade.value || null,
        JSON.stringify(proofLinks),
        'waiting_confirmation'
      ]
    );

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [result.lastID]
    );

    // Create acceptance thread directly using bot token
    try {
      await createAcceptanceThread(request);
      console.log(`✅ Acceptance thread created for request #${request.id}`);
    } catch (error) {
      console.error('❌ Error creating acceptance thread:', error.message);
      // Thread creation failed, but request was still created
      // The bot will set up timers for pending threads on startup
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating middleman request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request MM from chat (both parties need to request)
router.post('/request-from-chat', ensureAuth, async (req, res) => {
  try {
    const { tradeId, recipientId } = req.body;
    const requesterId = req.user.discordId;

    if (!tradeId || !recipientId) {
      return res.status(400).json({ error: 'Trade ID and recipient ID are required' });
    }

    // Check cooldown (20 minutes)
    const cooldownMinutes = 20;
    const cooldown = await dbHelpers.get(
      'SELECT * FROM user_mm_cooldowns WHERE userId = ?',
      [requesterId]
    );

    if (cooldown) {
      const lastRequestTime = new Date(cooldown.lastRequestAt);
      const now = new Date();
      const minutesSinceLastRequest = (now - lastRequestTime) / (1000 * 60);
      
      if (minutesSinceLastRequest < cooldownMinutes) {
        const remainingMinutes = Math.ceil(cooldownMinutes - minutesSinceLastRequest);
        return res.status(429).json({ 
          error: `Please wait ${remainingMinutes} minute(s) before requesting MM again.`,
          cooldownRemaining: remainingMinutes * 60 * 1000 // milliseconds
        });
      }
    }

    const trade = await dbHelpers.get('SELECT * FROM trades WHERE id = ?', [tradeId]);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const user1 = trade.creatorId;
    const user2 = recipientId === trade.creatorId ? requesterId : recipientId;

    let mmRequest = await dbHelpers.get(
      'SELECT * FROM middleman WHERE tradeId = ? AND ((user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?))',
      [tradeId, user1, user2, user2, user1]
    );

    if (!mmRequest) {
      const offered = JSON.parse(trade.offered || '[]');
      const wanted = JSON.parse(trade.wanted || '[]');
      const item = `Trade #${tradeId}: ${offered.map(i => i.name).join(', ')} for ${wanted.map(i => i.name).join(', ')}`;

      const result = await dbHelpers.run(
        `INSERT INTO middleman (requesterId, user1, user2, item, value, tradeId, status, user1RequestedMM, user2RequestedMM)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [requesterId, user1, user2, item, trade.value || null, tradeId, 'waiting_confirmation',
         requesterId === user1 ? 1 : 0, requesterId === user2 ? 1 : 0]
      );

      mmRequest = await dbHelpers.get('SELECT * FROM middleman WHERE id = ?', [result.lastID]);
    } else {
      if (requesterId === user1) {
        await dbHelpers.run('UPDATE middleman SET user1RequestedMM = 1 WHERE id = ?', [mmRequest.id]);
      } else if (requesterId === user2) {
        await dbHelpers.run('UPDATE middleman SET user2RequestedMM = 1 WHERE id = ?', [mmRequest.id]);
      }
    }

    // Update cooldown - only if this is a new request (not updating existing)
    if (!mmRequest || (requesterId === user1 && mmRequest.user1RequestedMM === 0) || 
        (requesterId === user2 && mmRequest.user2RequestedMM === 0)) {
      // This is a new request, update cooldown
      await dbHelpers.run(
        `INSERT OR REPLACE INTO user_mm_cooldowns (userId, lastRequestAt) VALUES (?, ?)`,
        [requesterId, new Date().toISOString()]
      );
    }

    const updatedRequest = await dbHelpers.get('SELECT * FROM middleman WHERE id = ?', [mmRequest.id]);

    if (updatedRequest.user1RequestedMM === 1 && updatedRequest.user2RequestedMM === 1) {
      await dbHelpers.run('UPDATE middleman SET status = ? WHERE id = ?', ['pending', updatedRequest.id]);

      try {
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const channelId = process.env.MIDDLEMAN_CHANNEL_ID;
        
        if (botToken && channelId) {
          const user1Data = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [user1]);
          const user2Data = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [user2]);
          const roleMention = process.env.MIDDLEMAN_ROLE_ID ? `<@&${process.env.MIDDLEMAN_ROLE_ID}>` : '';
          
          await axios.post(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
              content: `🎉 **Middleman Request from Website Chat**\n\n${roleMention} Both parties have requested a middleman!\n\n**Trade:** ${updatedRequest.item}\n\n**Participants:**\n- <@${user1}> (${user1Data?.username || 'Unknown'})\n- <@${user2}> (${user2Data?.username || 'Unknown'})\n\n**Trade ID:** #${tradeId}\n\nView: ${process.env.BASE_URL || 'http://localhost:3000'}/middleman`
            },
            { headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' } }
          );
        }
      } catch (discordError) {
        console.error('Error sending Discord notification:', discordError);
      }
    }

    res.json({
      success: true,
      mmRequest: updatedRequest,
      bothRequested: updatedRequest.user1RequestedMM === 1 && updatedRequest.user2RequestedMM === 1
    });
  } catch (error) {
    console.error('Error requesting MM from chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get MM request status for a trade/chat
router.get('/chat-status/:tradeId', ensureAuth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    const userId = req.user.discordId;

    const request = await dbHelpers.get(
      `SELECT * FROM middleman WHERE tradeId = ? AND (user1 = ? OR user2 = ?) ORDER BY createdAt DESC LIMIT 1`,
      [tradeId, userId, userId]
    );

    // Check cooldown
    const cooldown = await dbHelpers.get(
      'SELECT * FROM user_mm_cooldowns WHERE userId = ?',
      [userId]
    );

    let cooldownRemaining = 0;
    if (cooldown) {
      const lastRequestTime = new Date(cooldown.lastRequestAt);
      const now = new Date();
      const minutesSinceLastRequest = (now - lastRequestTime) / (1000 * 60);
      const cooldownMinutes = 20;
      
      if (minutesSinceLastRequest < cooldownMinutes) {
        cooldownRemaining = Math.ceil((cooldownMinutes - minutesSinceLastRequest) * 60 * 1000); // milliseconds
      }
    }

    if (!request) {
      return res.json({ 
        hasRequest: false,
        cooldownRemaining 
      });
    }

    res.json({
      hasRequest: true,
      user1Requested: request.user1RequestedMM === 1,
      user2Requested: request.user2RequestedMM === 1,
      bothRequested: request.user1RequestedMM === 1 && request.user2RequestedMM === 1,
      status: request.status,
      userIsUser1: request.user1 === userId,
      cooldownRemaining
    });
  } catch (error) {
    console.error('Error fetching MM chat status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update middleman request status (moderator only)
router.patch('/:id/status', ensureAuth, ensureModerator, async (req, res) => {
  try {
    const { status, middlemanId } = req.body;

    if (!['pending', 'waiting_confirmation', 'accepted', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // If accepting a request that's waiting_confirmation, check if both parties confirmed
    if (status === 'accepted') {
      const currentRequest = await dbHelpers.get(
        'SELECT * FROM middleman WHERE id = ?',
        [req.params.id]
      );
      
      if (currentRequest && currentRequest.status === 'waiting_confirmation') {
        if (currentRequest.user1Accepted !== 1 || currentRequest.user2Accepted !== 1) {
          return res.status(400).json({ error: 'Cannot accept request until both parties have confirmed the trade' });
        }
      }
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

