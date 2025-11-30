# 🚀 Deploy Without a VPS - Easy Options

You don't need a VPS! Here are easier alternatives:

---

## 🎯 Recommended: Railway + Vercel (Easiest)

### Why This Combo?
- ✅ **Railway**: Hosts backend + bot (free tier available)
- ✅ **Vercel**: Hosts frontend (always free)
- ✅ **No server management needed**
- ✅ **Automatic HTTPS**
- ✅ **Easy updates via Git**

---

## Option 1: Railway (Backend + Bot) + Vercel (Frontend)

### Step 1: Deploy Backend + Bot on Railway

1. **Sign up at Railway**: https://railway.app
   - Use GitHub to sign up (free tier available)

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Select your `zrx-market` repo

3. **Configure Backend Service**
   - Railway will detect your project
   - Click on the service → "Settings"
   - Set **Root Directory**: `backend`
   - Set **Start Command**: `node server.js`
   - Set **Port**: `3000`

4. **Add Environment Variables**
   - Click "Variables" tab
   - Add all your `.env` variables:
     ```env
     DISCORD_CLIENT_ID=your_client_id
     DISCORD_CLIENT_SECRET=your_client_secret
     DISCORD_REDIRECT_URI=https://your-backend-url.railway.app/auth/discord/callback
     DISCORD_BOT_TOKEN=your_bot_token
     GUILD_ID=your_guild_id
     MIDDLEMAN_CHANNEL_ID=your_channel_id
     MIDDLEMAN_ROLE_ID=your_role_id
     MODERATOR_ROLE_ID=your_moderator_role_id
     CASINO_CHANNEL_ID=your_casino_channel_id
     SESSION_SECRET=generate_random_32_char_secret
     BASE_URL=https://your-backend-url.railway.app
     PORT=3000
     NODE_ENV=production
     ```

5. **Deploy**
   - Railway will automatically deploy
   - Wait for deployment to complete
   - Copy your Railway URL (e.g., `https://zrx-market-production.up.railway.app`)

6. **Add Bot Service** (Separate service for bot)
   - Click "+ New" → "GitHub Repo"
   - Select same repo
   - Set **Root Directory**: `bot`
   - Set **Start Command**: `node index.js`
   - Add same environment variables (especially `DISCORD_BOT_TOKEN`)

### Step 2: Deploy Frontend on Vercel

1. **Sign up at Vercel**: https://vercel.com
   - Use GitHub to sign up (always free)

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select `zrx-market`

3. **Configure Build Settings**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Add Environment Variables**
   - Add: `VITE_API_URL` = `https://your-backend-url.railway.app`

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Vercel will give you a URL (e.g., `https://zrx-market.vercel.app`)

6. **Update Frontend API URL**
   - In Vercel dashboard → Your Project → Settings → Environment Variables
   - Add/Update: `VITE_API_URL` = `https://your-backend-url.railway.app`
   - Redeploy

### Step 3: Connect Your Domain

#### Railway (Backend)
1. Railway Dashboard → Your Service → Settings
2. Click "Custom Domain"
3. Add your domain (e.g., `api.yourdomain.com`)
4. Follow DNS instructions (add CNAME record)
5. Railway handles SSL automatically!

#### Vercel (Frontend)
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `yourdomain.com` or `www.yourdomain.com`)
3. Follow DNS instructions (add A record or CNAME)
4. Vercel handles SSL automatically!

### Step 4: Update Discord OAuth

1. Go to Discord Developer Portal
2. Update redirect URI to: `https://your-backend-url.railway.app/auth/discord/callback`
   OR if using custom domain: `https://api.yourdomain.com/auth/discord/callback`

---

## Option 2: Render (All-in-One)

Render can host everything, but bot needs separate service.

### Step 1: Deploy Backend on Render

1. **Sign up**: https://render.com (free tier available)

2. **Create Web Service**
   - "New" → "Web Service"
   - Connect GitHub repo
   - **Name**: `zrx-backend`
   - **Region**: Choose closest
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free (or paid for better performance)

3. **Add Environment Variables** (same as Railway)

4. **Deploy**
   - Click "Create Web Service"
   - Render URL: `https://zrx-backend.onrender.com`

### Step 2: Deploy Bot on Render (Separate Service)

1. **Create Background Worker**
   - "New" → "Background Worker"
   - Same repo, **Root Directory**: `bot`
   - **Start Command**: `node index.js`
   - Add environment variables
   - Deploy

### Step 3: Deploy Frontend on Render

1. **Create Static Site**
   - "New" → "Static Site"
   - Same repo
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - Add environment variable: `VITE_API_URL` = your backend URL
   - Deploy

---

## Option 3: Fly.io (All-in-One)

Fly.io can run both backend and bot, frontend can go to Vercel.

1. **Sign up**: https://fly.io
2. **Install Fly CLI**: https://fly.io/docs/getting-started/installing-flyctl/
3. **Deploy backend**: `fly launch` (in backend folder)
4. **Deploy bot**: `fly launch` (in bot folder, as separate app)
5. **Deploy frontend**: Use Vercel (same as Option 1)

---

## 🔧 Quick Setup Script for Railway

Create this file in your repo root:

### `railway.json` (optional - helps Railway detect settings)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 📝 Update Frontend to Use Production API

You may need to update your frontend axios configuration:

### In `frontend/src/context/AuthContext.jsx` or wherever you make API calls:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
axios.defaults.baseURL = API_URL;
```

---

## 🌐 DNS Setup (For Custom Domain)

### For Railway Backend:
1. Go to Railway dashboard → Your service → Settings → Custom Domain
2. Add domain: `api.yourdomain.com`
3. Railway will show you a CNAME value like: `your-app.up.railway.app`
4. In your domain registrar:
   - Add CNAME record: `api` → `your-app.up.railway.app`

### For Vercel Frontend:
1. Go to Vercel dashboard → Your project → Settings → Domains
2. Add domain: `yourdomain.com`
3. Vercel will show you DNS records to add
4. Usually an A record pointing to Vercel's IP

---

## 💰 Cost Comparison

| Platform | Backend | Frontend | Bot | Total |
|----------|---------|----------|-----|-------|
| **Railway + Vercel** | Free tier ($5/mo for production) | Free | Free tier | $0-5/mo |
| **Render** | Free tier (sleeps after inactivity) | Free | Free tier | Free |
| **VPS (DigitalOcean)** | $6-12/mo | Included | Included | $6-12/mo |
| **Fly.io** | Free tier available | Free (Vercel) | Free tier | Free |

---

## ✅ Recommended Choice

**For beginners**: Railway + Vercel
- Easiest to set up
- Great free tiers
- Excellent documentation
- Automatic HTTPS
- Git-based deployments

---

## 🚀 Quick Start Commands

After setting up Railway + Vercel:

```bash
# To update your app:
git add .
git commit -m "Update app"
git push

# Railway and Vercel will automatically redeploy!
```

---

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs

---

**TL;DR**: Use Railway for backend/bot + Vercel for frontend. No server needed! 🎉

