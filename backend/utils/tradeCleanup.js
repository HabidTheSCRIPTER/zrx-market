const { dbHelpers } = require('../db/config');

// Auto-delete trades older than 5 hours
async function cleanupOldTrades() {
  try {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    
    // Get trades to delete
    const tradesToDelete = await dbHelpers.all(
      `SELECT id, creatorId FROM trades 
       WHERE status = 'active' AND createdAt < ?`,
      [fiveHoursAgo]
    );

    if (tradesToDelete.length > 0) {
      console.log(`🗑️  Auto-deleting ${tradesToDelete.length} trade(s) older than 5 hours...`);
      
      // Delete the trades
      await dbHelpers.run(
        `DELETE FROM trades WHERE status = 'active' AND createdAt < ?`,
        [fiveHoursAgo]
      );

      console.log(`✅ Successfully deleted ${tradesToDelete.length} expired trade(s)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up old trades:', error);
  }
}

// Run cleanup every 30 minutes
function startTradeCleanup() {
  console.log('🕐 Starting trade cleanup scheduler (runs every 30 minutes)...');
  
  // Run immediately on startup
  cleanupOldTrades();
  
  // Then run every 30 minutes
  setInterval(cleanupOldTrades, 30 * 60 * 1000);
}

module.exports = {
  cleanupOldTrades,
  startTradeCleanup
};




