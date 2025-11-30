# How to Get Your Website Online

## Quick Options

### Option 1: ngrok (Fastest - For Testing)
**Best for:** Quick testing, sharing with friends, temporary access

1. **Install ngrok:**
   - Download from: https://ngrok.com/download
   - Or use: `choco install ngrok` (Windows) or `brew install ngrok` (Mac)

2. **Start your services:**
   ```bash
   npm run dev
   ```

3. **In a NEW terminal, expose backend:**
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. **In ANOTHER terminal, expose frontend:**
   ```bash
   ngrok http 5173
   ```
   Copy the HTTPS URL (e.g., `https://xyz789.ngrok.io`)

5. **Update your `.env` file:**
   ```env
   BASE_URL=https://abc123.ngrok.io
   DISCORD_REDIRECT_URI=https://abc123.ngrok.io/auth/discord/callback
   ```

6. **Update Discord OAuth Redirect URI:**
   - Go to Discord Developer Portal
   - OAuth2 → Redirects
   - Add: `https://abc123.ngrok.io/auth/discord/callback`

7. **Restart your services** and access via the frontend ngrok URL!

---

### Option 2: Railway (Recommended - Free Tier Available)
**Best for:** Permanent hosting, easy deployment

1. **Sign up:** https://railway.app
2. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

3. **Deploy Backend:**
   ```bash
   cd backend
   railway init
   railway up
   ```
   - Add environment variables in Railway dashboard
   - Railway will give you a URL like `https://your-app.railway.app`

4. **Deploy Frontend:**
   - Use Vercel (https://vercel.com) for frontend
   - Connect your GitHub repo
   - Set build command: `npm run build`
   - Set output directory: `frontend/dist`
   - Add environment variable: `VITE_API_URL=https://your-app.railway.app`

5. **Update Discord OAuth** with Railway URL

---

### Option 3: Render (Free Tier Available)
**Best for:** Simple deployment, free hosting

1. **Sign up:** https://render.com
2. **Create Web Service:**
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables

3. **Create Static Site for Frontend:**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Publish Directory: `dist`

---

### Option 4: VPS (DigitalOcean, AWS, etc.)
**Best for:** Full control, production use

1. **Get a VPS** (Ubuntu recommended)
2. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone your repo:**
   ```bash
   git clone your-repo-url
   cd zrx-market
   ```

4. **Install dependencies:**
   ```bash
   npm run install:all
   ```

5. **Set up PM2 (process manager):**
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name backend
   pm2 start bot/index.js --name bot
   ```

6. **Set up Nginx:**
   ```bash
   sudo apt install nginx
   # Configure nginx to proxy to your backend
   ```

7. **Set up SSL (Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Environment Variables for Production

Update your `.env` file with production values:

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_guild_id
MIDDLEMAN_CHANNEL_ID=your_channel_id
MIDDLEMAN_ROLE_ID=your_role_id
MODERATOR_ROLE_ID=your_moderator_role_id
CASINO_CHANNEL_ID=1406780875911336007

# Server
SESSION_SECRET=generate_a_very_long_random_secret_here_minimum_32_characters
BASE_URL=https://yourdomain.com
PORT=3000
NODE_ENV=production

# Optional
DISCORD_WEBHOOK_SECRET=your_webhook_secret
REPORTS_CHANNEL_ID=your_reports_channel_id
```

## Important Notes

1. **Discord OAuth Redirect URI** must match exactly in Discord Developer Portal
2. **HTTPS is required** for OAuth to work (ngrok provides this automatically)
3. **CORS** is configured to allow your frontend domain
4. **Bot** needs to stay running (use PM2 or similar for VPS)
5. **Database** (SQLite) will be created automatically in `data/` folder

## Quick Test Checklist

- [ ] Backend is running and accessible
- [ ] Frontend is running and accessible
- [ ] Discord OAuth redirect URI is updated
- [ ] Bot is connected to Discord
- [ ] Environment variables are set correctly
- [ ] Can log in with Discord
- [ ] Can create trades
- [ ] Bot responds to commands

## Need Help?

- Check terminal logs for errors
- Verify all environment variables are set
- Ensure Discord bot has correct permissions
- Make sure OAuth redirect URI matches exactly




