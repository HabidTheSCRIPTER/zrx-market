const path = require('path');
// Use backend's node_modules
const dotenv = require('../backend/node_modules/dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
const axios = require('../backend/node_modules/axios');

async function sendStoreEmbed() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = '1387655173782114375';

  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  const embed = {
    title: '🛒 Store Item',
    description: 'Buy this **spaghetti tualetti diamond with shark mutation**\n**250 M/s** for **25 USD**\n\nDM <@909463977787015228>',
    image: {
      url: 'https://bloxystore.com/cdn/shop/files/spageh.png?v=1759459891&width=1946'
    },
    color: 0x5865F2,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        embeds: [embed]
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Successfully sent store embed to channel ${channelId}`);
    console.log(`Message ID: ${response.data.id}`);
  } catch (error) {
    console.error('❌ Error sending store embed:', error.response?.data || error.message);
    process.exit(1);
  }
}

sendStoreEmbed();

