# ⚡ Quick Deploy Checklist

Follow these steps to deploy your ZRX Market to your domain:

## Pre-Deployment Checklist

- [ ] You have a VPS/server (Ubuntu 20.04+)
- [ ] Your domain DNS is pointing to your server IP
- [ ] You have SSH access to your server
- [ ] You've updated Discord OAuth redirect URI in Discord Developer Portal

---

## Step-by-Step Deployment

### 1. On Your Server - Initial Setup

```bash
# Connect to server
ssh root@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Install PM2
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Upload Your Code

**Option A: Git Clone (if public repo)**
```bash
cd /var/www
sudo git clone YOUR_REPO_URL zrx-market
cd zrx-market
```

**Option B: Upload via SFTP/SCP**
- Use FileZilla, WinSCP, or similar
- Upload entire project to `/var/www/zrx-market`

### 3. Configure Environment

```bash
cd /var/www/zrx-market
nano .env
```

**Paste this template and fill in your values:**

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
CASINO_CHANNEL_ID=your_casino_channel_id

# Server
SESSION_SECRET=$(openssl rand -base64 32)
BASE_URL=https://yourdomain.com
PORT=3000
NODE_ENV=production
```

**Generate SESSION_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Install & Build

```bash
# Install dependencies
npm run install:all

# Build frontend
cd frontend && npm run build && cd ..
```

### 5. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/zrx-market
```

**Paste this (replace `yourdomain.com`):**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/zrx-market /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Set Up SSL (HTTPS)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow prompts and choose to redirect HTTP to HTTPS.

### 7. Start Application

```bash
cd /var/www/zrx-market

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Follow the command it outputs (usually starts with 'sudo env PATH=...')
```

### 8. Configure Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 9. Update Discord OAuth

1. Go to https://discord.com/developers/applications
2. Select your application
3. OAuth2 → Redirects
4. Add: `https://yourdomain.com/auth/discord/callback`
5. Save

---

## Verify Deployment

1. Visit `https://yourdomain.com` - should load your app
2. Check `https://yourdomain.com/health` - should return `{"status":"ok"}`
3. Test Discord login
4. Check bot logs: `pm2 logs zrx-bot`

---

## Useful Commands

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Update code
cd /var/www/zrx-market
git pull  # or upload new files
npm run install:all
cd frontend && npm run build && cd ..
pm2 restart all
```

---

## Troubleshooting

**App not loading?**
- Check PM2: `pm2 status`
- Check logs: `pm2 logs`
- Check Nginx: `sudo nginx -t`
- Check port: `sudo lsof -i :3000`

**SSL not working?**
- Run: `sudo certbot renew`
- Check: `sudo certbot certificates`

**Bot not connecting?**
- Check `.env` file has correct `DISCORD_BOT_TOKEN`
- Check logs: `pm2 logs zrx-bot`

---

## Need More Help?

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

