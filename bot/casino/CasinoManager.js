const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EmbedBuilder } = require('discord.js');

class CasinoManager {
  constructor(db) {
    this.db = db;
    this.activeGames = new Map(); // Store active game sessions
    this.casinoEnabled = true;
    // Initialize database asynchronously, don't block constructor
    this.initializeDatabase().catch((err) => {
      console.error('Failed to initialize casino database:', err.message);
      console.warn('⚠️  Casino features will be disabled');
      this.casinoEnabled = false;
    });
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      // Use a timeout to prevent hanging if database is locked
      const timeout = setTimeout(() => {
        console.warn('⚠️  Casino database initialization timeout');
        this.casinoEnabled = false;
        resolve(); // Resolve instead of reject
      }, 5000);

      // Check if database is available and writable
      if (!this.db) {
        console.warn('⚠️  Casino database not available');
        this.casinoEnabled = false;
        clearTimeout(timeout);
        resolve();
        return;
      }

      try {
        // Test if database is writable by running a simple query
        this.db.run('PRAGMA journal_mode = WAL;', (pragmaErr) => {
          if (pragmaErr) {
            console.error('Error setting database journal mode:', pragmaErr.message);
            console.warn('⚠️  Casino features will be disabled - database may be read-only');
            this.casinoEnabled = false;
            clearTimeout(timeout);
            resolve();
            return;
          }

          // Now try to create the table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS casino_balances (
              discordId TEXT PRIMARY KEY,
              balance INTEGER DEFAULT 1000,
              totalWon INTEGER DEFAULT 0,
              totalLost INTEGER DEFAULT 0,
              gamesPlayed INTEGER DEFAULT 0,
              lastDaily TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            clearTimeout(timeout);
            if (err) {
              console.error('Error creating casino_balances table:', err.message);
              console.error('Error code:', err.code, 'Error number:', err.errno);
              // Check if it's a permission/I/O error
              if (err.code === 'SQLITE_IOERR' || err.errno === 10) {
                console.warn('⚠️  Database I/O error detected - this may be due to filesystem restrictions on Railway');
                console.warn('⚠️  Casino features will be disabled. Database may be in a read-only location.');
              } else {
                console.warn('⚠️  Casino features will be disabled due to database error');
              }
              this.casinoEnabled = false;
              resolve(); // Resolve instead of reject to prevent bot crash
            } else {
              console.log('✅ Casino database initialized');
              this.casinoEnabled = true;
              resolve();
            }
          });
        });
      } catch (syncErr) {
        clearTimeout(timeout);
        console.error('Synchronous error in casino database init:', syncErr.message);
        this.casinoEnabled = false;
        resolve(); // Resolve to prevent crash
      }
    });
  }

  async getBalance(userId) {
    // Check if casino is enabled
    if (!this.casinoEnabled) {
      throw new Error('Casino features are disabled due to database issues');
    }

    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Database query timed out'));
      }, 3000);

      if (!this.db) {
        clearTimeout(timeout);
        reject(new Error('Database connection not available'));
        return;
      }

      this.db.get(
        'SELECT balance FROM casino_balances WHERE discordId = ?',
        [userId],
        (err, row) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else if (row) {
            resolve(row.balance);
          } else {
            // Create new user with starting balance
            this.db.run(
              'INSERT INTO casino_balances (discordId, balance) VALUES (?, 1000)',
              [userId],
              (err) => {
                if (err) reject(err);
                else resolve(1000);
              }
            );
          }
        }
      );
    });
  }

  async updateBalance(userId, amount, won = false) {
    return new Promise((resolve, reject) => {
      const db = this.db; // Store reference to avoid context issues
      if (won) {
        db.run(
          `UPDATE casino_balances 
           SET balance = balance + ?, 
               totalWon = totalWon + ?,
               gamesPlayed = gamesPlayed + 1,
               updatedAt = CURRENT_TIMESTAMP
           WHERE discordId = ?`,
          [amount, Math.abs(amount), userId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              if (this.changes === 0) {
                // User doesn't exist, create them
                db.run(
                  'INSERT INTO casino_balances (discordId, balance, totalWon, totalLost, gamesPlayed) VALUES (?, ?, ?, ?, 1)',
                  [userId, 1000 + amount, Math.abs(amount), 0],
                  (err) => {
                    if (err) reject(err);
                    else resolve(1000 + amount);
                  }
                );
              } else {
                db.get(
                  'SELECT balance FROM casino_balances WHERE discordId = ?',
                  [userId],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row.balance);
                  }
                );
              }
            }
          }
        );
      } else {
        db.run(
          `UPDATE casino_balances 
           SET balance = balance + ?, 
               totalLost = totalLost + ?,
               gamesPlayed = gamesPlayed + 1,
               updatedAt = CURRENT_TIMESTAMP
           WHERE discordId = ?`,
          [amount, Math.abs(amount), userId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              if (this.changes === 0) {
                // User doesn't exist, create them
                db.run(
                  'INSERT INTO casino_balances (discordId, balance, totalWon, totalLost, gamesPlayed) VALUES (?, ?, ?, ?, 1)',
                  [userId, 1000 + amount, 0, Math.abs(amount)],
                  (err) => {
                    if (err) reject(err);
                    else resolve(1000 + amount);
                  }
                );
              } else {
                db.get(
                  'SELECT balance FROM casino_balances WHERE discordId = ?',
                  [userId],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row.balance);
                  }
                );
              }
            }
          }
        );
      }
    });
  }

  async getStats(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM casino_balances WHERE discordId = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(row);
          } else {
            // Create new user
            this.db.run(
              'INSERT INTO casino_balances (discordId) VALUES (?)',
              [userId],
              (err) => {
                if (err) reject(err);
                else {
                  this.db.get(
                    'SELECT * FROM casino_balances WHERE discordId = ?',
                    [userId],
                    (err, row) => {
                      if (err) reject(err);
                      else resolve(row);
                    }
                  );
                }
              }
            );
          }
        }
      );
    });
  }

  async dailyReward(userId) {
    return new Promise((resolve, reject) => {
      const db = this.db; // Store reference to avoid context issues
      db.get(
        'SELECT lastDaily FROM casino_balances WHERE discordId = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          const now = new Date();
          const lastDaily = row?.lastDaily ? new Date(row.lastDaily) : null;
          const canClaim = !lastDaily || (now - lastDaily) >= 24 * 60 * 60 * 1000;

          if (!canClaim) {
            const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - lastDaily)) / (60 * 60 * 1000));
            resolve({ success: false, hoursLeft });
            return;
          }

          const reward = 500 + Math.floor(Math.random() * 500); // 500-1000 coins

          db.run(
            `UPDATE casino_balances 
             SET balance = balance + ?,
                 lastDaily = CURRENT_TIMESTAMP,
                 updatedAt = CURRENT_TIMESTAMP
             WHERE discordId = ?`,
            [reward, userId],
            function(err) {
              if (err) {
                reject(err);
              } else {
                if (this.changes === 0) {
                  // Create user
                  db.run(
                    'INSERT INTO casino_balances (discordId, balance, lastDaily) VALUES (?, ?, CURRENT_TIMESTAMP)',
                    [userId, 1000 + reward],
                    (err) => {
                      if (err) reject(err);
                      else resolve({ success: true, reward, balance: 1000 + reward });
                    }
                  );
                } else {
                  db.get(
                    'SELECT balance FROM casino_balances WHERE discordId = ?',
                    [userId],
                    (err, row) => {
                      if (err) reject(err);
                      else resolve({ success: true, reward, balance: row.balance });
                    }
                  );
                }
              }
            }
          );
        }
      );
    });
  }

  // Security: Validate bet amount
  validateBet(bet, balance, minBet = 10, maxBet = 10000) {
    if (isNaN(bet) || bet <= 0) {
      return { valid: false, error: 'Bet must be a positive number, you absolute moron.' };
    }
    if (bet < minBet) {
      return { valid: false, error: `Minimum bet is ${minBet} coins. Don't be cheap.` };
    }
    if (bet > maxBet) {
      return { valid: false, error: `Maximum bet is ${maxBet} coins. Calm the fuck down.` };
    }
    if (bet > balance) {
      return { valid: false, error: 'You don\'t have enough coins, you broke ass.' };
    }
    return { valid: true };
  }

  // Coinflip game
  async coinflip(userId, bet, choice) {
    const balance = await this.getBalance(userId);
    const validation = this.validateBet(bet, balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice.toLowerCase() === result;

    if (won) {
      const newBalance = await this.updateBalance(userId, bet, true);
      return {
        success: true,
        won: true,
        result,
        winnings: bet,
        balance: newBalance
      };
    } else {
      const newBalance = await this.updateBalance(userId, -bet, false);
      return {
        success: true,
        won: false,
        result,
        loss: bet,
        balance: newBalance
      };
    }
  }

  // Dice game (1-6)
  async dice(userId, bet, guess) {
    const balance = await this.getBalance(userId);
    const validation = this.validateBet(bet, balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const won = parseInt(guess) === diceRoll;

    if (won) {
      const winnings = bet * 5; // 5x multiplier
      const newBalance = await this.updateBalance(userId, winnings, true);
      return {
        success: true,
        won: true,
        diceRoll,
        winnings,
        balance: newBalance
      };
    } else {
      const newBalance = await this.updateBalance(userId, -bet, false);
      return {
        success: true,
        won: false,
        diceRoll,
        loss: bet,
        balance: newBalance
      };
    }
  }

  // Double or nothing
  async double(userId, bet) {
    const balance = await this.getBalance(userId);
    const validation = this.validateBet(bet, balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const won = Math.random() < 0.5;

    if (won) {
      const winnings = bet; // Double your bet
      const newBalance = await this.updateBalance(userId, winnings, true);
      return {
        success: true,
        won: true,
        winnings,
        balance: newBalance
      };
    } else {
      const newBalance = await this.updateBalance(userId, -bet, false);
      return {
        success: true,
        won: false,
        loss: bet,
        balance: newBalance
      };
    }
  }

  // Roulette (simplified)
  async roulette(userId, bet, choice) {
    const balance = await this.getBalance(userId);
    const validation = this.validateBet(bet, balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const number = Math.floor(Math.random() * 37); // 0-36
    const color = number === 0 ? 'green' : (number % 2 === 0 ? 'black' : 'red');
    
    let won = false;
    let multiplier = 1;

    if (choice.toLowerCase() === 'red' && color === 'red') {
      won = true;
      multiplier = 2;
    } else if (choice.toLowerCase() === 'black' && color === 'black') {
      won = true;
      multiplier = 2;
    } else if (choice.toLowerCase() === 'green' && color === 'green') {
      won = true;
      multiplier = 35;
    } else if (!isNaN(choice) && parseInt(choice) === number) {
      won = true;
      multiplier = 35;
    }

    if (won) {
      const winnings = Math.floor(bet * multiplier);
      const newBalance = await this.updateBalance(userId, winnings, true);
      return {
        success: true,
        won: true,
        number,
        color,
        winnings,
        balance: newBalance
      };
    } else {
      const newBalance = await this.updateBalance(userId, -bet, false);
      return {
        success: true,
        won: false,
        number,
        color,
        loss: bet,
        balance: newBalance
      };
    }
  }

  // Blackjack (simplified)
  async blackjack(userId, bet) {
    const balance = await this.getBalance(userId);
    const validation = this.validateBet(bet, balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if user already has an active game
    if (this.activeGames.has(`${userId}_blackjack`)) {
      return { success: false, error: 'You already have an active blackjack game. Finish it first, dumbass.' };
    }

    const game = {
      userId,
      bet,
      playerCards: [this.drawCard(), this.drawCard()],
      dealerCards: [this.drawCard()],
      status: 'playing'
    };

    this.activeGames.set(`${userId}_blackjack`, game);

    return {
      success: true,
      game: {
        playerCards: game.playerCards,
        dealerCard: game.dealerCards[0],
        playerTotal: this.calculateTotal(game.playerCards),
        status: 'playing'
      }
    };
  }

  async blackjackHit(userId) {
    const gameKey = `${userId}_blackjack`;
    const game = this.activeGames.get(gameKey);

    if (!game) {
      return { success: false, error: 'No active blackjack game found. Start one first, you moron.' };
    }

    game.playerCards.push(this.drawCard());
    const total = this.calculateTotal(game.playerCards);

    if (total > 21) {
      // Bust
      this.activeGames.delete(gameKey);
      const newBalance = await this.updateBalance(userId, -game.bet, false);
      return {
        success: true,
        bust: true,
        playerCards: game.playerCards,
        playerTotal: total,
        balance: newBalance
      };
    }

    return {
      success: true,
      playerCards: game.playerCards,
      playerTotal: total,
      status: 'playing'
    };
  }

  async blackjackStand(userId) {
    const gameKey = `${userId}_blackjack`;
    const game = this.activeGames.get(gameKey);

    if (!game) {
      return { success: false, error: 'No active blackjack game found.' };
    }

    // Dealer draws until 17+
    while (this.calculateTotal(game.dealerCards) < 17) {
      game.dealerCards.push(this.drawCard());
    }

    const playerTotal = this.calculateTotal(game.playerCards);
    const dealerTotal = this.calculateTotal(game.dealerCards);

    this.activeGames.delete(gameKey);

    let won = false;
    if (dealerTotal > 21 || (playerTotal <= 21 && playerTotal > dealerTotal)) {
      won = true;
    } else if (playerTotal === dealerTotal) {
      // Push - return bet
      const newBalance = await this.getBalance(userId);
      return {
        success: true,
        push: true,
        playerCards: game.playerCards,
        dealerCards: game.dealerCards,
        playerTotal,
        dealerTotal,
        balance: newBalance
      };
    }

    if (won) {
      const winnings = Math.floor(game.bet * 2);
      const newBalance = await this.updateBalance(userId, winnings, true);
      return {
        success: true,
        won: true,
        playerCards: game.playerCards,
        dealerCards: game.dealerCards,
        playerTotal,
        dealerTotal,
        winnings,
        balance: newBalance
      };
    } else {
      const newBalance = await this.updateBalance(userId, -game.bet, false);
      return {
        success: true,
        won: false,
        playerCards: game.playerCards,
        dealerCards: game.dealerCards,
        playerTotal,
        dealerTotal,
        loss: game.bet,
        balance: newBalance
      };
    }
  }

  drawCard() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    return { suit, value, display: `${value}${suit}` };
  }

  calculateTotal(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.value === 'A') {
        aces++;
        total += 11;
      } else if (['J', 'Q', 'K'].includes(card.value)) {
        total += 10;
      } else {
        total += parseInt(card.value);
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }
}

module.exports = CasinoManager;

