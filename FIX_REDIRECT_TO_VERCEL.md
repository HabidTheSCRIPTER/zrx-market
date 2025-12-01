# 🔧 Fix Discord Login Redirect - Redirect to Vercel Instead of Localhost

## The Problem

After Discord authentication, it redirects you to `localhost` instead of your Vercel website.

Your Vercel domain: `https://zrx-market-git-main-zrxmarkets-projects.vercel.app`

---

## ✅ The Fix: Add FRONTEND_URL to Railway

### Step 1: Add FRONTEND_URL Variable

1. Go to **Railway Dashboard** → Your Service → **Variables** tab
2. Click **"+ New Variable"**
3. Add:
   - **Variable Name**: `FRONTEND_URL`
   - **Value**: `https://zrx-market-git-main-zrxmarkets-projects.vercel.app`
4. Click **"Add"**

This tells Railway where to redirect after Discord login!

---

## Step 2: Make Sure You Have Your Railway Backend URL

You need your **Railway backend URL** (not Vercel). It's the URL that shows the JSON API response.

Add to Railway Variables:
- **Variable Name**: `BASE_URL`
- **Value**: `https://YOUR-RAILWAY-BACKEND-URL.railway.app`
  - (The Railway backend URL where you saw the JSON response)

- **Variable Name**: `DISCORD_REDIRECT_URI`
- **Value**: `https://YOUR-RAILWAY-BACKEND-URL.railway.app/auth/discord/callback`
  - (Railway backend URL + `/auth/discord/callback`)

---

## Step 3: Update Discord Developer Portal

1. Go to: https://discord.com/developers/applications
2. Your Application → **OAuth2** → **Redirects**
3. Make sure you have:
   - `https://YOUR-RAILWAY-BACKEND-URL.railway.app/auth/discord/callback`
   - (This should be your **Railway backend URL**, not Vercel!)

---

## Step 4: Update Frontend to Point to Railway Backend

Your Vercel frontend needs to know where the Railway backend is:

1. Go to **Vercel Dashboard**
2. Your Project → **Settings** → **Environment Variables**
3. Add:
   - **Variable Name**: `VITE_API_URL`
   - **Value**: `https://YOUR-RAILWAY-BACKEND-URL.railway.app`
   - (Your Railway backend URL)
4. **Redeploy** your frontend on Vercel

---

## 📋 Summary - What Goes Where

### Railway (Backend) Variables:
- `FRONTEND_URL` = `https://zrx-market-git-main-zrxmarkets-projects.vercel.app` ⭐ **This fixes the redirect!**
- `BASE_URL` = Your Railway backend URL
- `DISCORD_REDIRECT_URI` = Your Railway backend URL + `/auth/discord/callback`
- All other Discord credentials

### Vercel (Frontend) Variables:
- `VITE_API_URL` = Your Railway backend URL

### Discord OAuth Redirect:
- Should be: Your Railway backend URL + `/auth/discord/callback`

---

## ✅ After Adding FRONTEND_URL

1. Railway will auto-redeploy
2. After Discord login, it will redirect to your Vercel website instead of localhost!

---

**Add `FRONTEND_URL` = your Vercel URL to Railway Variables!** 🎯

