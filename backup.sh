#!/bin/bash

# ZRX Market Database Backup Script
# Set this up as a cron job for automatic backups

BACKUP_DIR="/var/backups/zrx-market"
PROJECT_DIR="/var/www/zrx-market"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
if [ -f "$PROJECT_DIR/data/zrx-market.db" ]; then
    cp "$PROJECT_DIR/data/zrx-market.db" "$BACKUP_DIR/zrx-market_$DATE.db"
    echo "✅ Database backed up to: $BACKUP_DIR/zrx-market_$DATE.db"
    
    # Compress old backups (optional)
    # gzip "$BACKUP_DIR/zrx-market_$DATE.db"
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "zrx-market_*.db" -mtime +7 -delete
    echo "🧹 Cleaned up backups older than 7 days"
else
    echo "❌ Database file not found at: $PROJECT_DIR/data/zrx-market.db"
    exit 1
fi

# Optional: Backup uploads directory
if [ -d "$PROJECT_DIR/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$PROJECT_DIR" uploads
    echo "✅ Uploads backed up to: $BACKUP_DIR/uploads_$DATE.tar.gz"
    
    # Keep only last 3 days of upload backups
    find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +3 -delete
fi

echo "✅ Backup complete!"

