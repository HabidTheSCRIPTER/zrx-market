const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database configuration
// Try multiple paths to find a writable location
let DB_PATH = path.join(__dirname, '../../data/zrx-market.db');
let DB_DIR = path.dirname(DB_PATH);

// Try alternative paths if the default doesn't work
const possiblePaths = [
  path.join(__dirname, '../../data/zrx-market.db'), // Default: project root/data
  path.join(process.cwd(), 'data/zrx-market.db'), // Working directory/data
  path.join(__dirname, '../data/zrx-market.db'), // backend/data
  '/tmp/zrx-market.db' // Temp directory (usually writable on Railway)
];

// Ensure data directory exists for the first path
if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log('✅ Created data directory:', DB_DIR);
  } catch (mkdirErr) {
    console.warn('⚠️  Could not create data directory:', mkdirErr.message);
    // Try using working directory
    const fallbackDir = path.join(process.cwd(), 'data');
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
        DB_DIR = fallbackDir;
        DB_PATH = path.join(DB_DIR, 'zrx-market.db');
        console.log('✅ Using fallback data directory:', DB_DIR);
      }
    } catch (fallbackErr) {
      console.warn('⚠️  Could not create fallback directory:', fallbackErr.message);
    }
  }
}

console.log('📁 Database path:', DB_PATH);
console.log('📁 Current working directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

// Create database connection with explicit flags
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    console.error('❌ Database path:', DB_PATH);
    console.error('❌ Error code:', err.code, 'Error number:', err.errno);
  } else {
    console.log('✅ Connected to SQLite database');
    // Test if database is writable
    db.run('PRAGMA journal_mode = WAL;', (pragmaErr) => {
      if (pragmaErr) {
        console.warn('⚠️  Warning: Could not set WAL mode, database may be read-only:', pragmaErr.message);
      } else {
        console.log('✅ Database is writable (WAL mode enabled)');
      }
    });
  }
});

// Initialize database schema
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Check if database is available
    if (!db) {
      console.error('❌ Database connection not available');
      reject(new Error('Database connection not available'));
      return;
    }

    // Test database writability first
    db.run('PRAGMA journal_mode = WAL;', (pragmaErr) => {
      if (pragmaErr) {
        console.error('❌ Database is not writable:', pragmaErr.message);
        console.error('❌ Error code:', pragmaErr.code, 'Error number:', pragmaErr.errno);
        if (pragmaErr.code === 'SQLITE_IOERR' || pragmaErr.errno === 10) {
          console.error('❌ SQLITE_IOERR detected - filesystem may be read-only or path is incorrect');
          console.error('❌ This is a critical error. The application may not function correctly.');
        }
        // Still try to continue, but log the error
      }

      db.serialize(() => {
        let hasError = false;
        const errors = [];

        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
          discordId TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          avatar TEXT,
          verified INTEGER DEFAULT 0,
          robloxUsername TEXT,
          roles TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating users table:', err.message);
            console.error('❌ Error code:', err.code, 'Error number:', err.errno);
            hasError = true;
            errors.push({ table: 'users', error: err });
          }
        });

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
          isCrossTrade INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creatorId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating trades table:', err.message);
            hasError = true;
            errors.push({ table: 'trades', error: err });
          } else {
            // Add missing isCrossTrade column if table already exists (migration)
            db.run(`ALTER TABLE trades ADD COLUMN isCrossTrade INTEGER DEFAULT 0`, (alterErr) => {
              // Ignore error if column already exists
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add isCrossTrade column (may already exist):', alterErr.message);
              }
            });
          }
        });

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
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (requesterId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating middleman table:', err.message);
            hasError = true;
            errors.push({ table: 'middleman', error: err });
          } else {
            // Add missing columns if table already exists (migration)
            db.run(`ALTER TABLE middleman ADD COLUMN threadId TEXT`, (alterErr) => {
              // Ignore error if column already exists
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add threadId column (may already exist):', alterErr.message);
              }
            });
            db.run(`ALTER TABLE middleman ADD COLUMN user1Accepted INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add user1Accepted column (may already exist):', alterErr.message);
              }
            });
            db.run(`ALTER TABLE middleman ADD COLUMN user2Accepted INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add user2Accepted column (may already exist):', alterErr.message);
              }
            });
          }
        });

        // Reports table
        db.run(`CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporterId TEXT NOT NULL,
          accusedDiscordId TEXT NOT NULL,
          details TEXT NOT NULL,
          evidenceLinks TEXT,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reporterId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating reports table:', err.message);
            hasError = true;
            errors.push({ table: 'reports', error: err });
          }
        });

        // Blacklist table
        db.run(`CREATE TABLE IF NOT EXISTS blacklist (
          discordId TEXT PRIMARY KEY,
          reason TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating blacklist table:', err.message);
            hasError = true;
            errors.push({ table: 'blacklist', error: err });
          }
        });

        // Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tradeId INTEGER,
          senderId TEXT NOT NULL,
          recipientId TEXT NOT NULL,
          content TEXT NOT NULL,
          isRead INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tradeId) REFERENCES trades(id),
          FOREIGN KEY (senderId) REFERENCES users(discordId),
          FOREIGN KEY (recipientId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating messages table:', err.message);
            hasError = true;
            errors.push({ table: 'messages', error: err });
          } else {
            // Add missing isRead column if table already exists (migration)
            db.run(`ALTER TABLE messages ADD COLUMN isRead INTEGER DEFAULT 0`, (alterErr) => {
              // Ignore error if column already exists
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add isRead column (may already exist):', alterErr.message);
              }
            });
          }
        });

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
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating notifications table:', err.message);
            hasError = true;
            errors.push({ table: 'notifications', error: err });
          } else {
            // Add missing isRead column if table already exists (migration)
            db.run(`ALTER TABLE notifications ADD COLUMN isRead INTEGER DEFAULT 0`, (alterErr) => {
              // Ignore error if column already exists
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add isRead column to notifications (may already exist):', alterErr.message);
              }
            });
          }
        });

        // Admin logs table
        db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actorId TEXT NOT NULL,
          action TEXT NOT NULL,
          targetId TEXT,
          details TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (actorId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating admin_logs table:', err.message);
            hasError = true;
            errors.push({ table: 'admin_logs', error: err });
          }
        });

        db.run('CREATE INDEX IF NOT EXISTS idx_trades_creator ON trades(creatorId)', (err) => {
          if (err) {
            console.error('Error creating index idx_trades_creator:', err.message);
            hasError = true;
          }
        });
        db.run('CREATE INDEX IF NOT EXISTS idx_middleman_requester ON middleman(requesterId)', (err) => {
          if (err) {
            console.error('Error creating index idx_middleman_requester:', err.message);
            hasError = true;
          }
        });
        db.run('CREATE INDEX IF NOT EXISTS idx_middleman_status ON middleman(status)', (err) => {
          if (err) {
            console.error('Error creating index idx_middleman_status:', err.message);
            hasError = true;
          }
        });
        db.run('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)', (err) => {
          if (err) {
            console.error('Error creating index idx_reports_status:', err.message);
            hasError = true;
          } else {
            // All done
            if (hasError) {
              console.warn('⚠️  Database schema initialized with errors. Some tables may not be available.');
              console.warn('⚠️  Errors:', errors.map(e => `${e.table}: ${e.error.message}`).join(', '));
            } else {
              console.log('✅ Database schema initialized');
            }
            // Resolve even with errors - let the app continue
            resolve();
          }
        });
      });
    });
  });
}

// Helper functions for database operations
const dbHelpers = {
  get: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  run: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

module.exports = { db, initDatabase, dbHelpers };

