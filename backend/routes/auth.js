const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { authLimiter } = require('../middleware/rateLimit');

// Discord OAuth2 login
router.get('/discord', authLimiter, (req, res, next) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Discord OAuth is not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env file.' });
  }
  passport.authenticate('discord')(req, res, next);
});

// Discord OAuth2 callback
router.get(
  '/discord/callback',
  authLimiter,
  (req, res, next) => {
    // Frontend URL - default to common Vite dev server port
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      return res.redirect(`${frontendUrl}/?error=oauth_not_configured`);
    }
    
    passport.authenticate('discord', {
      failureRedirect: `${frontendUrl}/?error=auth_failed`,
      successRedirect: `${frontendUrl}/dashboard`
    })(req, res, (err) => {
      // Handle authentication errors
      if (err) {
        console.error('Discord OAuth callback error:', err);
        if (err.code === 'invalid_client') {
          return res.redirect(`${frontendUrl}/?error=invalid_credentials`);
        }
        return res.redirect(`${frontendUrl}/?error=auth_failed`);
      }
      // Check for failure info from passport
      if (req.authInfo && req.authInfo.message) {
        console.log('Auth failure reason:', req.authInfo.message);
        if (req.authInfo.message.includes('member of the Discord server')) {
          return res.redirect(`${frontendUrl}/?error=not_in_guild`);
        }
        if (req.authInfo.message.includes('blacklisted')) {
          return res.redirect(`${frontendUrl}/?error=blacklisted`);
        }
      }
      next();
    });
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    try {
      // Check if user is blacklisted
      const { dbHelpers } = require('../db/config');
      const blacklisted = await dbHelpers.get(
        'SELECT * FROM blacklist WHERE discordId = ?',
        [req.user.discordId]
      );

      if (blacklisted) {
        req.logout(() => {});
        return res.json({ user: null, inGuild: false, blacklisted: true });
      }

      const user = { ...req.user };
      user.roles = user.roles ? JSON.parse(user.roles) : [];
      
      // Check if user is server owner
      let isOwner = false;
      const guildId = process.env.GUILD_ID;
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
          isOwner = guildResponse.data.owner_id === req.user.discordId;
        } catch (error) {
          // Silently fail
        }
      }
      user.isOwner = isOwner;
      
      res.json({ user, inGuild: true });
    } catch (error) {
      console.error('Error in /me:', error);
      res.json({ user: null, inGuild: false });
    }
  } else {
    res.json({ user: null, inGuild: false });
  }
});

module.exports = router;

