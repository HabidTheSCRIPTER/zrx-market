const { dbHelpers } = require('../db/config');

// Check if user is authenticated and not blacklisted
const ensureAuth = async (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is blacklisted
  try {
    const blacklisted = await dbHelpers.get(
      'SELECT * FROM blacklist WHERE discordId = ?',
      [req.user.discordId]
    );

    if (blacklisted) {
      return res.status(403).json({ error: 'Your account has been blacklisted' });
    }

    next();
  } catch (error) {
    console.error('Error checking blacklist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is moderator or server owner
const ensureModerator = async (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await dbHelpers.get(
      'SELECT roles, discordId FROM users WHERE discordId = ?',
      [req.user.discordId]
    );

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const roles = user.roles ? JSON.parse(user.roles) : [];
    const moderatorRoleId = process.env.MODERATOR_ROLE_ID;
    const guildId = process.env.GUILD_ID;

    // Check if user has moderator role
    const hasModeratorRole = roles.includes(moderatorRoleId);

    // Check if user is server owner
    let isOwner = false;
    if (guildId && process.env.DISCORD_BOT_TOKEN) {
      try {
        const axios = require('axios').default;
        const guildResponse = await axios.get(
          `https://discord.com/api/v10/guilds/${guildId}`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
          }
        );
        isOwner = guildResponse.data.owner_id === user.discordId;
      } catch (error) {
        console.log('Could not check server ownership:', error.message);
      }
    }

    if (!hasModeratorRole && !isOwner) {
      return res.status(403).json({ error: 'Moderator access required' });
    }

    next();
  } catch (error) {
    console.error('Error checking moderator status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is verified
const ensureVerified = async (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await dbHelpers.get(
      'SELECT verified FROM users WHERE discordId = ?',
      [req.user.discordId]
    );

    if (!user || !user.verified) {
      return res.status(403).json({ error: 'Verified account required' });
    }

    next();
  } catch (error) {
    console.error('Error checking verified status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { ensureAuth, ensureModerator, ensureVerified };

