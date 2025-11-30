# ✅ Server is Running! Now Add Environment Variables

## 🎉 Success!

Your server is running on Railway! The warnings are just because environment variables aren't set yet.

---

## 📝 Step 1: Add Environment Variables in Railway

1. **Go to Railway Dashboard**
   - Click your project
   - Click your service: **"zrx-market"**

2. **Go to Variables Tab**
   - Click **"Variables"** tab at the top
   - Click **"+ New Variable"** button

3. **Add Each Variable One by One**

Add these variables (click "+ New Variable" for each):

### Required Variables:

```env
NODE_ENV=production
```

```env
SESSION_SECRET=GENERATE_A_RANDOM_32_CHAR_SECRET_HERE
```
**Generate SESSION_SECRET:**
- Go to: https://generate-secret.vercel.app/32
- Or use: `openssl rand -base64 32` in terminal
- Copy the result and paste it

```env
DISCORD_CLIENT_ID=your_discord_client_id
```
Get from: Discord Developer Portal → Your Application → OAuth2 → Client ID

```env
DISCORD_CLIENT_SECRET=your_discord_client_secret
```
Get from: Discord Developer Portal → Your Application → OAuth2 → Reset Secret (copy it)

```env
DISCORD_REDIRECT_URI=https://your-railway-url.railway.app/auth/discord/callback
```
Replace `your-railway-url` with your actual Railway URL (check Railway dashboard for your service URL)

```env
DISCORD_BOT_TOKEN=your_bot_token
```
Get from: Discord Developer Portal → Your Application → Bot → Reset Token (copy it)

```env
GUILD_ID=your_guild_id
```
Your Discord server ID (right-click server → Copy Server ID with Developer Mode enabled)

```env
MIDDLEMAN_CHANNEL_ID=your_channel_id
```
Right-click your middleman channel → Copy Channel ID

```env
MIDDLEMAN_ROLE_ID=your_role_id
```
Right-click your middleman role → Copy Role ID

```env
MODERATOR_ROLE_ID=your_moderator_role_id
```
Right-click your moderator role → Copy Role ID

```env
CASINO_CHANNEL_ID=your_casino_channel_id
```
Right-click your casino channel → Copy Channel ID

```env
BASE_URL=https://your-railway-url.railway.app
```
Your Railway service URL (check Railway dashboard)

---

## 🔍 Step 2: Find Your Railway URL

1. In Railway dashboard → Your service
2. Go to **"Settings"** tab
3. Look for **"Custom Domain"** or check the **"Deployments"** tab
4. Your URL will be like: `https://zrx-market-production-xxxx.up.railway.app`
5. Use this URL for `BASE_URL` and `DISCORD_REDIRECT_URI`

---

## 🔐 Step 3: Update Discord OAuth Redirect URI

1. Go to: https://discord.com/developers/applications
2. Select your application
3. Go to **OAuth2** → **Redirects**
4. Click **"Add Redirect"**
5. Add: `https://your-railway-url.railway.app/auth/discord/callback`
6. Click **"Save Changes"**

---

## ✅ Step 4: Verify

After adding all variables:

1. Railway will automatically **redeploy** (or click "Redeploy" manually)
2. Check the logs - warnings should be gone
3. Visit your Railway URL - server should be working!

---

## 📋 Quick Checklist

- [ ] Added `NODE_ENV=production`
- [ ] Generated and added `SESSION_SECRET`
- [ ] Added all Discord credentials (Client ID, Secret, Bot Token)
- [ ] Added Discord redirect URI with your Railway URL
- [ ] Added all IDs (Guild, Channel, Role IDs)
- [ ] Added `BASE_URL` with your Railway URL
- [ ] Updated Discord Developer Portal with redirect URI
- [ ] Redeployed (or wait for auto-redeploy)

---

## 🎯 Your Server URL

Once variables are added, your API will be available at:
- `https://your-railway-url.railway.app`
- Health check: `https://your-railway-url.railway.app/health`

---

## 🆘 Need Help?

If you have trouble finding any values:
- Discord IDs: Enable Developer Mode in Discord settings
- Discord tokens: Discord Developer Portal
- Railway URL: Check Railway dashboard → Settings or Deployments

**Your server is working! Just need to add the environment variables.** 🚀

