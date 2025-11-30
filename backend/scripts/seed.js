require('dotenv').config();
const { initDatabase, dbHelpers } = require('../db/config');

async function seed() {
  console.log('Starting database seed...');

  try {
    // Initialize database
    await initDatabase();

    // Create demo users
    const demoUsers = [
      {
        discordId: '123456789012345678',
        username: 'DemoUser#1234',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
        verified: 1,
        robloxUsername: 'DemoRobloxUser',
        roles: JSON.stringify([process.env.MODERATOR_ROLE_ID || '1391972977586864218'])
      },
      {
        discordId: '987654321098765432',
        username: 'TestTrader#5678',
        avatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
        verified: 1,
        robloxUsername: 'TestTraderRoblox',
        roles: JSON.stringify([])
      },
      {
        discordId: '111111111111111111',
        username: 'RegularUser#9999',
        avatar: 'https://cdn.discordapp.com/embed/avatars/2.png',
        verified: 0,
        robloxUsername: null,
        roles: JSON.stringify([])
      }
    ];

    console.log('Creating demo users...');
    for (const user of demoUsers) {
      await dbHelpers.run(
        `INSERT OR REPLACE INTO users (discordId, username, avatar, verified, robloxUsername, roles)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.discordId, user.username, user.avatar, user.verified, user.robloxUsername, user.roles]
      );
      console.log(`  Created user: ${user.username}`);
    }

    // Create demo trades
    const demoTrades = [
      {
        creatorId: '123456789012345678',
        offered: '100 Robux',
        wanted: 'Discord Nitro',
        value: '$10',
        notes: 'Looking for a quick trade',
        robloxUsername: 'DemoRobloxUser'
      },
      {
        creatorId: '987654321098765432',
        offered: 'Discord Nitro',
        wanted: '150 Robux',
        value: '$15',
        notes: 'Verified trader',
        robloxUsername: 'TestTraderRoblox'
      },
      {
        creatorId: '123456789012345678',
        offered: 'Game Pass',
        wanted: '50 Robux',
        value: '$5',
        notes: null,
        robloxUsername: 'DemoRobloxUser'
      }
    ];

    console.log('Creating demo trades...');
    for (const trade of demoTrades) {
      await dbHelpers.run(
        `INSERT INTO trades (creatorId, offered, wanted, value, notes, robloxUsername)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [trade.creatorId, trade.offered, trade.wanted, trade.value, trade.notes, trade.robloxUsername]
      );
      console.log(`  Created trade: ${trade.offered} for ${trade.wanted}`);
    }

    // Create demo middleman request
    console.log('Creating demo middleman request...');
    const middlemanRequest = await dbHelpers.run(
      `INSERT INTO middleman (requesterId, user1, user2, item, value, proofLinks, robloxUsername, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '123456789012345678',
        '987654321098765432',
        '111111111111111111',
        'Trading 100 Robux for Discord Nitro',
        '$10',
        JSON.stringify(['https://example.com/proof1.png', 'https://example.com/proof2.png']),
        'DemoRobloxUser',
        'pending'
      ]
    );
    console.log(`  Created middleman request #${middlemanRequest.lastID}`);

    // Create demo report
    console.log('Creating demo report...');
    const report = await dbHelpers.run(
      `INSERT INTO reports (reporterId, accusedDiscordId, details, evidenceLinks, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        '987654321098765432',
        '999999999999999999',
        'User scammed me out of 50 Robux. Refused to complete trade after receiving payment.',
        JSON.stringify(['https://example.com/screenshot1.png']),
        'pending'
      ]
    );
    console.log(`  Created report #${report.lastID}`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nDemo credentials:');
    console.log('  - DemoUser#1234 (Verified, Moderator): 123456789012345678');
    console.log('  - TestTrader#5678 (Verified): 987654321098765432');
    console.log('  - RegularUser#9999 (Not Verified): 111111111111111111');
    console.log('\nNote: These are demo users. In production, users are created via Discord OAuth.');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();

