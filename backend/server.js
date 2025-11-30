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
const { initDatabase } = require('./db/config');
const { apiLimiter } = require('./middleware/rateLimit');

// Import routes
const authRoutes = require('./routes/auth');
const tradesRoutes = require('./routes/trades');
const middlemanRoutes = require('./routes/middleman');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const messagesRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const newsRoutes = require('./routes/news');
const profilesRoutes = require('./routes/profiles');
const templatesRoutes = require('./routes/templates');
const wishlistRoutes = require('./routes/wishlist');
const disputesRoutes = require('./routes/disputes');
const analyticsRoutes = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');
const reviewsRoutes = require('./routes/reviews');
const offersRoutes = require('./routes/offers');
const smartAlertsRoutes = require('./routes/smart-alerts');
const globalChatRoutes = require('./routes/global-chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust for production
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.BASE_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-min-32-chars-please',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
};

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
app.use('/api/news', newsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/disputes', disputesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/smart-alerts', smartAlertsRoutes);
app.use('/api/global-chat', globalChatRoutes);

// Serve static files from React build (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'ZRX Market API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      api: '/api'
    },
    frontend: 'http://localhost:5173'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle React routing - return all requests to React app (in production)
// This must be AFTER all API routes but BEFORE error handling
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes or auth routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ API Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('URL:', req.url);
  console.error('Method:', req.method);
  
  // Don't send stack trace to client in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - try to keep the server running
  // Log to error tracking service if available
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - try to keep the server running
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  shutdown();
});

let server;

function shutdown() {
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      const { db } = require('./db/config');
      if (db) {
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
}

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Start server after database is ready
    server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      console.log(`Frontend: http://localhost:5173`);
      if (!process.env.DISCORD_BOT_TOKEN) {
        console.log(`\n⚠️  DISCORD_BOT_TOKEN not set. Bot will not start.`);
      }
      console.log('\n✅ Server is ready!');
    });

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
        console.error('Server error:', err);
        throw err;
      }
    });

    // Keep-alive settings
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds

    // Connection error handling
    server.on('clientError', (err, socket) => {
      console.error('Client error:', err);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

  } catch (err) {
    console.error('❌ Database initialization error:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

startServer();

module.exports = app;

