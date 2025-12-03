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

// Run migrations to add missing columns
function runMigrations() {
  return new Promise((resolve) => {
    console.log('🔄 Running database migrations...');
    let migrationsRun = 0;
    let migrationsSucceeded = 0;

    // Track when individual migration tasks finish
    let pendingTasks = 0;
    let resolved = false;

    const done = () => {
      if (!resolved && pendingTasks === 0) {
        if (migrationsRun > 0) {
          console.log(`✅ Migrations complete: ${migrationsSucceeded}/${migrationsRun} succeeded`);
        }
        resolved = true;
        resolve();
      }
    };

    const scheduleTask = () => {
      migrationsRun++;
      pendingTasks++;
    };

    const finishTask = (success) => {
      if (success) migrationsSucceeded++;
      pendingTasks--;
      done();
    };

    // Check and add isCrossTrade to trades
    scheduleTask();
    db.all(`PRAGMA table_info(trades)`, [], (err, columns) => {
      if (!err && columns) {
        const hasColumn = columns.some(col => col.name === 'isCrossTrade');
        if (!hasColumn) {
          scheduleTask();
          db.run(`ALTER TABLE trades ADD COLUMN isCrossTrade INTEGER DEFAULT 0`, (alterErr) => {
            if (!alterErr) {
              console.log('✅ Added isCrossTrade column to trades');
              finishTask(true);
            } else {
              console.error('❌ Failed to add isCrossTrade:', alterErr.message);
              finishTask(false);
            }
          });
          finishTask(true);
        } else {
          finishTask(true);
        }
      } else {
        finishTask(false);
      }
    });

    // Check and add isRead to messages
    scheduleTask();
    db.all(`PRAGMA table_info(messages)`, [], (err, columns) => {
      if (!err && columns) {
        const hasColumn = columns.some(col => col.name === 'isRead');
        if (!hasColumn) {
          scheduleTask();
          db.run(`ALTER TABLE messages ADD COLUMN isRead INTEGER DEFAULT 0`, (alterErr) => {
            if (!alterErr) {
              console.log('✅ Added isRead column to messages');
              finishTask(true);
            } else {
              console.error('❌ Failed to add isRead:', alterErr.message);
              finishTask(false);
            }
          });
          finishTask(true);
        } else {
          finishTask(true);
        }
      } else {
        finishTask(false);
      }
    });

    // Ensure global_chat_messages table exists on legacy DBs
    scheduleTask();
    db.run(`CREATE TABLE IF NOT EXISTS global_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      content TEXT NOT NULL,
      isFiltered INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(discordId)
    )`, (err) => {
      if (err) {
        console.error('❌ Migration error creating global_chat_messages table:', err.message);
        finishTask(false);
      } else {
        console.log('✅ Ensured global_chat_messages table exists');
        finishTask(true);
      }
    });

    // Ensure bridge_sessions table exists on legacy DBs
    scheduleTask();
    db.run(`CREATE TABLE IF NOT EXISTS bridge_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reportId INTEGER NOT NULL,
      threadId TEXT,
      accusedDiscordId TEXT,
      moderatorDiscordId TEXT,
      webhookUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reportId) REFERENCES reports(id)
    )`, (err) => {
      if (err) {
        console.error('❌ Migration error creating bridge_sessions table:', err.message);
        finishTask(false);
      } else {
        console.log('✅ Ensured bridge_sessions table exists');
        finishTask(true);
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved && pendingTasks === 0) {
        console.log('⚠️  No migrations needed or tables do not exist yet');
        resolved = true;
        resolve();
      }
    }, 5000);
  });
}

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
            // Check if column exists first by trying to query it
            db.get(`PRAGMA table_info(trades)`, [], (pragmaErr, rows) => {
              if (!pragmaErr) {
                db.all(`PRAGMA table_info(trades)`, [], (infoErr, columns) => {
                  if (!infoErr) {
                    const hasColumn = columns.some(col => col.name === 'isCrossTrade');
                    if (!hasColumn) {
                      console.log('🔄 Adding missing isCrossTrade column to trades table...');
                      db.run(`ALTER TABLE trades ADD COLUMN isCrossTrade INTEGER DEFAULT 0`, (alterErr) => {
                        if (alterErr) {
                          console.error('❌ Failed to add isCrossTrade column:', alterErr.message);
                        } else {
                          console.log('✅ Successfully added isCrossTrade column');
                        }
                      });
                    } else {
                      console.log('✅ isCrossTrade column already exists');
                    }
                  }
                });
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
          reportId INTEGER,
          isBridged INTEGER DEFAULT 0,
          discordThreadId TEXT,
          discordMessageId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tradeId) REFERENCES trades(id),
          FOREIGN KEY (senderId) REFERENCES users(discordId),
          FOREIGN KEY (recipientId) REFERENCES users(discordId),
          FOREIGN KEY (reportId) REFERENCES reports(id)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating messages table:', err.message);
            hasError = true;
            errors.push({ table: 'messages', error: err });
          } else {
            // Add missing columns if table already exists (migration)
            db.all(`PRAGMA table_info(messages)`, [], (infoErr, columns) => {
              if (!infoErr) {
                const columnNames = columns.map(col => col.name);
                const columnsToAdd = [
                  { name: 'isRead', sql: 'ALTER TABLE messages ADD COLUMN isRead INTEGER DEFAULT 0' },
                  { name: 'reportId', sql: 'ALTER TABLE messages ADD COLUMN reportId INTEGER' },
                  { name: 'isBridged', sql: 'ALTER TABLE messages ADD COLUMN isBridged INTEGER DEFAULT 0' },
                  { name: 'discordThreadId', sql: 'ALTER TABLE messages ADD COLUMN discordThreadId TEXT' },
                  { name: 'discordMessageId', sql: 'ALTER TABLE messages ADD COLUMN discordMessageId TEXT' }
                ];

                columnsToAdd.forEach(({ name, sql }) => {
                  if (!columnNames.includes(name)) {
                    console.log(`🔄 Adding missing ${name} column to messages table...`);
                    db.run(sql, (alterErr) => {
                      if (alterErr) {
                        console.error(`❌ Failed to add ${name} column:`, alterErr.message);
                      } else {
                        console.log(`✅ Successfully added ${name} column`);
                      }
                    });
                  } else {
                    console.log(`✅ ${name} column already exists`);
                  }
                });
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
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating global_chat_messages table:', err.message);
            hasError = true;
            errors.push({ table: 'global_chat_messages', error: err });
          }
        });

        // Trade Reviews table
        db.run(`CREATE TABLE IF NOT EXISTS trade_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tradeId INTEGER,
          reviewerId TEXT NOT NULL,
          revieweeId TEXT NOT NULL,
          rating INTEGER NOT NULL,
          comment TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tradeId) REFERENCES trades(id),
          FOREIGN KEY (reviewerId) REFERENCES users(discordId),
          FOREIGN KEY (revieweeId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating trade_reviews table:', err.message);
            hasError = true;
            errors.push({ table: 'trade_reviews', error: err });
          }
        });

        // Trade Templates table
        db.run(`CREATE TABLE IF NOT EXISTS trade_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          name TEXT NOT NULL,
          offered TEXT NOT NULL,
          wanted TEXT NOT NULL,
          value TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating trade_templates table:', err.message);
            hasError = true;
            errors.push({ table: 'trade_templates', error: err });
          }
        });

        // Disputes table
        db.run(`CREATE TABLE IF NOT EXISTS disputes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tradeId INTEGER NOT NULL,
          reporterId TEXT NOT NULL,
          accusedId TEXT NOT NULL,
          reason TEXT NOT NULL,
          evidence TEXT,
          status TEXT DEFAULT 'open',
          resolution TEXT,
          moderatorId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tradeId) REFERENCES trades(id),
          FOREIGN KEY (reporterId) REFERENCES users(discordId),
          FOREIGN KEY (accusedId) REFERENCES users(discordId)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating disputes table:', err.message);
            hasError = true;
            errors.push({ table: 'disputes', error: err });
          }
        });

        // Bridge sessions table (for Discord bridge threads)
        db.run(`CREATE TABLE IF NOT EXISTS bridge_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reportId INTEGER NOT NULL,
          threadId TEXT,
          accusedDiscordId TEXT,
          moderatorDiscordId TEXT,
          webhookUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reportId) REFERENCES reports(id)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating bridge_sessions table:', err.message);
            hasError = true;
            errors.push({ table: 'bridge_sessions', error: err });
          } else {
            // Ensure webhookUrl column exists (for older deployments)
            db.run(`ALTER TABLE bridge_sessions ADD COLUMN webhookUrl TEXT`, (alterErr) => {
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('⚠️  Could not add webhookUrl column to bridge_sessions (may already exist):', alterErr.message);
              }
            });
          }
        });

        // Guild settings table (for AI channel configuration)
        db.run(`CREATE TABLE IF NOT EXISTS guild_settings (
          guildId TEXT PRIMARY KEY,
          aiChannelId TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating guild_settings table:', err.message);
            hasError = true;
            errors.push({ table: 'guild_settings', error: err });
          }
        });

        // AI conversations table
        db.run(`CREATE TABLE IF NOT EXISTS ai_conversations (
          userId TEXT PRIMARY KEY,
          history TEXT NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating ai_conversations table:', err.message);
            hasError = true;
            errors.push({ table: 'ai_conversations', error: err });
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

module.exports = { db, initDatabase, runMigrations, dbHelpers };

