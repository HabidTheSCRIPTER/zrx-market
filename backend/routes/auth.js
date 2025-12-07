const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { authLimiter } = require('../middleware/rateLimit');

// Discord OAuth2 login
router.get('/discord', authLimiter, passport.authenticate('discord'));

// Discord OAuth2 callback
router.get(
  '/discord/callback',
  authLimiter,
  (req, res, next) => {
    // Log callback attempt for debugging
    console.log('🔐 Discord OAuth callback received');
    console.log('  - Query params:', req.query);
    console.log('  - Session ID:', req.sessionID);
    
    passport.authenticate('discord', (err, user, info) => {
      if (err) {
        console.error('❌ Discord OAuth error:', err);
        return res.redirect('/?error=auth_failed&reason=' + encodeURIComponent(err.message));
      }
      
      if (!user) {
        console.error('❌ Discord OAuth failed - no user:', info);
        return res.redirect('/?error=auth_failed&reason=' + encodeURIComponent(info?.message || 'Authentication failed'));
      }
      
      // Log in the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Login error:', loginErr);
          return res.redirect('/?error=auth_failed&reason=session_failed');
        }
        
        console.log('✅ User logged in successfully:', user.discordId);
        console.log('  - Session ID:', req.sessionID);
        console.log('  - Cookie will be set with secure:', process.env.NODE_ENV === 'production');
        
        // Save session before redirect
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('❌ Session save error:', saveErr);
          }
          
          // Use absolute URL for redirect to ensure it works
          const redirectUrl = process.env.FRONTEND_URL || process.env.BASE_URL || req.protocol + '://' + req.get('host');
          const fullRedirectUrl = redirectUrl + '/dashboard';
          console.log('  - Redirecting to:', fullRedirectUrl);
          res.redirect(fullRedirectUrl);
        });
      });
    })(req, res, next);
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    // Clear session cookie explicitly
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
      }
      
      // Clear cookie
      res.clearCookie('zrxmarket.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      
    res.json({ message: 'Logged out successfully' });
    });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Check if session exists
    if (!req.session) {
      console.log('⚠️  No session found in /me');
      return res.json({ user: null, inGuild: false, sessionError: true });
    }
    
    // Check if user is authenticated
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
      res.json({ user, inGuild: true });
    } catch (error) {
      console.error('Error in /me:', error);
      res.json({ user: null, inGuild: false });
    }
  } else {
      // User not authenticated - but don't aggressively clear session
      // Only clear if session is explicitly invalid or expired
      // This prevents clearing valid sessions that are just being checked
      if (req.sessionID && req.session.cookie && req.session.cookie.expires) {
        const expires = new Date(req.session.cookie.expires);
        if (expires < new Date()) {
          // Session expired, safe to clear
          console.log('⚠️  Session expired, clearing:', req.sessionID);
          req.session.destroy(() => {});
        }
        // Otherwise, keep session for potential re-authentication
      }
    res.json({ user: null, inGuild: false });
  }
  } catch (error) {
    console.error('Error in /me route:', error);
    res.json({ user: null, inGuild: false, error: true });
  }
});

// Clear session endpoint (for debugging/fixing cookie issues)
router.post('/clear-session', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.clearCookie('zrxmarket.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    res.json({ message: 'Session cleared' });
  });
});

module.exports = router;

