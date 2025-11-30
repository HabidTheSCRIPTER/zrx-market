# 🚀 Push Your Code to GitHub - Quick Guide

Your code isn't on GitHub yet. Let's fix that!

## Step 1: Check Your Remote

First, let's see if you have a GitHub repo connected:

```bash
git remote -v
```

If you see a GitHub URL, great! If not, you'll need to create a repo on GitHub first.

---

## Step 2: Create GitHub Repository (If Needed)

1. Go to https://github.com/new
2. Repository name: `zrx-market` (or whatever you want)
3. Description: "ZRX Market - Discord Trading Platform"
4. Choose: **Private** (recommended) or Public
5. **DON'T** initialize with README, .gitignore, or license
6. Click **"Create repository"**

---

## Step 3: Add Remote (If Not Already Added)

If you just created a new repo, add it:

```bash
git remote add origin https://github.com/YOUR_USERNAME/zrx-market.git
```

Replace `YOUR_USERNAME` with your GitHub username.

**OR if you use SSH:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/zrx-market.git
```

**If you already have a remote, skip this step!**

---

## Step 4: Add All Files

```bash
git add .
```

This adds all files (except those in `.gitignore` like `.env`, `node_modules`, etc.)

---

## Step 5: Commit

```bash
git commit -m "Initial commit - ZRX Market application"
```

---

## Step 6: Push to GitHub

```bash
git push -u origin main
```

If it asks for authentication:
- Use a Personal Access Token (not your password)
- Create one at: https://github.com/settings/tokens
- Select scopes: `repo` (full control)

---

## Step 7: Connect Railway

Now that your code is on GitHub:

1. Go to Railway dashboard
2. Click **"+ New Project"**
3. Select **"Deploy from GitHub repo"**
4. Select your `zrx-market` repository
5. Railway will automatically detect and start deploying!

---

## Quick Commands (Copy-Paste)

```bash
# Check remote
git remote -v

# Add all files
git add .

# Commit
git commit -m "Initial commit - ZRX Market"

# Push to GitHub
git push -u origin main
```

---

## Troubleshooting

### "Remote origin already exists"
You already have a remote! Check it:
```bash
git remote -v
```
If it's pointing to the wrong URL, update it:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/zrx-market.git
```

### "Authentication failed"
GitHub requires a Personal Access Token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it: "Railway Deployment"
4. Select scope: `repo`
5. Generate and copy the token
6. Use this token as your password when pushing

### "Permission denied"
Make sure you own the repository or have write access.

---

## Next Steps

After pushing:
1. ✅ Go to Railway
2. ✅ Connect to your GitHub repo
3. ✅ Configure settings (Root Directory: `backend`)
4. ✅ Add environment variables
5. ✅ Deploy!

---

## Files That Won't Be Pushed (Protected by .gitignore)

These files are **NOT** pushed (which is good!):
- `.env` - Your secrets (add these in Railway's Variables)
- `node_modules/` - Dependencies (Railway installs these)
- `*.db` - Database files
- `uploads/` - User uploads
- `data/` - Local data directory

These **ARE** pushed:
- ✅ All your source code
- ✅ `package.json` files
- ✅ Configuration files
- ✅ Documentation

---

**Ready? Run the commands above and then connect Railway!** 🚀

