# 🎰 Casino System Integration

This casino system has been integrated from [Elisif Casino](https://github.com/Elvenide/elisif-casino) and upgraded to work with discord.js v14.

## 🎮 Available Games

### 1. **Coinflip** (`!coinflip <bet> <heads/tails>`)
- Simple 50/50 chance game
- Win: Get your bet back (1x)
- Example: `!coinflip 100 heads`

### 2. **Dice** (`!dice <bet> <1-6>`)
- Guess the dice roll (1-6)
- Win: 5x multiplier
- Example: `!dice 100 3`

### 3. **Double or Nothing** (`!double <bet>`)
- 50/50 chance to double your bet
- Win: Double your bet (2x)
- Example: `!double 100`

### 4. **Roulette** (`!roulette <bet> <red/black/green/number>`)
- Bet on color or number (0-36)
- Red/Black: 2x multiplier
- Green (0): 35x multiplier
- Specific number: 35x multiplier
- Example: `!roulette 100 red` or `!roulette 100 7`

### 5. **Blackjack** (`!blackjack <bet>`)
- Full blackjack game
- Use `!hit` to draw cards
- Use `!stand` to end your turn
- Win: 2x your bet
- Example: `!blackjack 100` then `!hit` or `!stand`

## 💰 Economy Commands

- `!balance` - Check your coin balance
- `!daily` - Claim daily reward (500-1000 coins, once per 24 hours)
- `!casinostats [user]` - View casino statistics

## 🔒 Security Features

1. **Bet Validation**
   - Minimum bet: 10 coins
   - Maximum bet: 10,000 coins
   - Prevents negative bets
   - Checks user balance before betting

2. **Database Protection**
   - All transactions are logged
   - Prevents SQL injection
   - Atomic operations for balance updates

3. **Rate Limiting**
   - One active blackjack game per user
   - Daily reward cooldown (24 hours)

4. **Admin Controls**
   - `!casinoadd <user> <amount>` - Add coins (moderator only)
   - `!casinoremove <user> <amount>` - Remove coins (moderator only)
   - `!casinoreset <user>` - Reset user stats (moderator only)
   - All admin actions are logged

## 📊 Database Schema

```sql
CREATE TABLE casino_balances (
  discordId TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 1000,
  totalWon INTEGER DEFAULT 0,
  totalLost INTEGER DEFAULT 0,
  gamesPlayed INTEGER DEFAULT 0,
  lastDaily TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## 🎯 Starting Balance

- New users start with **1,000 coins**
- Daily reward: **500-1,000 coins** (random)

## ⚠️ Important Notes

- All games use fair random number generation
- No rigging or manipulation
- All bets are validated before processing
- Users cannot bet more than they have
- Admin commands require moderator role

## 🛡️ Safety Measures

1. **Input Validation**: All user inputs are validated
2. **Balance Checks**: Prevents negative balances
3. **Transaction Logging**: All admin actions are logged
4. **Error Handling**: Graceful error handling with user-friendly messages
5. **SQL Injection Protection**: Parameterized queries only

## 📝 Example Usage

```
User: !balance
Bot: You have 1,000 coins.

User: !daily
Bot: You received 750 coins! New balance: 1,750 coins.

User: !coinflip 100 heads
Bot: The coin landed on heads! You won 100 coins!

User: !blackjack 200
Bot: Blackjack game started. Your cards: A♠, 7♥ (Total: 18)

User: !stand
Bot: You won! Dealer had 16. You won 400 coins!
```

## 🔧 Integration Details

- Integrated into existing bot structure
- Uses same database (SQLite)
- Maintains snarky personality
- All commands are public (except admin commands)
- No additional dependencies required




