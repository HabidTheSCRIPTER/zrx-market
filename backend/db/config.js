const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database configuration
// Use Railway's persistent storage or local data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'zrx-market.db');
const DB_DIR = DATA_DIR;

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection with error handling and retry logic
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    console.error('Stack:', err.stack);
  } else {
    console.log('✅ Connected to SQLite database');
    // Configure database for better reliability
    db.configure('busyTimeout', 30000); // 30 second timeout
  }
});

// Database error handlers
db.on('error', (err) => {
  console.error('❌ Database error:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit - SQLite will handle retries
});

// Connection health check
let isDbHealthy = true;

function checkDbHealth() {
  return new Promise((resolve) => {
    db.get('SELECT 1 as health', [], (err) => {
      if (err) {
        console.error('❌ Database health check failed:', err.message);
        isDbHealthy = false;
        resolve(false);
      } else {
        isDbHealthy = true;
        resolve(true);
      }
    });
  });
}

// Periodic health check (every 5 minutes)
setInterval(async () => {
  const healthy = await checkDbHealth();
  if (!healthy) {
    console.warn('⚠️  Database connection unhealthy, attempting recovery...');
  }
}, 5 * 60 * 1000);

// Initialize database schema
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop tables if they exist to ensure clean schema updates during development
      db.run(`DROP TABLE IF EXISTS trade_offers`);
      db.run(`DROP TABLE IF EXISTS trades`);
      db.run(`DROP TABLE IF EXISTS messages`);
      db.run(`DROP TABLE IF EXISTS users`);
      db.run(`DROP TABLE IF EXISTS middleman`);
      db.run(`DROP TABLE IF EXISTS reports`);
      db.run(`DROP TABLE IF EXISTS blacklist`);
      db.run(`DROP TABLE IF EXISTS admin_logs`);

      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        discordId TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar TEXT,
        verified INTEGER DEFAULT 0,
        robloxUsername TEXT,
        roles TEXT,
        bio TEXT,
        tradeCount INTEGER DEFAULT 0,
        completedTrades INTEGER DEFAULT 0,
        cancelledTrades INTEGER DEFAULT 0,
        averageRating REAL DEFAULT 0,
        totalRatings INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) console.error('Error creating users table:', err);
      });
      // Add new columns if they don't exist
      db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN tradeCount INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN completedTrades INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN cancelledTrades INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN averageRating REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN totalRatings INTEGER DEFAULT 0`, () => {});

      // Trades table
      db.run(`CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creatorId TEXT NOT NULL,
        offered TEXT NOT NULL,
        wanted TEXT NOT NULL,
        value TEXT,
        notes TEXT,
        robloxUsername TEXT,
        status TEXT DEFAULT 'active',
        brainrotSecret TEXT,
        gameCategory TEXT,
        isCrossTrade INTEGER DEFAULT 0,
        completedBy TEXT,
        completedAt DATETIME,
        cancelledAt DATETIME,
        viewCount INTEGER DEFAULT 0,
        favoriteCount INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creatorId) REFERENCES users(discordId),
        FOREIGN KEY (completedBy) REFERENCES users(discordId)
      )`);
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE trades ADD COLUMN brainrotSecret TEXT`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN gameCategory TEXT`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN isCrossTrade INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN completedBy TEXT`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN completedAt DATETIME`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN cancelledAt DATETIME`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN viewCount INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE trades ADD COLUMN favoriteCount INTEGER DEFAULT 0`, () => {});

      // Middleman requests table
      db.run(`CREATE TABLE IF NOT EXISTS middleman (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requesterId TEXT NOT NULL,
        user1 TEXT NOT NULL,
        user2 TEXT NOT NULL,
        item TEXT NOT NULL,
        value TEXT,
        proofLinks TEXT,
        robloxUsername TEXT,
        status TEXT DEFAULT 'pending',
        middlemanId TEXT,
        threadId TEXT,
        user1Accepted INTEGER DEFAULT 0,
        user2Accepted INTEGER DEFAULT 0,
        requestedTip TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requesterId) REFERENCES users(discordId)
      )`, (err) => {
        if (err) console.error('Error creating middleman table:', err);
        // Add new columns if they don't exist (for existing databases)
        db.run(`ALTER TABLE middleman ADD COLUMN threadId TEXT`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN user1Accepted INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN user2Accepted INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN requestedTip TEXT`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN user1RequestedMM INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN user2RequestedMM INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE middleman ADD COLUMN tradeId INTEGER`, () => {});
      });

      // User MM request cooldown table
      db.run(`CREATE TABLE IF NOT EXISTS user_mm_cooldowns (
        userId TEXT PRIMARY KEY,
        lastRequestAt DATETIME NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(discordId)
      )`);

      // Global chat messages table
      db.run(`CREATE TABLE IF NOT EXISTS global_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT,
        content TEXT NOT NULL,
        isFiltered INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId)
      )`);

      // Reports table
      db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporterId TEXT NOT NULL,
        accusedDiscordId TEXT NOT NULL,
        details TEXT NOT NULL,
        evidenceLinks TEXT,
        status TEXT DEFAULT 'pending',
        discordMessageId TEXT,
        requestedMoreInfo INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporterId) REFERENCES users(discordId)
      )`);
      
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE reports ADD COLUMN discordMessageId TEXT`, () => {});
      db.run(`ALTER TABLE reports ADD COLUMN requestedMoreInfo INTEGER DEFAULT 0`, () => {});

      // Blacklist table
      db.run(`CREATE TABLE IF NOT EXISTS blacklist (
        discordId TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Messages table
      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tradeId INTEGER,
        senderId TEXT NOT NULL,
        recipientId TEXT NOT NULL,
        content TEXT NOT NULL,
        isRead INTEGER DEFAULT 0,
        discordThreadId TEXT,
        isBridged INTEGER DEFAULT 0,
        reportId INTEGER,
        discordMessageId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        FOREIGN KEY (senderId) REFERENCES users(discordId),
        FOREIGN KEY (recipientId) REFERENCES users(discordId),
        FOREIGN KEY (reportId) REFERENCES reports(id)
      )`);
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE messages ADD COLUMN isRead INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE messages ADD COLUMN discordThreadId TEXT`, () => {});
      db.run(`ALTER TABLE messages ADD COLUMN isBridged INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE messages ADD COLUMN reportId INTEGER`, () => {});
      db.run(`ALTER TABLE messages ADD COLUMN discordMessageId TEXT`, () => {});

      // Trade offers/inquiries table - tracks offers made on trades
      db.run(`CREATE TABLE IF NOT EXISTS trade_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tradeId INTEGER NOT NULL,
        offererId TEXT NOT NULL,
        offeredItems TEXT NOT NULL,
        wantedItems TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        message TEXT,
        counterOffer TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        FOREIGN KEY (offererId) REFERENCES users(discordId)
      )`);
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE trade_offers ADD COLUMN offeredItems TEXT`, () => {});
      db.run(`ALTER TABLE trade_offers ADD COLUMN wantedItems TEXT`, () => {});
      db.run(`ALTER TABLE trade_offers ADD COLUMN status TEXT DEFAULT 'pending'`, () => {});
      db.run(`ALTER TABLE trade_offers ADD COLUMN message TEXT`, () => {});
      db.run(`ALTER TABLE trade_offers ADD COLUMN counterOffer TEXT`, () => {});
      db.run(`ALTER TABLE trade_offers ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});

      // Trade reviews/ratings table
      db.run(`CREATE TABLE IF NOT EXISTS trade_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tradeId INTEGER NOT NULL,
        reviewerId TEXT NOT NULL,
        revieweeId TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        FOREIGN KEY (reviewerId) REFERENCES users(discordId),
        FOREIGN KEY (revieweeId) REFERENCES users(discordId),
        UNIQUE(tradeId, reviewerId, revieweeId)
      )`);

      // Notifications table
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        isRead INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId)
      )`);

      // Wishlist/watchlist table
      db.run(`CREATE TABLE IF NOT EXISTS wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        tradeId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId),
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        UNIQUE(userId, tradeId)
      )`);

      // Trade favorites/bookmarks
      db.run(`CREATE TABLE IF NOT EXISTS trade_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        tradeId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId),
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        UNIQUE(userId, tradeId)
      )`);

      // Trade templates
      db.run(`CREATE TABLE IF NOT EXISTS trade_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        offered TEXT NOT NULL,
        wanted TEXT NOT NULL,
        value TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId)
      )`);

      // Disputes table
      db.run(`CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tradeId INTEGER NOT NULL,
        reporterId TEXT NOT NULL,
        accusedId TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence TEXT,
        status TEXT DEFAULT 'open',
        moderatorId TEXT,
        resolution TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolvedAt DATETIME,
        FOREIGN KEY (tradeId) REFERENCES trades(id),
        FOREIGN KEY (reporterId) REFERENCES users(discordId),
        FOREIGN KEY (accusedId) REFERENCES users(discordId),
        FOREIGN KEY (moderatorId) REFERENCES users(discordId)
      )`);

      // Admin logs table
      db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actorId TEXT NOT NULL,
        action TEXT NOT NULL,
        targetId TEXT,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actorId) REFERENCES users(discordId)
      )`);

      // News updates table
      db.run(`CREATE TABLE IF NOT EXISTS news_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Brainrot values table
      db.run(`CREATE TABLE IF NOT EXISTS brainrot_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        value REAL NOT NULL DEFAULT 0,
        rarity TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bridge sessions table for Discord bridge
      db.run(`CREATE TABLE IF NOT EXISTS bridge_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportId INTEGER NOT NULL,
        threadId TEXT NOT NULL,
        accusedDiscordId TEXT NOT NULL,
        moderatorDiscordId TEXT NOT NULL,
        webhookUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reportId) REFERENCES reports(id)
      )`);

      // Smart Alerts table
      db.run(`CREATE TABLE IF NOT EXISTS smart_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        itemName TEXT,
        gameCategory TEXT,
        maxPrice REAL,
        minPrice REAL,
        priceUnit TEXT,
        mutation TEXT,
        traits TEXT,
        isActive INTEGER DEFAULT 1,
        lastTriggered DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(discordId)
      )`);

      db.run('CREATE INDEX IF NOT EXISTS idx_trades_creator ON trades(creatorId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_smart_alerts_user ON smart_alerts(userId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_smart_alerts_active ON smart_alerts(isActive)');
      db.run('CREATE INDEX IF NOT EXISTS idx_middleman_requester ON middleman(requesterId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_middleman_status ON middleman(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trade_offers_trade ON trade_offers(tradeId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trade_offers_offerer ON trade_offers(offererId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_messages_trade ON messages(tradeId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipientId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trades_creator ON trades(creatorId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trade_reviews_reviewee ON trade_reviews(revieweeId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(isRead)');
      db.run('CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(userId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_favorites_user ON trade_favorites(userId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)');

      console.log('Database schema initialized');
      resolve();
    });
  });
}

// Helper functions for database operations with retry logic
const dbHelpers = {
  get: (query, params = [], retries = 3) => {
    return new Promise((resolve, reject) => {
      const attempt = (remaining) => {
        db.get(query, params, (err, row) => {
          if (err) {
            if (err.code === 'SQLITE_BUSY' && remaining > 0) {
              // Retry on busy database
              setTimeout(() => attempt(remaining - 1), 100);
            } else {
              console.error('Database get error:', err.message);
              console.error('Query:', query.substring(0, 100));
              reject(err);
            }
          } else {
            resolve(row);
          }
        });
      };
      attempt(retries);
    });
  },

  all: (query, params = [], retries = 3) => {
    return new Promise((resolve, reject) => {
      const attempt = (remaining) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            if (err.code === 'SQLITE_BUSY' && remaining > 0) {
              // Retry on busy database
              setTimeout(() => attempt(remaining - 1), 100);
            } else {
              console.error('Database all error:', err.message);
              console.error('Query:', query.substring(0, 100));
              reject(err);
            }
          } else {
            resolve(rows || []);
          }
        });
      };
      attempt(retries);
    });
  },

  run: (query, params = [], retries = 3) => {
    return new Promise((resolve, reject) => {
      const attempt = (remaining) => {
        db.run(query, params, function(err) {
          if (err) {
            if (err.code === 'SQLITE_BUSY' && remaining > 0) {
              // Retry on busy database
              setTimeout(() => attempt(remaining - 1), 100);
            } else {
              console.error('Database run error:', err.message);
              console.error('Query:', query.substring(0, 100));
              reject(err);
            }
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      };
      attempt(retries);
    });
  }
};

module.exports = { db, initDatabase, dbHelpers, checkDbHealth };

