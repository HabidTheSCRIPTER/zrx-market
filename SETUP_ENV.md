# Environment Variables Setup Guide

## Quick Setup

1. **Create a `.env` file** in the root directory (same level as `package.json`)

2. **Copy the template below** and fill in your Discord credentials:

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id_here
MIDDLEMAN_CHANNEL_ID=your_middleman_channel_id_here
MIDDLEMAN_ROLE_ID=1392690302921343107
MODERATOR_ROLE_ID=1391972977586864218

# Server
SESSION_SECRET=generate_a_random_secret_here_at_least_32_characters_long
BASE_URL=http://localhost:3000
PORT=3000
```

## How to Get Discord Credentials

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Give it a name (e.g., "ZRX Market")
4. Click **"Create"**

### Step 2: Get OAuth2 Credentials

1. In your application, go to **"OAuth2"** in the left sidebar
2. Under **"Redirects"**, click **"Add Redirect"**
3. Add: `http://localhost:3000/auth/discord/callback`
4. Copy your **Client ID** → This is `DISCORD_CLIENT_ID`
5. Click **"Reset Secret"** and copy the secret → This is `DISCORD_CLIENT_SECRET`

### Step 3: Create Bot

1. Go to **"Bot"** in the left sidebar
2. Click **"Add Bot"** → **"Yes, do it!"**
3. Under **"Privileged Gateway Intents"**, enable:
   - ✅ **Message Content Intent** (required!)
4. Click **"Reset Token"** and copy it → This is `DISCORD_BOT_TOKEN`
5. **Save Changes**

### Step 4: Get Server (Guild) ID

1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode
2. Right-click your Discord server → **"Copy Server ID"** → This is `GUILD_ID`

### Step 5: Get Channel and Role IDs

1. **Channel ID**: Right-click the channel where middleman requests should be posted → **"Copy Channel ID"** → This is `MIDDLEMAN_CHANNEL_ID`
2. **Role IDs**: Right-click the role → **"Copy Role ID"**
   - Moderator role → `MODERATOR_ROLE_ID`
   - Middleman role → `MIDDLEMAN_ROLE_ID`

### Step 6: Invite Bot to Server

1. Go to **"OAuth2"** → **"URL Generator"**
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

## Generate Session Secret

You can generate a random session secret using:

**PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Online:** Use a password generator to create a 32+ character random string

## Testing Without Discord (Development Only)

If you want to test the app without Discord OAuth first, you can:

1. Leave the Discord credentials empty (the app will warn but still run)
2. Use the demo users from the seed script
3. Note: Authentication won't work, but you can test other features

However, for full functionality, you'll need to set up Discord OAuth.

## Verify Your Setup

After creating your `.env` file:

1. Restart the backend server
2. Check the console - you should NOT see the warning about missing credentials
3. Try logging in at `http://localhost:5173`

## Common Issues

### "Invalid redirect URI"
- Make sure the redirect URI in `.env` matches exactly what's in Discord Developer Portal
- Must be: `http://localhost:3000/auth/discord/callback` (for development)

### "Missing Access"
- Make sure you enabled "Message Content Intent" for the bot
- Make sure the bot is invited to your server

### "Unknown authentication strategy"
- This should be fixed now, but if you see it, restart the server after creating `.env`

## Security Notes

- ⚠️ **Never commit `.env` to git** (it's already in `.gitignore`)
- ⚠️ **Never share your tokens or secrets**
- ⚠️ **Use different credentials for production**





