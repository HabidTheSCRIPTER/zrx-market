# ZRX Market - Discord Trading & Middleman Website

A full-stack web application for Discord-based trading and middleman services, featuring Discord OAuth2 authentication, trade posting, middleman request management, scammer reporting, and comprehensive admin moderation tools.

## Features

- 🔐 **Discord OAuth2 Authentication** - Secure login with guild membership verification
- 🛒 **Trading Hub** - Post and browse trades with search and pagination
- 🤝 **Middleman System** - Request trusted middlemen for secure transactions
- 🚨 **Scammer Reporting** - Report suspicious users with evidence
- 👮 **Admin Panel** - Full moderation tools with activity logging
- 💬 **Messaging System** - In-site messaging for trade inquiries
- 🤖 **Discord Bot** - Automated middleman request posting and command management

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (development) / MongoDB/PostgreSQL (production)
- **Authentication**: Passport.js with Discord OAuth2
- **Bot**: discord.js v14
- **Session Store**: SQLite (development) / MongoDB/Redis (production)

## Prerequisites

- Node.js 18+ and npm
- Discord Application (for OAuth2)
- Discord Bot (for middleman features)
- Discord Server (Guild) with configured roles

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install all sub-project dependencies
npm run install:all
```

### 2. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. In OAuth2 section:
   - Add redirect URI: `http://localhost:3000/auth/discord/callback` (for dev)
   - Copy Client ID and Client Secret
4. In Bot section:
   - Create a bot and copy the token
   - Enable "Message Content Intent" in Privileged Gateway Intents
   - Invite bot to your server with `bot` and `applications.commands` scopes

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_guild_id
MIDDLEMAN_CHANNEL_ID=your_middleman_channel_id
MIDDLEMAN_ROLE_ID=1392690302921343107
MODERATOR_ROLE_ID=1391972977586864218

# Server
SESSION_SECRET=your_random_session_secret_here_min_32_chars
BASE_URL=http://localhost:3000
PORT=3000

# Database (optional - defaults to SQLite)
# MONGO_URI=mongodb://localhost:27017/zrx-market
# POSTGRES_URI=postgresql://user:password@localhost:5432/zrx-market
```

### 4. Database Setup

The database will be automatically created on first run. To seed with demo data:

```bash
npm run seed
```

### 5. Run the Application

**Development (all services):**
```bash
npm run dev
```

This runs:
- Backend API on `http://localhost:3000`
- Frontend on `http://localhost:5173`
- Discord Bot (connects automatically)

**Individual services:**
```bash
# Backend only
npm run dev:backend

# Bot only
npm run dev:bot

# Frontend only
npm run dev:frontend
```

## Project Structure

```
zrx-market/
├── backend/           # Express API server
│   ├── config/        # Passport configuration
│   ├── db/            # Database setup and helpers
│   ├── middleware/    # Auth, validation, rate limiting
│   ├── routes/        # API route handlers
│   ├── scripts/       # Seed and utility scripts
│   └── server.js      # Main server file
├── bot/               # Discord bot
│   └── index.js       # Bot implementation
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── context/     # React context (Auth)
│   │   ├── pages/       # Page components
│   │   └── App.jsx       # Main app component
│   └── vite.config.js    # Vite configuration
├── data/              # SQLite database files (created automatically)
└── README.md
```

## API Endpoints

### Authentication
- `GET /auth/discord` - Initiate Discord OAuth2 login
- `GET /auth/discord/callback` - OAuth2 callback
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Trades
- `GET /api/trades` - List trades (with pagination and search)
- `GET /api/trades/:id` - Get single trade
- `POST /api/trades` - Create trade (auth required)
- `PUT /api/trades/:id` - Update trade (moderator only)
- `DELETE /api/trades/:id` - Delete trade (moderator only)

### Middleman
- `GET /api/middleman/pending` - Get pending requests (moderator only)
- `GET /api/middleman/all` - Get all requests (moderator only)
- `GET /api/middleman/:id` - Get single request
- `POST /api/middleman` - Create request (verified users only)
- `PATCH /api/middleman/:id/status` - Update request status (moderator only)

### Reports
- `GET /api/reports` - Get all reports (moderator only)
- `POST /api/reports` - Create report (auth required)
- `PATCH /api/reports/:id/status` - Update report status (moderator only)

### Admin
- `POST /api/admin/verify-user` - Verify/unverify user (moderator only)
- `POST /api/admin/blacklist` - Blacklist user (moderator only)
- `DELETE /api/admin/blacklist/:discordId` - Remove from blacklist (moderator only)
- `GET /api/admin/logs` - Get admin activity logs (moderator only)
- `GET /api/admin/blacklist` - Get blacklist (moderator only)

### Messages
- `GET /api/messages` - Get messages (auth required)
- `POST /api/messages` - Send message (auth required)
- `DELETE /api/messages/:id` - Delete message (sender or moderator)

## Discord Bot Commands

All commands require moderator role:

- `!mm accept <id>` - Accept a middleman request
- `!mm decline <id>` - Decline a middleman request
- `!mm complete <id>` - Mark request as completed
- `!mm list pending` - List pending requests
- `!mm ticket <id>` - Create ticket channel (placeholder)

## Database Schema

### Users
- `discordId` (PRIMARY KEY)
- `username`
- `avatar`
- `verified` (boolean)
- `robloxUsername`
- `roles` (JSON array)
- `createdAt`

### Trades
- `id` (PRIMARY KEY)
- `creatorId` (FOREIGN KEY → users.discordId)
- `offered`
- `wanted`
- `value`
- `notes`
- `robloxUsername`
- `status`
- `createdAt`

### Middleman
- `id` (PRIMARY KEY)
- `requesterId` (FOREIGN KEY → users.discordId)
- `user1`, `user2`
- `item`
- `value`
- `proofLinks` (JSON array)
- `robloxUsername`
- `status` (pending/accepted/declined/completed)
- `middlemanId`
- `createdAt`

### Reports
- `id` (PRIMARY KEY)
- `reporterId` (FOREIGN KEY → users.discordId)
- `accusedDiscordId`
- `details`
- `evidenceLinks` (JSON array)
- `status`
- `createdAt`

### Blacklist
- `discordId` (PRIMARY KEY)
- `reason`
- `createdAt`

### Messages
- `id` (PRIMARY KEY)
- `tradeId` (FOREIGN KEY → trades.id, optional)
- `senderId`, `recipientId` (FOREIGN KEY → users.discordId)
- `content`
- `createdAt`

### Admin Logs
- `id` (PRIMARY KEY)
- `actorId` (FOREIGN KEY → users.discordId)
- `action`
- `targetId`
- `details`
- `createdAt`

## Production Deployment

### Database Migration

To switch from SQLite to MongoDB or PostgreSQL:

1. **MongoDB**: Install `mongoose` and update `backend/db/config.js` to use Mongoose schemas
2. **PostgreSQL**: Install `pg` and update `backend/db/config.js` to use PostgreSQL connection

### Session Store

For production, use:
- **MongoDB**: `connect-mongo` package
- **Redis**: `connect-redis` package

Update `backend/server.js` session configuration accordingly.

### Environment Variables

Set production values:
- `BASE_URL` - Your production domain
- `DISCORD_REDIRECT_URI` - Production callback URL
- `SESSION_SECRET` - Strong random secret (32+ characters)
- `NODE_ENV=production`

### Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure cookie flags
- [ ] Enable CORS restrictions
- [ ] Configure rate limiting
- [ ] Set up file upload restrictions
- [ ] Use environment variables for all secrets
- [ ] Enable helmet security headers
- [ ] Set up database backups

## Development

### Running Tests

```bash
# Add test scripts as needed
npm test
```

### Linting

```bash
# Add linting as needed
npm run lint
```

## Troubleshooting

### Bot not connecting
- Verify `DISCORD_BOT_TOKEN` is correct
- Ensure bot has "Message Content Intent" enabled
- Check bot is invited to the server

### OAuth not working
- Verify redirect URI matches exactly in Discord Developer Portal
- Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
- Ensure user is a member of the guild

### Database errors
- Ensure `data/` directory is writable
- Check SQLite file permissions
- Verify database schema is initialized

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
