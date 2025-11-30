const { dbHelpers } = require('../db/config');

// Helper function to create notifications
async function createNotification(userId, type, title, message, link = null) {
  try {
    await dbHelpers.run(
      'INSERT INTO notifications (userId, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message, link]
    );
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Notification types
const NotificationTypes = {
  NEW_MESSAGE: 'new_message',
  TRADE_OFFER: 'trade_offer',
  TRADE_ACCEPTED: 'trade_accepted',
  TRADE_COMPLETED: 'trade_completed',
  NEW_REVIEW: 'new_review',
  TRADE_FAVORITED: 'trade_favorited',
  SYSTEM: 'system'
};

module.exports = { createNotification, NotificationTypes };




