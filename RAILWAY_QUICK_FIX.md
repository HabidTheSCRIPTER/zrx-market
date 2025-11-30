# ⚡ Railway Quick Fix - Deployment Failed

## Step 1: Check the Error Logs ⚠️

**IMPORTANT: First, check what the actual error is!**

1. In Railway, click on the **"zrx-market"** service card
2. Click the **"Logs"** tab at the top
3. Scroll down to see the error message
4. **Copy the error** - this will tell us exactly what's wrong

Common errors:
- `Cannot find module` → Missing dependency
- `Port already in use` → Port config issue  
- `ENOENT: no such file or directory` → File path issue
- `Database error` → Database path/permissions issue

---

## Step 2: Fix Service Settings 🔧

Click on **"zrx-market"** → **Settings** tab:

### ✅ Correct Settings:

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Start Command** | `node server.js` |
| **Watch Paths** | (leave empty) |
| **Healthcheck Path** | `/health` (optional) |

**Most Common Issue:** Root Directory is wrong!
- ❌ Wrong: Empty or `.` or `./backend`
- ✅ Correct: `backend` (exactly like this, no slash)

---

## Step 3: Add Environment Variables 🔑

Go to **Variables** tab and add these:

### Required Variables (copy-paste ready):

```env
NODE_ENV=production
SESSION_SECRET=replace_with_random_32_char_string
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_guild_id
MIDDLEMAN_CHANNEL_ID=your_channel_id
MIDDLEMAN_ROLE_ID=your_role_id
MODERATOR_ROLE_ID=your_moderator_role_id
CASINO_CHANNEL_ID=your_casino_channel_id
```

### Important Notes:

1. **Generate SESSION_SECRET:**
   - Go to: https://generate-secret.vercel.app/32
   - Or use: `openssl rand -base64 32` in terminal
   - Must be at least 32 characters

2. **DISCORD_REDIRECT_URI:**
   - After Railway deploys, you'll get a URL like: `https://zrx-market-production.up.railway.app`
   - Set it to: `https://your-railway-url.railway.app/auth/discord/callback`
   - Add this URL in Discord Developer Portal → OAuth2 → Redirects

3. **BASE_URL:**
   - Same as your Railway URL: `https://your-railway-url.railway.app`

---

## Step 4: Fix Database Path (If Needed) 💾

The database might need a fix for Railway. Update this if you see database errors:

**File:** `backend/db/config.js`

Change line 6 from:
```javascript
const DB_PATH = path.join(__dirname, '../../data/zrx-market.db');
```

To:
```javascript
// Use Railway's persistent storage or local data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'zrx-market.db');
const DB_DIR = DATA_DIR;
```

**Or** use Railway's volume for persistent storage (recommended for production).

---

## Step 5: Redeploy 🚀

After fixing settings:

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Or commit a small change and push to GitHub to trigger auto-deploy

Watch the logs during deployment!

---

## Quick Checklist ✅

Before redeploying, verify:

- [ ] Root Directory = `backend` (not `.` or empty)
- [ ] Start Command = `node server.js`
- [ ] Added SESSION_SECRET (32+ chars)
- [ ] Added all Discord variables
- [ ] Checked logs for specific error
- [ ] Committed and pushed changes (if you edited files)

---

## Still Failing? 🔍

**Share the exact error from logs** and I'll help you fix it!

Common fixes:
- If "module not found" → Check `package.json` has all dependencies
- If "port error" → Railway handles PORT automatically (your code already does this)
- If "database error" → Check database path and permissions
- If "file not found" → Check Root Directory is `backend`

---

## Need the Logs? 📋

To get logs:
1. Click service → **Logs** tab
2. Copy the red error text
3. Share it with me and I'll help debug!

