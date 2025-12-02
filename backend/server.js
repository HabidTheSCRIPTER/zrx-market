const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('./config/passport');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initDatabase, runMigrations } = require('./db/config');
const { apiLimiter } = require('./middleware/rateLimit');

// Import routes
const authRoutes = require('./routes/auth');
const tradesRoutes = require('./routes/trades');
const middlemanRoutes = require('./routes/middleman');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const messagesRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const globalChatRoutes = require('./routes/global-chat');
const smartAlertsRoutes = require('./routes/smart-alerts');
const profilesRoutes = require('./routes/profiles');
const reviewsRoutes = require('./routes/reviews');
const notificationsRoutes = require('./routes/notifications');
const offersRoutes = require('./routes/offers');
const wishlistRoutes = require('./routes/wishlist');
const brainrotRoutes = require('./routes/brainrot-values');
const templatesRoutes = require('./routes/templates');
const disputesRoutes = require('./routes/disputes');
const newsRoutes = require('./routes/news');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust for production
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - supports both www and non-www versions of zrxmarket.com
const allowedOrigins = [
  process.env.BASE_URL,
  process.env.FRONTEND_URL,
  'https://zrxmarket.com',
  'https://www.zrxmarket.com',
  'http://localhost:5173' // Development fallback
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : 'http://localhost:5173',
  credentials: true
}));

// Trust proxy configuration - only enable in production behind a reverse proxy
// Set to 1 if behind one proxy (like nginx), or specific IP if you know the proxy IP
// Set to false if not behind a proxy
if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', process.env.TRUST_PROXY || 1);
} else {
  app.set('trust proxy', false);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
const isHTTPS = process.env.BASE_URL?.startsWith('https://') || isProduction;

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-min-32-chars-please',
  resave: false,
  saveUninitialized: false,
  name: 'zrxmarket.sid', // Custom session name to avoid conflicts
  cookie: {
    secure: isHTTPS, // Only send over HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: isHTTPS ? 'none' : 'lax', // 'none' for cross-site (Discord OAuth), 'lax' for same-site
    // Don't set domain - let browser handle it automatically for subdomain compatibility
    path: '/' // Available on all paths
  }
};

// Log cookie settings for debugging
console.log('🍪 Session cookie configuration:');
console.log('  - Secure:', sessionConfig.cookie.secure);
console.log('  - SameSite:', sessionConfig.cookie.sameSite);
console.log('  - HTTPOnly:', sessionConfig.cookie.httpOnly);
console.log('  - Production:', isProduction);
console.log('  - HTTPS:', isHTTPS);

// Only use SQLiteStore if data directory exists
try {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  sessionConfig.store = new SQLiteStore({
    db: 'sessions.db',
    dir: dataDir
  });
} catch (err) {
  console.warn('Could not initialize SQLite session store, using memory store:', err.message);
}

app.use(session(sessionConfig));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/middleman', middlemanRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/global-chat', globalChatRoutes);
app.use('/api/smart-alerts', smartAlertsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/brainrot', brainrotRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/disputes', disputesRoutes);
app.use('/api/news', newsRoutes);

// Health check (before static files)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend static files (after API routes)
// Frontend is built and copied to public/ directory during Docker build
const frontendPath = path.join(__dirname, 'public');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  // This must be last to catch all routes not handled above
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // If frontend not built, show API info at root
  app.get('/', (req, res) => {
    res.json({
      message: 'ZRX Market API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/auth',
        api: '/api'
      },
      frontend: process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173'
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    // Run migrations to add any missing columns
    await runMigrations();
    
    // Start server after database is ready
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      console.log(`Frontend: ${process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173'}`);
    });

    // Start Discord bot if token is provided
    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        // Start bot in the same process
        // Try multiple possible paths depending on deployment structure
        const path = require('path');
        const fs = require('fs');
        
        // Debug: Log current directory info
        console.log(`📁 Current working directory: ${process.cwd()}`);
        console.log(`📁 __dirname: ${__dirname}`);
        
        let botPath = null;
        // Try different possible paths
        const possiblePaths = [
          '/bot/index.js', // Absolute path - Railway Dockerfile copies bot here
          path.join(__dirname, '../bot/index.js'),  // Local dev: backend/../bot/index.js
          path.join(process.cwd(), 'bot/index.js'), // Railway: /app/bot/index.js if cwd is /app
          path.join(__dirname, '../../bot/index.js'), // Alternative structure
          '/app/bot/index.js', // Alternative absolute path
          path.join(process.cwd(), '../bot/index.js'), // Another alternative
          path.join(process.cwd(), 'backend/../bot/index.js') // If cwd is project root
        ];
        
        console.log(`🔍 Checking bot paths...`);
        for (const testPath of possiblePaths) {
          console.log(`  - Checking: ${testPath} (exists: ${fs.existsSync(testPath)})`);
          if (fs.existsSync(testPath)) {
            botPath = testPath;
            console.log(`✅ Found bot at: ${botPath}`);
            break;
          }
        }
        
        if (botPath) {
          console.log(`🤖 Starting Discord bot from: ${botPath}`);
          require(botPath);
          console.log('🤖 Discord bot module loaded');
        } else {
          console.warn('⚠️  Could not find bot/index.js. Bot will not start.');
          console.warn('📝 Note: If deploying on Railway, ensure the root directory is set to the project root, not /backend');
          console.warn('   Or configure Railway to include the bot directory in the deployment.');
          // Don't exit - server can still run without bot
        }
      } catch (botError) {
        console.error('❌ Failed to start Discord bot:', botError.message);
        console.error('Bot error stack:', botError.stack);
        // Don't exit - server can still run without bot
      }
    } else {
      console.log(`\n⚠️  DISCORD_BOT_TOKEN not set. Bot will not start.`);
    }

    // Handle port already in use error
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error('Please kill the process using this port or change the PORT in .env');
        console.error(`\nTo find and kill the process:`);
        console.error(`  netstat -ano | findstr :${PORT}`);
        console.error(`  taskkill /F /PID <PID>`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;

