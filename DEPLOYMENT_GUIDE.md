# 🚀 Complete Deployment Guide with Custom Domain

This guide will help you deploy your ZRX Market application to a VPS/server with your custom domain.

## Prerequisites

1. **VPS/Server** (Ubuntu 20.04+ recommended)
   - Recommended: DigitalOcean, Linode, Vultr, AWS EC2, or any VPS provider
   - Minimum: 1GB RAM, 1 CPU core
   - Recommended: 2GB+ RAM, 2+ CPU cores

2. **Domain Name** configured to point to your server IP

3. **SSH Access** to your server

---

## Step 1: Server Setup

### 1.1 Connect to Your Server

```bash
ssh root@your-server-ip
# Or: ssh username@your-server-ip
```

### 1.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Node.js (v20+)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x.x
```

### 1.4 Install Git

```bash
sudo apt install -y git
```

### 1.5 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.6 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 1.7 Install Certbot (for SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 2: Deploy Your Application

### 2.1 Clone Repository

```bash
cd /var/www
sudo git clone YOUR_REPO_URL zrx-market
cd zrx-market
# Or upload via SFTP/SCP if private repo
```

### 2.2 Install Dependencies

```bash
npm run install:all
```

### 2.3 Build Frontend

```bash
cd frontend
npm run build
cd ..
```

---

## Step 3: Configure Environment Variables

### 3.1 Create Production `.env` File

```bash
cd /var/www/zrx-market
sudo nano .env
```

### 3.2 Add Production Environment Variables

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_guild_id
MIDDLEMAN_CHANNEL_ID=your_channel_id
MIDDLEMAN_ROLE_ID=your_role_id
MODERATOR_ROLE_ID=your_moderator_role_id
CASINO_CHANNEL_ID=your_casino_channel_id

# Server Configuration
SESSION_SECRET=GENERATE_A_VERY_LONG_RANDOM_SECRET_HERE_MINIMUM_32_CHARACTERS
BASE_URL=https://yourdomain.com
PORT=3000
NODE_ENV=production

# Optional
REPORTS_CHANNEL_ID=your_reports_channel_id
DISCORD_WEBHOOK_SECRET=your_webhook_secret
```

**Generate SESSION_SECRET:**
```bash
openssl rand -base64 32
```

### 3.3 Update Discord OAuth Redirect URI

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 → Redirects
4. Add: `https://yourdomain.com/auth/discord/callback`
5. Save changes

---

## Step 4: Configure Backend to Serve Frontend

The backend needs to serve the built frontend files. Update `backend/server.js`:

```javascript
// Add this AFTER all your routes but BEFORE error handling middleware
const path = require('path');

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle React routing - return all requests to React app
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

---

## Step 5: Configure Nginx

### 5.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/zrx-market
```

### 5.2 Add Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Increase upload size limit (for images/files)
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

### 5.3 Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/zrx-market /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## Step 6: Set Up SSL (HTTPS)

### 6.1 Get SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 6.2 Auto-Renewal (Already Enabled)

Certbot automatically sets up renewal. Test it:

```bash
sudo certbot renew --dry-run
```

---

## Step 7: Start Application with PM2

### 7.1 Create PM2 Ecosystem File

```bash
cd /var/www/zrx-market
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'zrx-backend',
      script: './backend/server.js',
      cwd: '/var/www/zrx-market',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'zrx-bot',
      script: './bot/index.js',
      cwd: '/var/www/zrx-market',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

### 7.2 Create Logs Directory

```bash
mkdir -p logs
```

### 7.3 Start PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Follow the command it gives you (usually: sudo env PATH=$PATH:...)
```

### 7.4 Check Status

```bash
pm2 status
pm2 logs
```

---

## Step 8: Firewall Configuration

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

---

## Step 9: Verify Everything Works

1. **Check Backend:** `https://yourdomain.com/health` should return `{"status":"ok"}`

2. **Check Frontend:** Visit `https://yourdomain.com` - should load your app

3. **Check Bot:** Look at PM2 logs: `pm2 logs zrx-bot`

4. **Test Discord OAuth:** Try logging in with Discord

---

## Step 10: Maintenance Commands

### View Logs
```bash
pm2 logs                    # All logs
pm2 logs zrx-backend        # Backend only
pm2 logs zrx-bot            # Bot only
```

### Restart Services
```bash
pm2 restart all             # Restart everything
pm2 restart zrx-backend     # Restart backend only
pm2 restart zrx-bot         # Restart bot only
```

### Update Application
```bash
cd /var/www/zrx-market
git pull                    # Or upload new files
npm run install:all         # Update dependencies
cd frontend && npm run build && cd ..  # Rebuild frontend
pm2 restart all             # Restart services
```

### Monitor Resources
```bash
pm2 monit                   # Real-time monitoring
```

---

## Troubleshooting

### Application Not Starting

1. Check logs: `pm2 logs`
2. Check environment variables: `cat .env`
3. Check Node.js version: `node --version`
4. Check port availability: `sudo lsof -i :3000`

### Nginx Errors

1. Test config: `sudo nginx -t`
2. Check error log: `sudo tail -f /var/log/nginx/error.log`
3. Check access log: `sudo tail -f /var/log/nginx/access.log`

### SSL Issues

1. Renew certificate: `sudo certbot renew`
2. Check certificate: `sudo certbot certificates`

### Database Issues

1. Check database file: `ls -la data/zrx-market.db`
2. Check permissions: `sudo chown -R $USER:$USER data/`

### Discord Bot Not Connecting

1. Check bot token in `.env`
2. Check PM2 logs: `pm2 logs zrx-bot`
3. Verify bot is invited to server

---

## Backup Strategy

### Backup Database

```bash
# Create backup script
nano /var/www/zrx-market/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/zrx-market"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /var/www/zrx-market/data/zrx-market.db $BACKUP_DIR/zrx-market_$DATE.db
# Keep only last 7 days
find $BACKUP_DIR -name "zrx-market_*.db" -mtime +7 -delete
```

Make executable:
```bash
chmod +x backup.sh
```

Add to cron (daily backup at 2 AM):
```bash
crontab -e
# Add: 0 2 * * * /var/www/zrx-market/backup.sh
```

---

## Security Checklist

- [x] Use HTTPS (SSL/TLS)
- [x] Set secure SESSION_SECRET (32+ characters)
- [x] Configure firewall (UFW)
- [x] Use environment variables for secrets
- [x] Set up automatic backups
- [x] Keep system updated
- [x] Use PM2 for process management
- [x] Configure Nginx proxy headers
- [x] Set file upload limits

---

## Quick Reference

| Service | Command |
|---------|---------|
| View status | `pm2 status` |
| View logs | `pm2 logs` |
| Restart all | `pm2 restart all` |
| Stop all | `pm2 stop all` |
| Nginx reload | `sudo systemctl reload nginx` |
| Check Nginx | `sudo nginx -t` |

---

## Need Help?

- Check PM2 logs: `pm2 logs`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check system logs: `journalctl -xe`

Good luck with your deployment! 🚀

