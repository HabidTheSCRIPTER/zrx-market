# Quick Start Guide

## One-Command Setup

After setting up your `.env` file, run:

**Windows PowerShell:**
```powershell
npm run setup; npm run dev
```

**Windows CMD / Linux / Mac:**
```bash
npm run setup && npm run dev
```

Or use the combined setup script:
```bash
npm run setup
npm run dev
```

This will:
1. Install all dependencies
2. Seed the database with demo data
3. Start backend, bot, and frontend simultaneously

## Manual Setup

### 1. Install Dependencies
```bash
npm install
cd backend && npm install
cd ../bot && npm install
cd ../frontend && npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your Discord credentials.

### 3. Seed Database
```bash
npm run seed
```

### 4. Start Services

**Option A: All at once (recommended)**
```bash
npm run dev
```

**Option B: Individually**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Bot
cd bot && npm run dev

# Terminal 3 - Frontend
cd frontend && npm run dev
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## First Login

1. Go to http://localhost:5173
2. Click "Login with Discord"
3. Authorize the application
4. You'll be redirected back to the dashboard

**Note**: You must be a member of the Discord server specified in `GUILD_ID` to log in.

## Demo Users (from seed)

- **DemoUser#1234** (Verified, Moderator): `123456789012345678`
- **TestTrader#5678** (Verified): `987654321098765432`
- **RegularUser#9999** (Not Verified): `111111111111111111`

These are demo users for testing. In production, users are created via Discord OAuth.

## Troubleshooting

### Bot not starting
- Check `DISCORD_BOT_TOKEN` in `.env`
- Ensure bot has "Message Content Intent" enabled
- Verify bot is invited to your server

### OAuth not working
- Verify redirect URI matches exactly: `http://localhost:3000/auth/discord/callback`
- Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
- Ensure you're a member of the guild

### Database errors
- Ensure `data/` directory is writable
- Delete `data/zrx-market.db` and run `npm run seed` again

