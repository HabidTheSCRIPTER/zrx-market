# 🚨 Railway Deployment Fix Guide

Your deployment failed. Here's how to fix it:

## Step 1: Check the Logs

1. In Railway dashboard, click on the "zrx-market" service
2. Click "Logs" tab at the top
3. Look for the error message - it will tell you what went wrong

Common errors you might see:
- `Error: Cannot find module...` → Missing dependencies
- `Port already in use` → Port configuration issue
- `Database error` → Missing database setup
- `ENOENT` → File not found

## Step 2: Fix Service Configuration

Click on your "zrx-market" service → **Settings** tab:

### Required Settings:

1. **Root Directory**: `backend`
   - This tells Railway where your backend code is

2. **Start Command**: `node server.js`
   - This is what Railway runs to start your app

3. **Watch Paths**: Leave empty or set to `backend/**`

4. **Healthcheck Path**: `/health` (optional but recommended)

### Port Configuration:
Railway automatically assigns a `PORT` environment variable. Make sure your `server.js` uses:
```javascript
const PORT = process.env.PORT || 3000;
```

✅ Your code already does this - so this should be fine!

## Step 3: Add Environment Variables

Go to **Variables** tab in your Railway service:

### Required Variables:

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=generate_a_random_32_char_secret_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://your-railway-url.railway.app/auth/discord/callback
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_guild_id
MIDDLEMAN_CHANNEL_ID=your_channel_id
MIDDLEMAN_ROLE_ID=your_role_id
MODERATOR_ROLE_ID=your_moderator_role_id
CASINO_CHANNEL_ID=your_casino_channel_id
BASE_URL=https://your-railway-url.railway.app
```

**Important Notes:**
- `DISCORD_REDIRECT_URI` should use your Railway URL (you'll get this after first successful deploy)
- Generate `SESSION_SECRET` with: `openssl rand -base64 32` or use a random string generator
- `BASE_URL` should match your Railway URL

## Step 4: Fix Common Issues

### Issue 1: Missing Dependencies
If you see "Cannot find module" errors:

1. Make sure `backend/package.json` has all dependencies
2. Railway auto-installs, but if it fails, check that `package.json` is valid

### Issue 2: Wrong Root Directory
- **Must be set to**: `backend`
- Not: `.` or `./backend` or empty

### Issue 3: Database Path Issues
Your database creates files in `data/` folder. Railway needs write permissions.

Add to **Variables**:
```
DATA_DIR=/app/data
```

Or update `backend/db/config.js` to use Railway's filesystem properly.

### Issue 4: Build Issues
If Railway tries to build but fails:

1. Go to Settings → **Build Command**
2. Set to: `npm install`
3. Or leave empty (Railway auto-detects)

## Step 5: Redeploy

After fixing settings:

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger auto-deploy

## Step 6: Check Deployment Logs

While deploying, watch the logs:
1. Click **Logs** tab
2. Watch for errors
3. Look for "Application started" or similar success message

---

## Quick Checklist:

- [ ] Root Directory = `backend`
- [ ] Start Command = `node server.js`
- [ ] All environment variables added
- [ ] SESSION_SECRET is set (32+ characters)
- [ ] DISCORD_REDIRECT_URI matches Railway URL
- [ ] NODE_ENV = production
- [ ] Checked logs for specific error

---

## Most Likely Issues:

1. **Wrong Root Directory** - Must be `backend`, not root
2. **Missing Environment Variables** - Especially SESSION_SECRET, DISCORD_BOT_TOKEN
3. **Database Permissions** - Railway might need explicit data directory
4. **Port Configuration** - Railway uses dynamic PORT, your code should handle this

---

## Need More Help?

1. Copy the exact error from Railway logs
2. Share it and I'll help you fix the specific issue!

