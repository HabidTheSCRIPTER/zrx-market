# Miss Death Community Bot - Complete Setup Guide

## 🤖 Bot Name Suggestions

Here are some good names for your bot:
1. **Miss Death Bot** (Simple and clear)
2. **Death Bot** (Short and clean)
3. **Miss Death Helper** (Friendly)
4. **Death's Assistant** (Cool and mysterious)
5. **Miss Death Assistant** (Professional)

**Recommendation:** `Miss Death Bot` - It's clear, professional, and matches your community name.

---

## 📋 Part 1: Create New Discord Bot

### Step 1: Create Bot Application
1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Name it: `Miss Death Bot` (or your preferred name)
4. Click **"Create"**

### Step 2: Set Up Bot
1. Go to **"Bot"** section (left sidebar)
2. Click **"Add Bot"** → **"Yes, do it!"**
3. Under **"Bot"** settings:
   - **Username:** Miss Death Bot
   - **Icon:** Upload a profile picture (optional but recommended)
   - **Public Bot:** OFF (private bot)
   - **Requires OAuth2 Code Grant:** OFF

### Step 3: Enable Privileged Gateway Intents
In the **"Bot"** section, scroll down to **"Privileged Gateway Intents"** and enable:
- ✅ **MESSAGE CONTENT INTENT** (Required for reading messages)
- ✅ **SERVER MEMBERS INTENT** (Required for member events)
- Click **"Save Changes"**

### Step 4: Get Bot Token
1. Still in **"Bot"** section
2. Under **"Token"**, click **"Reset Token"** or **"Copy"**
3. **SAVE THIS TOKEN** - You'll need it for Railway! ⚠️

### Step 5: Invite Bot to Server

**⚠️ IMPORTANT: Skip the OAuth2 URL Generator! It doesn't work for private bots.**

Since your bot is **Private**, you **CANNOT** use the OAuth2 URL Generator. That's fine - just use the manual invite URL below!

**Manual Invite URL Method:**

1. Go to **"OAuth2"** → **"General"** (just to get your Client ID)
2. Copy your **"Client ID"** (Application ID) - you already have this: `1454975799907193078`
3. Use this URL format (already filled in with your Client ID):

```
https://discord.com/api/oauth2/authorize?client_id=1454975799907193078&permissions=8&scope=bot%20applications.commands
```

**OR use this URL with specific permissions (recommended):**
```
https://discord.com/api/oauth2/authorize?client_id=1454975799907193078&permissions=274877906944&scope=bot%20applications.commands
```

4. **Copy and paste the URL above into your browser**
5. Select your "Miss Death" server
6. Click "Authorize"
7. Done! Bot is now in your server
8. **Important:** Make sure bot role is **ABOVE** any roles you want it to manage (drag it up in Server Settings → Roles)

**Permissions Breakdown:**
- **`permissions=8`** = Administrator (gives all permissions - easiest)
- **`permissions=274877906944`** = Specific permissions:
  - Manage Channels
  - Manage Roles  
  - Send Messages
  - Embed Links
  - Read Message History
  - Add Reactions
  - Ban Members
  - Kick Members
  - Manage Messages

**✅ You don't need to touch the OAuth2 URL Generator at all! Just use the manual URL above.**

### Step 6: (Optional) OAuth2 Redirects for Website Login

**Skip this if you're only using the bot (not the website).**

If you need OAuth2 for website login features:
1. Go to **"OAuth2"** → **"Redirects"**
2. Click **"Add Redirect"**
3. Add your redirect URL (e.g., `https://your-domain.com/auth/discord/callback`)
4. **This works fine for private bots** - redirects are allowed

**Note:** The "URL Generator" tab won't work, but the "Redirects" tab works fine!

---

## 🚂 Part 2: Railway Deployment

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```
This will open a browser window - log in with GitHub

### Step 3: Create New Project
```bash
cd bot
railway init
```
- Select: **"Empty Project"**
- Name it: `miss-death-bot` or similar

### Step 4: Set Up Railway Environment Variables

In Railway dashboard (or via CLI), add these variables:

```env
# Discord Bot Token (from Part 1, Step 4)
DISCORD_BOT_TOKEN=your_bot_token_here

# Your Discord Server ID (right-click server → Copy Server ID)
GUILD_ID=your_server_id_here

# Optional - Casino Channel (if you want to keep casino features)
CASINO_CHANNEL_ID=your_casino_channel_id_here

# Optional - AI Chat (if using Groq API)
GROQ_API_KEY=your_groq_api_key_here

# Node Environment
NODE_ENV=production
```

### Step 5: Configure Railway Build Settings

In Railway dashboard:
1. Go to your service
2. Click **"Settings"** → **"Deploy"**
3. Set:
   - **Root Directory:** `bot`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### Step 6: Deploy!
```bash
railway up
```
Or push to GitHub and Railway will auto-deploy.

---

## ⚙️ Part 3: Configure Bot in Discord

### Step 1: Run Setup Command
Once bot is online, in your Discord server run:
```
/setup
```
This will create all channels automatically!

### Step 2: Configure Welcome Message
```
/welcome channel
```
Select: `#welcom !` channel

```
/welcome message
```
Set message: `hello welcome to miss death are server is run by me (alli) and juli !! hope you have a good time in are server !`

Or customize with placeholders:
- `{user}` - Mentions new member
- `{username}` - Their username
- `{server}` - Server name
- `{memberCount}` - Total members

### Step 3: Set Auto-Role (Optional)
```
/welcome role
```
Select the role to auto-assign to new members

---

## 🎯 Part 4: Additional Features to Add

### Features Already Included:
✅ Auto-setup channels
✅ Welcome messages
✅ Auto-roles
✅ Casino/Economy system
✅ Basic moderation commands

### Recommended Features to Add:

#### 1. **Leveling System**
- Users gain XP for chatting
- Leaderboard command
- Role rewards at certain levels

#### 2. **Giveaway System**
- `/giveaway start` - Create giveaways
- `/giveaway end` - End and pick winner
- Automatic winner selection

#### 3. **Voting/Poll System**
- `/poll` - Create polls with reactions
- Results tracking
- Multiple choice polls

#### 4. **Role Reaction System**
- Reaction roles in `#get-roles`
- Emoji-based role selection
- Button-based role selection

#### 5. **Moderation Commands**
- `/warn` - Warn users
- `/mute` - Timeout users
- `/ban` - Ban users
- `/kick` - Kick users
- Warning logs

#### 6. **Stats Commands**
- `/serverstats` - Server statistics
- `/userstats` - User statistics
- `/leaderboard` - Top members

#### 7. **Announcement System**
- `/announce` - Send announcements
- Role mentions
- Embed formatting

#### 8. **Anti-Raid Protection**
- Rate limiting
- Auto-ban suspicious activity
- Lockdown mode

---

## 📝 Environment Variables Checklist

Make sure these are set in Railway:

```env
✅ DISCORD_BOT_TOKEN=your_token
✅ GUILD_ID=your_server_id
✅ NODE_ENV=production
✅ CASINO_CHANNEL_ID=channel_id (optional)
✅ GROQ_API_KEY=api_key (optional, for AI)
```

---

## 🐛 Troubleshooting

### Bot not responding?
1. Check Railway logs: `railway logs`
2. Verify bot token is correct
3. Make sure bot is online in Discord
4. Check bot has proper permissions

### Commands not showing?
1. Bot needs to restart to register commands
2. Wait 5-10 minutes for Discord to update
3. Try typing `/` to see if commands appear

### Welcome messages not working?
1. Run `/welcome channel` to set channel
2. Check bot has permission to send messages
3. Verify channel exists

### Setup command not working?
1. Make sure you have Administrator permission
2. Bot needs "Manage Channels" permission
3. Check Railway logs for errors

---

## 🎨 Customization Ideas

### Bot Profile Picture
- Use a skull/death theme
- Match your server's aesthetic
- Square image (512x512 recommended)

### Bot Status
- "Watching miss death community"
- "Playing with death"
- Custom status message

### Welcome Message Style
Make it match your server's vibe! Examples:
- Friendly: `Hey {user}! Welcome to Miss Death! Hope you enjoy your stay!`
- Casual: `yo {user} welcome to the server!! have fun`
- Spooky: `Welcome to the realm of Miss Death, {user}...`

---

## ✅ Quick Start Checklist

- [ ] Created Discord bot application
- [ ] Copied bot token
- [ ] Enabled MESSAGE CONTENT INTENT
- [ ] Invited bot to server
- [ ] Created Railway account
- [ ] Deployed bot to Railway
- [ ] Set environment variables
- [ ] Ran `/setup` command
- [ ] Configured `/welcome channel`
- [ ] Set `/welcome message`
- [ ] Tested welcome message (have someone join)
- [ ] Bot is working! 🎉

---

## 📞 Need Help?

If something isn't working:
1. Check Railway logs: `railway logs`
2. Verify all environment variables are set
3. Make sure bot has required permissions
4. Check Discord Developer Portal settings

---

**Good luck with Miss Death community! 💀✨**

