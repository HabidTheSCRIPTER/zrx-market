const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionType, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const EventEmitter = require('events');

// Database connection for bot
// Ensure data directory exists
const fs = require('fs');
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('✅ Created data directory:', DATA_DIR);
  } catch (mkdirErr) {
    console.warn('⚠️  Could not create data directory:', mkdirErr.message);
    // Try using current working directory as fallback
    const fallbackDir = path.join(process.cwd(), 'data');
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
        console.log('✅ Created fallback data directory:', fallbackDir);
      }
    } catch (fallbackErr) {
      console.warn('⚠️  Could not create fallback data directory:', fallbackErr.message);
    }
  }
}

const DB_PATH = path.join(DATA_DIR, 'zrx-market.db');
console.log('📁 Database path:', DB_PATH);
console.log('📁 Current working directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Bot: Error opening database:', err.message);
    console.error('❌ Database path:', DB_PATH);
    console.error('❌ Error code:', err.code, 'Error number:', err.errno);
  } else {
    console.log('✅ Bot database opened successfully');
    // Test if database is writable
    db.run('PRAGMA journal_mode = WAL;', (pragmaErr) => {
      if (pragmaErr) {
        console.warn('⚠️  Warning: Could not set WAL mode, database may be read-only:', pragmaErr.message);
      } else {
        console.log('✅ Database is writable (WAL mode enabled)');
      }
    });
  }
});

const dbHelpers = {
  get: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  run: (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

// Snarky responses array
const SNARKY_RESPONSES = {
  noPermission: [
    "What the fuck do you think you're doing? You don't have permission for that shit.",
    "Nah, you can't do that. Get the fuck outta here.",
    "Permission denied, you absolute moron. Try getting the right role first.",
    "Fuck off, you don't have permission. Simple as that."
  ],
  error: [
    "Well that's fucking broken. Good job breaking it.",
    "Something went wrong. Shocking, I know.",
    "Error occurred. Probably your fault.",
    "That didn't work. Surprise, surprise."
  ],
  notFound: [
    "That shit doesn't exist. Try again, dumbass.",
    "Couldn't find that. Maybe it never existed?",
    "Not found. You sure you typed that right?",
    "Doesn't exist. What a surprise."
  ],
  success: [
    "Done. You're welcome, I guess.",
    "There you go. Was that so hard?",
    "Success. Don't fuck it up now.",
    "Done. Try not to break it."
  ]
};

function getSnarkyResponse(type) {
  const responses = SNARKY_RESPONSES[type] || ["Whatever."];
  return responses[Math.floor(Math.random() * responses.length)];
}

class MiddlemanBot extends EventEmitter {
  constructor() {
    super();
    this.activeCollectors = new Map();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping
      ]
    });

    // Initialize Casino Manager
    const CasinoManager = require('./casino/CasinoManager');
    this.casino = new CasinoManager(db);

    this.setupEventHandlers();
    this.setupCommands();
  }

  setupEventHandlers() {
    this.client.once(Events.ClientReady, async () => {
      console.log(`🤖 Bot logged in as ${this.client.user.tag} - Ready to be a snarky asshole!`);
      await this.registerSlashCommands();
      await this.setupPendingThreadTimers();
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      try {
        const autoRoleId = '1399955798414590042';
        const role = await member.guild.roles.fetch(autoRoleId);
        if (role) {
          await member.roles.add(role);
          console.log(`✅ Assigned auto-role to ${member.user.tag}`);
        }

        try {
          await member.send('Hi and welcome to my server i was made by ZRX');
          console.log(`✅ Sent welcome message to ${member.user.tag}`);
        } catch (dmError) {
          console.log(`Could not send DM to ${member.user.tag}, they may have DMs disabled`);
        }
      } catch (error) {
        console.error('Error in GuildMemberAdd handler:', error.message);
      }
    });

    this.on('requestUpdated', async (request) => {
      console.log(`Request ${request.id} updated to status: ${request.status}`);
    });

    this.on('newReport', async (report) => {
      await this.notifyModerationChannel(report);
    });

    this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (reaction.message.channel.isThread() && 
          reaction.message.channel.parentId === process.env.MIDDLEMAN_CHANNEL_ID &&
          reaction.emoji.name === '✅' &&
          !user.bot) {
        await this.handleAcceptanceReaction(reaction, user);
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('report_request_info_')) {
          const reportId = parseInt(customId.replace('report_request_info_', ''));
          await this.handleRequestMoreInfo(interaction, reportId);
        } else if (customId.startsWith('report_chat_accused_')) {
          const reportId = parseInt(customId.replace('report_chat_accused_', ''));
          await this.handleChatWithAccused(interaction, reportId);
        }
        return;
      }

      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      }
    });
  }

  async registerSlashCommands() {
    try {
      const commands = [
        // Public commands
        new SlashCommandBuilder()
          .setName('help')
          .setDescription('Show all available commands'),
        
        new SlashCommandBuilder()
          .setName('ping')
          .setDescription('Check if the bot is alive'),
        
        new SlashCommandBuilder()
          .setName('stats')
          .setDescription('Show market statistics'),
        
        new SlashCommandBuilder()
          .setName('user')
          .setDescription('Look up a user')
          .addStringOption(option =>
            option.setName('discordid')
              .setDescription('Discord ID of the user')
              .setRequired(true)),
        
        new SlashCommandBuilder()
          .setName('trade')
          .setDescription('View trade details')
          .addIntegerOption(option =>
            option.setName('id')
              .setDescription('Trade ID')
              .setRequired(true)),

        // Casino commands
        new SlashCommandBuilder()
          .setName('balance')
          .setDescription('Check your casino coin balance'),
        
        new SlashCommandBuilder()
          .setName('daily')
          .setDescription('Claim your daily reward (500-1000 coins)'),
        
        new SlashCommandBuilder()
          .setName('casinostats')
          .setDescription('View casino statistics')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to check stats for (optional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('coinflip')
          .setDescription('Flip a coin (heads or tails)')
          .addIntegerOption(option =>
            option.setName('bet')
              .setDescription('Amount to bet')
              .setRequired(true)
              .setMinValue(10)
              .setMaxValue(10000))
          .addStringOption(option =>
            option.setName('choice')
              .setDescription('Heads or tails')
              .setRequired(true)
              .addChoices(
                { name: 'Heads', value: 'heads' },
                { name: 'Tails', value: 'tails' }
              )),
        
        new SlashCommandBuilder()
          .setName('dice')
          .setDescription('Roll dice (1-6, 5x multiplier if you win)')
          .addIntegerOption(option =>
            option.setName('bet')
              .setDescription('Amount to bet')
              .setRequired(true)
              .setMinValue(10)
              .setMaxValue(10000))
          .addIntegerOption(option =>
            option.setName('guess')
              .setDescription('Your guess (1-6)')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(6)),
        
        new SlashCommandBuilder()
          .setName('double')
          .setDescription('Double or nothing - 50/50 chance to double your bet')
          .addIntegerOption(option =>
            option.setName('bet')
              .setDescription('Amount to bet')
              .setRequired(true)
              .setMinValue(10)
              .setMaxValue(10000)),
        
        new SlashCommandBuilder()
          .setName('roulette')
          .setDescription('Play roulette')
          .addIntegerOption(option =>
            option.setName('bet')
              .setDescription('Amount to bet')
              .setRequired(true)
              .setMinValue(10)
              .setMaxValue(10000))
          .addStringOption(option =>
            option.setName('choice')
              .setDescription('Red, black, green, or a number (0-36)')
              .setRequired(true)),
        
        new SlashCommandBuilder()
          .setName('blackjack')
          .setDescription('Start a blackjack game')
          .addIntegerOption(option =>
            option.setName('bet')
              .setDescription('Amount to bet')
              .setRequired(true)
              .setMinValue(10)
              .setMaxValue(10000)),
        
        new SlashCommandBuilder()
          .setName('hit')
          .setDescription('Draw another card in blackjack'),
        
        new SlashCommandBuilder()
          .setName('stand')
          .setDescription('End your turn in blackjack'),

        // Moderator commands
        new SlashCommandBuilder()
          .setName('mm')
          .setDescription('Middleman commands')
          .addSubcommand(subcommand =>
            subcommand
              .setName('accept')
              .setDescription('Accept a middleman request')
              .addIntegerOption(option =>
                option.setName('id')
                  .setDescription('Request ID')
                  .setRequired(true)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('decline')
              .setDescription('Decline a middleman request')
              .addIntegerOption(option =>
                option.setName('id')
                  .setDescription('Request ID')
                  .setRequired(true)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('complete')
              .setDescription('Mark a request as completed')
              .addIntegerOption(option =>
                option.setName('id')
                  .setDescription('Request ID')
                  .setRequired(true)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('list')
              .setDescription('List middleman requests')
              .addStringOption(option =>
                option.setName('status')
                  .setDescription('Filter by status')
                  .setRequired(false)
                  .addChoices(
                    { name: 'Pending', value: 'pending' },
                    { name: 'Accepted', value: 'accepted' },
                    { name: 'Declined', value: 'declined' },
                    { name: 'Completed', value: 'completed' }
                  ))),
        
        new SlashCommandBuilder()
          .setName('blacklist')
          .setDescription('Blacklist management')
          .addSubcommand(subcommand =>
            subcommand
              .setName('add')
              .setDescription('Blacklist a user')
              .addUserOption(option =>
                option.setName('user')
                  .setDescription('User to blacklist')
                  .setRequired(true))
              .addStringOption(option =>
                option.setName('reason')
                  .setDescription('Reason for blacklist')
                  .setRequired(true)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('remove')
              .setDescription('Remove user from blacklist')
              .addUserOption(option =>
                option.setName('user')
                  .setDescription('User to remove')
                  .setRequired(true)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('list')
              .setDescription('List all blacklisted users'))
          .addSubcommand(subcommand =>
            subcommand
              .setName('check')
              .setDescription('Check if user is blacklisted')
              .addUserOption(option =>
                option.setName('user')
                  .setDescription('User to check')
                  .setRequired(true))),
        
        new SlashCommandBuilder()
          .setName('report')
          .setDescription('Report management')
          .addSubcommand(subcommand =>
            subcommand
              .setName('list')
              .setDescription('List reports')
              .addStringOption(option =>
                option.setName('status')
                  .setDescription('Filter by status')
                  .setRequired(false)))
          .addSubcommand(subcommand =>
            subcommand
              .setName('view')
              .setDescription('View report details')
              .addIntegerOption(option =>
                option.setName('id')
                  .setDescription('Report ID')
                  .setRequired(true))),
        
        new SlashCommandBuilder()
          .setName('verify')
          .setDescription('Verify a user')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to verify')
              .setRequired(true)),
        
        new SlashCommandBuilder()
          .setName('unverify')
          .setDescription('Unverify a user')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to unverify')
              .setRequired(true)),
        
        new SlashCommandBuilder()
          .setName('serverstats')
          .setDescription('Show server statistics'),
        
        new SlashCommandBuilder()
          .setName('cleanup')
          .setDescription('Clean up old expired trades'),
        
        new SlashCommandBuilder()
          .setName('casinoadd')
          .setDescription('Add coins to a user (moderator only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to add coins to')
              .setRequired(true))
          .addIntegerOption(option =>
            option.setName('amount')
              .setDescription('Amount of coins to add')
              .setRequired(true)
              .setMinValue(1)),
        
        new SlashCommandBuilder()
          .setName('casinoremove')
          .setDescription('Remove coins from a user (moderator only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to remove coins from')
              .setRequired(true))
          .addIntegerOption(option =>
            option.setName('amount')
              .setDescription('Amount of coins to remove')
              .setRequired(true)
              .setMinValue(1)),
        
        new SlashCommandBuilder()
          .setName('casinoreset')
          .setDescription('Reset user casino stats (moderator only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to reset')
              .setRequired(true))
      ].map(command => command.toJSON());

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

      console.log('🔄 Registering slash commands...');

      const clientId = this.client.user.id;
      const guildId = process.env.GUILD_ID;
      
      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        console.log(`✅ Successfully registered ${commands.length} slash commands for guild ${guildId}`);
      } else {
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands }
        );
        console.log(`✅ Successfully registered ${commands.length} global slash commands`);
      }
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  }

  async handleSlashCommand(interaction) {
    const command = interaction.commandName;
    const CASINO_CHANNEL_ID = '1406780875911336007';

    // Commands that need async work - defer immediately to prevent timeout
    const asyncCommands = ['balance', 'daily', 'casinostats', 'coinflip', 'dice', 'double', 'roulette', 'blackjack', 'hit', 'stand', 
                           'stats', 'user', 'trade', 'mm', 'blacklist', 'report', 'verify', 'unverify', 'serverstats', 'cleanup', 
                           'casinoadd', 'casinoremove', 'casinoreset'];
    const needsDefer = asyncCommands.includes(command);
    
    // Commands that should be ephemeral (only visible to user)
    const ephemeralCommands = ['stats', 'user', 'trade', 'mm', 'blacklist', 'report', 'verify', 'unverify', 'serverstats', 'cleanup', 
                                'casinoadd', 'casinoremove', 'casinoreset'];
    const isEphemeral = ephemeralCommands.includes(command);
    
    if (needsDefer) {
      await interaction.deferReply({ ephemeral: isEphemeral });
    }

    // Casino commands channel check (after defer to prevent timeout)
    const casinoCommands = ['balance', 'daily', 'casinostats', 'coinflip', 'dice', 'double', 'roulette', 'blackjack', 'hit', 'stand'];
    if (casinoCommands.includes(command)) {
      if (interaction.channel.id !== CASINO_CHANNEL_ID) {
        const snarkyResponses = [
          `What the fuck? Casino commands only work in <#${CASINO_CHANNEL_ID}>, you absolute buffoon.`,
          `Nah, you can't use casino commands here. Go to <#${CASINO_CHANNEL_ID}>, you moron.`,
          `Wrong channel, dumbass. Casino commands are only in <#${CASINO_CHANNEL_ID}>.`,
          `Are you fucking stupid? Use <#${CASINO_CHANNEL_ID}> for casino commands.`,
          `Read the fucking rules. Casino commands = <#${CASINO_CHANNEL_ID}> only, you absolute idiot.`,
          `What part of '<#${CASINO_CHANNEL_ID}> only' don't you understand? Get the fuck out of here.`,
          `Wrong place, wrong time. <#${CASINO_CHANNEL_ID}> only, you absolute moron.`,
          `Can you read? Casino commands go in <#${CASINO_CHANNEL_ID}>, not here, you fucking idiot.`
        ];
        const snarky = snarkyResponses[Math.floor(Math.random() * snarkyResponses.length)];
        if (needsDefer) {
          return await interaction.editReply({ content: `❌ ${snarky}` });
        } else {
          return await interaction.reply({ content: `❌ ${snarky}`, ephemeral: true });
        }
      }
    }

    try {
      switch (command) {
        case 'help':
          await this.handleSlashHelp(interaction);
          break;
        case 'ping':
          await interaction.reply({ content: `🏓 Pong! Fuck you, I'm alive. Latency: ${this.client.ws.ping}ms`, ephemeral: true });
          break;
        case 'stats':
          await this.handleSlashStats(interaction);
          break;
        case 'user':
          await this.handleSlashUserLookup(interaction);
          break;
        case 'trade':
          await this.handleSlashTradeLookup(interaction);
          break;
        case 'balance':
          await this.handleSlashBalance(interaction);
          break;
        case 'daily':
          await this.handleSlashDaily(interaction);
          break;
        case 'casinostats':
          await this.handleSlashCasinoStats(interaction);
          break;
        case 'coinflip':
          await this.handleSlashCoinflip(interaction);
          break;
        case 'dice':
          await this.handleSlashDice(interaction);
          break;
        case 'double':
          await this.handleSlashDouble(interaction);
          break;
        case 'roulette':
          await this.handleSlashRoulette(interaction);
          break;
        case 'blackjack':
          await this.handleSlashBlackjack(interaction);
          break;
        case 'hit':
          await this.handleSlashBlackjackHit(interaction);
          break;
        case 'stand':
          await this.handleSlashBlackjackStand(interaction);
          break;
        case 'mm':
          await this.handleSlashMM(interaction);
          break;
        case 'blacklist':
          await this.handleSlashBlacklist(interaction);
          break;
        case 'report':
          await this.handleSlashReport(interaction);
          break;
        case 'verify':
          await this.handleSlashVerify(interaction);
          break;
        case 'unverify':
          await this.handleSlashUnverify(interaction);
          break;
        case 'serverstats':
          await this.handleSlashServerStats(interaction);
          break;
        case 'cleanup':
          await this.handleSlashCleanup(interaction);
          break;
        case 'casinoadd':
          await this.handleSlashCasinoAdd(interaction);
          break;
        case 'casinoremove':
          await this.handleSlashCasinoRemove(interaction);
          break;
        case 'casinoreset':
          await this.handleSlashCasinoReset(interaction);
          break;
        default:
          await interaction.reply({ content: `❌ Unknown command. What the fuck are you trying to do?`, ephemeral: true });
      }
    } catch (error) {
      console.error('Slash command error:', error);
      const snarky = getSnarkyResponse('error');
      await interaction.reply({ content: `❌ ${snarky} Error: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  }

  async setupPendingThreadTimers() {
    try {
      const pendingRequests = await dbHelpers.all(
        `SELECT * FROM middleman 
         WHERE status = 'pending' 
         AND threadId IS NOT NULL 
         AND (user1Accepted = 0 OR user2Accepted = 0)
         AND datetime(createdAt, '+5 minutes') > datetime('now')`
      );

      console.log(`⏰ Setting up timers for ${pendingRequests.length} pending acceptance threads`);

      for (const request of pendingRequests) {
        const createdAt = new Date(request.createdAt);
        const now = new Date();
        const minutesSinceCreation = (now - createdAt) / (1000 * 60);
        const timeRemaining = Math.max(0, (5 - minutesSinceCreation) * 60 * 1000);

        if (timeRemaining > 0) {
          setTimeout(async () => {
            const finalCheck = await dbHelpers.get(
              'SELECT * FROM middleman WHERE id = ?',
              [request.id]
            );

            if (finalCheck && !(finalCheck.user1Accepted === 1 && finalCheck.user2Accepted === 1)) {
              try {
                const thread = await this.client.channels.fetch(finalCheck.threadId);
                if (thread) {
                  await thread.send('⏰ **Time expired or not all parties accepted.**\n\nThis thread will be deleted in 10 seconds.');
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  await thread.delete();
                  console.log(`🗑️ Deleted thread for request #${request.id} (timeout/no acceptance)`);
                  
                  await dbHelpers.run(
                    'UPDATE middleman SET status = ? WHERE id = ?',
                    ['declined', request.id]
                  );
                }
              } catch (deleteError) {
                console.error('Error deleting thread:', deleteError.message);
              }
            }
          }, timeRemaining);
        }
      }
    } catch (error) {
      console.error('Error setting up pending thread timers:', error);
    }
  }

  async handleAcceptanceReaction(reaction, user) {
    try {
      const message = reaction.message;
      const thread = message.channel;
      
      if (!message.embeds || message.embeds.length === 0) return;
      const embed = message.embeds[0];
      if (!embed.title || !embed.title.includes('Trade Agreement')) return;

      const requestIdMatch = embed.footer?.text?.match(/Request ID: (\d+)/) || 
                            thread.name.match(/MM-(\d+)/);
      if (!requestIdMatch) return;

      const requestId = parseInt(requestIdMatch[1]);
      const request = await dbHelpers.get(
        'SELECT * FROM middleman WHERE id = ?',
        [requestId]
      );

      if (!request) return;

      const user1Id = request.user1 ? String(request.user1).replace(/[<@!>]/g, '') : '';
      const user2Id = request.user2 ? String(request.user2).replace(/[<@!>]/g, '') : '';

      if (user.id !== user1Id && user.id !== user2Id) return;

      console.log(`✅ User ${user.tag} (${user.id}) accepted trade #${requestId}`);

      if (user.id === user1Id) {
        await dbHelpers.run(
          'UPDATE middleman SET user1Accepted = 1 WHERE id = ?',
          [requestId]
        );
      } else if (user.id === user2Id) {
        await dbHelpers.run(
          'UPDATE middleman SET user2Accepted = 1 WHERE id = ?',
          [requestId]
        );
      }

      const updatedRequest = await dbHelpers.get(
        'SELECT * FROM middleman WHERE id = ?',
        [requestId]
      );

      if (updatedRequest && updatedRequest.user1Accepted === 1 && updatedRequest.user2Accepted === 1) {
        const roleMention = process.env.MIDDLEMAN_ROLE_ID ? `<@&${process.env.MIDDLEMAN_ROLE_ID}>` : '';
        await thread.send({
          content: `🎉 **Both parties have accepted the trade!**\n\n${roleMention} A middleman is needed for this trade.\n\n**Trade Details:**\n${request.item}\n\n**Participants:**\n- <@${user1Id}>\n- <@${user2Id}>`
        });
        console.log(`✅ Both parties accepted trade #${requestId}, middleman pinged`);

      } else {
        const createdAt = new Date(request.createdAt);
        const now = new Date();
        const minutesSinceCreation = (now - createdAt) / (1000 * 60);

        if (minutesSinceCreation < 5) {
          const timeRemaining = (5 - minutesSinceCreation) * 60 * 1000;
          setTimeout(async () => {
            const finalCheck = await dbHelpers.get(
              'SELECT * FROM middleman WHERE id = ?',
              [requestId]
            );

            if (finalCheck && !(finalCheck.user1Accepted === 1 && finalCheck.user2Accepted === 1)) {
              try {
                await thread.send('⏰ **Time expired or not all parties accepted.**\n\nThis thread will be deleted in 10 seconds.');
                await new Promise(resolve => setTimeout(resolve, 10000));
                await thread.delete();
                console.log(`🗑️ Deleted thread for request #${requestId} (timeout/no acceptance)`);
                
                await dbHelpers.run(
                  'UPDATE middleman SET status = ? WHERE id = ?',
                  ['declined', requestId]
                );
              } catch (deleteError) {
                console.error('Error deleting thread:', deleteError.message);
              }
            }
          }, timeRemaining);
        }
      }
    } catch (error) {
      console.error('Error handling acceptance reaction:', error);
    }
  }

  setupCommands() {
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      
      if (message.channel.isThread()) {
        await this.handleBridgeThreadMessage(message);
      }
      
      // Check for command prefix
      if (!message.content.startsWith('!')) return;

      const args = message.content.slice(1).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

      // Public commands (no permission needed)
      if (command === 'help' || command === 'commands') {
        await this.handleHelp(message);
        return;
      }

      if (command === 'ping') {
        await message.reply(`🏓 Pong! Fuck you, I'm alive. Latency: ${this.client.ws.ping}ms`);
        return;
      }

      if (command === 'stats' || command === 'statistics') {
        await this.handleStats(message);
        return;
      }

      if (command === 'user' || command === 'lookup') {
        await this.handleUserLookup(message, args);
        return;
      }

      if (command === 'trade') {
        await this.handleTradeLookup(message, args);
        return;
      }

      // Casino commands (public) - Channel restricted
      const CASINO_CHANNEL_ID = '1406780875911336007';
      const isCasinoChannel = message.channel.id === CASINO_CHANNEL_ID;
      
      const casinoCommands = ['balance', 'bal', 'daily', 'casino', 'casinostats', 'coinflip', 'cf', 'dice', 'double', 'd', 'roulette', 'r', 'blackjack', 'bj', 'hit', 'stand'];
      
      if (casinoCommands.includes(command)) {
        if (!isCasinoChannel) {
          const snarkyResponses = [
            `What the fuck? Casino commands only work in <#${CASINO_CHANNEL_ID}>, you absolute buffoon.`,
            `Nah, you can't use casino commands here. Go to <#${CASINO_CHANNEL_ID}>, you moron.`,
            `Wrong channel, dumbass. Casino commands are only in <#${CASINO_CHANNEL_ID}>.`,
            `Are you fucking stupid? Use <#${CASINO_CHANNEL_ID}> for casino commands.`,
            `Read the fucking rules. Casino commands = <#${CASINO_CHANNEL_ID}> only, you absolute idiot.`,
            `What part of '<#${CASINO_CHANNEL_ID}> only' don't you understand? Get the fuck out of here.`,
            `Wrong place, wrong time. <#${CASINO_CHANNEL_ID}> only, you absolute moron.`,
            `Can you read? Casino commands go in <#${CASINO_CHANNEL_ID}>, not here, you fucking idiot.`
          ];
          const snarky = snarkyResponses[Math.floor(Math.random() * snarkyResponses.length)];
          return message.reply(`❌ ${snarky}`);
        }
      }

      if (command === 'balance' || command === 'bal') {
        await this.handleBalance(message);
        return;
      }

      if (command === 'daily') {
        await this.handleDaily(message);
        return;
      }

      if (command === 'casino' || command === 'casinostats') {
        await this.handleCasinoStats(message, args);
        return;
      }

      if (command === 'coinflip' || command === 'cf') {
        await this.handleCoinflip(message, args);
        return;
      }

      if (command === 'dice') {
        await this.handleDice(message, args);
        return;
      }

      if (command === 'double' || command === 'd') {
        await this.handleDouble(message, args);
        return;
      }

      if (command === 'roulette' || command === 'r') {
        await this.handleRoulette(message, args);
        return;
      }

      if (command === 'blackjack' || command === 'bj') {
        await this.handleBlackjack(message, args);
        return;
      }

      if (command === 'hit') {
        await this.handleBlackjackHit(message);
        return;
      }

      if (command === 'stand') {
        await this.handleBlackjackStand(message);
        return;
      }

      // Moderator-only commands
      const hasModeratorRole = message.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
      if (!hasModeratorRole) {
        const snarky = getSnarkyResponse('noPermission');
        return message.reply(`❌ ${snarky}`);
      }

      try {
        switch (command) {
          case 'mm':
            const subCommand = args.shift()?.toLowerCase();
            switch (subCommand) {
              case 'accept':
                await this.handleAccept(message, args);
                break;
              case 'decline':
                await this.handleDecline(message, args);
                break;
              case 'complete':
                await this.handleComplete(message, args);
                break;
              case 'list':
                await this.handleList(message, args);
                break;
              case 'ticket':
                await this.handleTicket(message, args);
                break;
              default:
                await this.handleMMHelp(message);
            }
            break;
          case 'blacklist':
            const blacklistCmd = args.shift()?.toLowerCase();
            switch (blacklistCmd) {
              case 'add':
                await this.handleBlacklistAdd(message, args);
                break;
              case 'remove':
                await this.handleBlacklistRemove(message, args);
                break;
              case 'list':
                await this.handleBlacklistList(message);
                break;
              case 'check':
                await this.handleBlacklistCheck(message, args);
                break;
              default:
                await message.reply(`❌ Invalid blacklist command. Use \`!blacklist add/remove/list/check\`. Fuck's sake, read the help.`);
            }
            break;
          case 'report':
            const reportCmd = args.shift()?.toLowerCase();
            switch (reportCmd) {
              case 'list':
                await this.handleReportList(message, args);
                break;
              case 'view':
                await this.handleReportView(message, args);
                break;
              default:
                await message.reply(`❌ Invalid report command. Use \`!report list/view <id>\`. Jesus Christ.`);
            }
            break;
          case 'verify':
            await this.handleVerify(message, args);
            break;
          case 'unverify':
            await this.handleUnverify(message, args);
            break;
          case 'serverstats':
          case 'server':
            await this.handleServerStats(message);
            break;
          case 'cleanup':
            await this.handleCleanup(message);
            break;
          case 'casinoadd':
            await this.handleCasinoAdd(message, args);
            break;
          case 'casinoremove':
            await this.handleCasinoRemove(message, args);
            break;
          case 'casinoreset':
            await this.handleCasinoReset(message, args);
            break;
          default:
            await message.reply(`❌ Unknown command. Use \`!help\` to see all commands, you absolute buffoon.`);
        }
      } catch (error) {
        console.error('Command error:', error);
        const snarky = getSnarkyResponse('error');
        await message.reply(`❌ ${snarky} Error: ${error.message}`);
      }
    });
  }

  async handleHelp(message) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 ZRX Market Bot - Commands')
      .setColor(0x5865F2)
      .setDescription('Here are all the fucking commands. Use them wisely.')
      .addFields(
        {
          name: '🌐 Public Commands',
          value: [
            '`!help` - Show this help (obviously)',
            '`!ping` - Check if I\'m alive (spoiler: I am)',
            '`!stats` - Show market statistics',
            '`!user <discordId>` - Look up a user',
            '`!trade <id>` - View trade details'
          ].join('\n'),
          inline: false
        },
        {
          name: '🎰 Casino Commands',
          value: [
            '`!balance` - Check your coin balance',
            '`!daily` - Claim daily reward (500-1000 coins)',
            '`!casinostats [user]` - View casino statistics',
            '`!coinflip <bet> <heads/tails>` - Flip a coin',
            '`!dice <bet> <1-6>` - Roll dice (5x multiplier)',
            '`!double <bet>` - Double or nothing',
            '`!roulette <bet> <red/black/green/number>` - Play roulette',
            '`!blackjack <bet>` - Start blackjack game',
            '`!hit` - Draw card in blackjack',
            '`!stand` - End turn in blackjack'
          ].join('\n'),
          inline: false
        },
        {
          name: '👮 Moderator Commands',
          value: [
            '`!mm accept <id>` - Accept middleman request',
            '`!mm decline <id>` - Decline middleman request',
            '`!mm complete <id>` - Mark request as completed',
            '`!mm list [status]` - List requests',
            '`!blacklist add <id> <reason>` - Blacklist a user',
            '`!blacklist remove <id>` - Remove from blacklist',
            '`!blacklist list` - List blacklisted users',
            '`!blacklist check <id>` - Check if user is blacklisted',
            '`!report list [status]` - List reports',
            '`!report view <id>` - View report details',
            '`!verify <id>` - Verify a user',
            '`!unverify <id>` - Unverify a user',
            '`!serverstats` - Show server statistics',
            '`!cleanup` - Clean up old trades',
            '`!casinoadd <user> <amount>` - Add coins to user',
            '`!casinoremove <user> <amount>` - Remove coins from user',
            '`!casinoreset <user>` - Reset user casino stats'
          ].join('\n'),
          inline: false
        },
        {
          name: '💡 Examples',
          value: [
            '`!mm accept 5` - Accept request #5',
            '`!user 123456789` - Look up user',
            '`!blacklist add 123456789 Scammer` - Blacklist user',
            '`!stats` - Show market stats'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'ZRX Market Bot - Made with attitude' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  async handleMMHelp(message) {
    const embed = new EmbedBuilder()
      .setTitle('📋 Middleman Commands')
      .setColor(0x5865F2)
      .setDescription('Middleman commands. Use them right or don\'t use them at all.')
      .addFields(
        {
          name: 'Commands',
          value: [
            '`!mm accept <id>` - Accept a pending middleman request',
            '`!mm decline <id>` - Decline a pending middleman request',
            '`!mm complete <id>` - Mark a request as completed',
            '`!mm list [status]` - List requests (pending/accepted/declined/completed)',
            '`!mm ticket <id>` - Create a ticket channel (not implemented)'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'ZRX Market Bot' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  async handleStats(message) {
    try {
      const totalTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE status = ?', ['active']);
      const totalUsers = await dbHelpers.get('SELECT COUNT(*) as count FROM users');
      const pendingMM = await dbHelpers.get('SELECT COUNT(*) as count FROM middleman WHERE status = ?', ['pending']);
      const totalReports = await dbHelpers.get('SELECT COUNT(*) as count FROM reports WHERE status = ?', ['pending']);
      const completedTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE status = ?', ['completed']);

      const embed = new EmbedBuilder()
        .setTitle('📊 Market Statistics')
        .setColor(0x00D166)
        .setDescription('Here are the fucking stats. Impressive, right?')
        .addFields(
          { name: '🛒 Active Trades', value: `${totalTrades?.count || 0}`, inline: true },
          { name: '✅ Completed Trades', value: `${completedTrades?.count || 0}`, inline: true },
          { name: '👥 Total Users', value: `${totalUsers?.count || 0}`, inline: true },
          { name: '🤝 Pending Middleman', value: `${pendingMM?.count || 0}`, inline: true },
          { name: '🚨 Pending Reports', value: `${totalReports?.count || 0}`, inline: true },
          { name: '🤖 Bot Uptime', value: this.formatUptime(process.uptime()), inline: true }
        )
        .setFooter({ text: 'ZRX Market Bot' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleUserLookup(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID, you moron. `!user <discordId>`');
    }

    try {
      const userId = args[0].replace(/[<@!>]/g, '');
      const user = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [userId]);
      
      if (!user) {
        return message.reply(`❌ ${getSnarkyResponse('notFound')} User not found in database.`);
      }

      const userTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE creatorId = ?', [userId]);
      const userMM = await dbHelpers.get('SELECT COUNT(*) as count FROM middleman WHERE requesterId = ?', [userId]);
      const userReports = await dbHelpers.get('SELECT COUNT(*) as count FROM reports WHERE reporterId = ? OR accusedDiscordId = ?', [userId, userId]);
      
      const isBlacklisted = await dbHelpers.get('SELECT * FROM blacklist WHERE discordId = ?', [userId]);

      const embed = new EmbedBuilder()
        .setTitle(`👤 User Lookup: ${user.username}`)
        .setColor(user.verified ? 0x00D166 : 0xFFA500)
        .setThumbnail(user.avatar || null)
        .addFields(
          { name: '🆔 Discord ID', value: user.discordId, inline: true },
          { name: '✅ Verified', value: user.verified ? 'Yes' : 'No', inline: true },
          { name: '🚫 Blacklisted', value: isBlacklisted ? `Yes - ${isBlacklisted.reason}` : 'No', inline: true },
          { name: '🛒 Trades Created', value: `${userTrades?.count || 0}`, inline: true },
          { name: '🤝 Middleman Requests', value: `${userMM?.count || 0}`, inline: true },
          { name: '🚨 Reports', value: `${userReports?.count || 0}`, inline: true },
          { name: '📅 Joined', value: new Date(user.createdAt).toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `User ID: ${userId}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleTradeLookup(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a trade ID, dumbass. `!trade <id>`');
    }

    try {
      const tradeId = parseInt(args[0]);
      const trade = await dbHelpers.get(
        `SELECT t.*, u.username, u.avatar 
         FROM trades t 
         JOIN users u ON t.creatorId = u.discordId 
         WHERE t.id = ?`,
        [tradeId]
      );

      if (!trade) {
        return message.reply(`❌ ${getSnarkyResponse('notFound')} Trade #${tradeId} not found.`);
      }

      const offered = trade.offered ? JSON.parse(trade.offered) : [];
      const wanted = trade.wanted ? JSON.parse(trade.wanted) : [];

      const embed = new EmbedBuilder()
        .setTitle(`🛒 Trade #${trade.id}`)
        .setColor(0x5865F2)
        .setDescription(`**Status:** ${trade.status.toUpperCase()}`)
        .addFields(
          { name: '👤 Creator', value: `<@${trade.creatorId}> (${trade.username})`, inline: true },
          { name: '📅 Created', value: new Date(trade.createdAt).toLocaleDateString(), inline: true },
          { name: '🎮 Category', value: trade.isCrossTrade ? 'Cross-Trade' : 'Same Game', inline: true },
          { 
            name: '📤 Offered', 
            value: offered.length > 0 
              ? offered.map(item => `${item.name}${item.mutation ? ` (${item.mutation})` : ''}${item.value ? ` - ${item.value}` : ''}`).join('\n').substring(0, 1024)
              : 'None',
            inline: false 
          },
          { 
            name: '📥 Wanted', 
            value: wanted.length > 0 
              ? wanted.map(item => `${item.name}${item.mutation ? ` (${item.mutation})` : ''}${item.value ? ` - ${item.value}` : ''}`).join('\n').substring(0, 1024)
              : 'None',
            inline: false 
          }
        )
        .setFooter({ text: `Trade ID: ${trade.id}` })
        .setTimestamp(new Date(trade.createdAt));

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlacklistAdd(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID and reason, you absolute buffoon. `!blacklist add <id> <reason>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      const existing = await dbHelpers.get('SELECT * FROM blacklist WHERE discordId = ?', [userId]);
      if (existing) {
        return message.reply(`❌ User is already blacklisted, you moron. Reason: ${existing.reason}`);
      }

      await dbHelpers.run(
        'INSERT INTO blacklist (discordId, reason) VALUES (?, ?)',
        [userId, reason]
      );

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'blacklist_add', userId, reason]
      );

      await message.reply(`✅ ${getSnarkyResponse('success')} User <@${userId}> has been blacklisted. Reason: ${reason}`);
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlacklistRemove(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID, you idiot. `!blacklist remove <id>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');

    try {
      const existing = await dbHelpers.get('SELECT * FROM blacklist WHERE discordId = ?', [userId]);
      if (!existing) {
        return message.reply(`❌ ${getSnarkyResponse('notFound')} User is not blacklisted.`);
      }

      await dbHelpers.run('DELETE FROM blacklist WHERE discordId = ?', [userId]);

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'blacklist_remove', userId, '']
      );

      await message.reply(`✅ ${getSnarkyResponse('success')} User <@${userId}> has been removed from blacklist.`);
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlacklistList(message) {
    try {
      const blacklisted = await dbHelpers.all('SELECT * FROM blacklist ORDER BY createdAt DESC LIMIT 20');

      if (blacklisted.length === 0) {
        return message.reply('✅ No one is blacklisted. Good job, I guess.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🚫 Blacklisted Users')
        .setColor(0xFF0000)
        .setDescription(blacklisted.map(b => `<@${b.discordId}> - ${b.reason}`).join('\n').substring(0, 2000))
        .setFooter({ text: `Total: ${blacklisted.length}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlacklistCheck(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID, you moron. `!blacklist check <id>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');

    try {
      const blacklisted = await dbHelpers.get('SELECT * FROM blacklist WHERE discordId = ?', [userId]);
      
      if (blacklisted) {
        await message.reply(`🚫 **User is blacklisted.**\n\n**Reason:** ${blacklisted.reason}\n**Date:** ${new Date(blacklisted.createdAt).toLocaleDateString()}`);
      } else {
        await message.reply('✅ User is not blacklisted. They\'re clean... for now.');
      }
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleReportList(message, args) {
    const status = args[0] || 'pending';

    try {
      const reports = await dbHelpers.all(
        'SELECT * FROM reports WHERE status = ? ORDER BY createdAt DESC LIMIT 10',
        [status]
      );

      if (reports.length === 0) {
        return message.reply(`No ${status} reports found. Lucky you.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🚨 ${status.toUpperCase()} Reports`)
        .setColor(0xFF0000)
        .setDescription(
          reports.map(r => `#${r.id} - <@${r.accusedDiscordId}> (Reporter: <@${r.reporterId}>)`).join('\n')
        )
        .setFooter({ text: `Showing ${reports.length} reports` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleReportView(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a report ID, you absolute moron. `!report view <id>`');
    }

    const reportId = parseInt(args[0]);

    try {
      const report = await dbHelpers.get('SELECT * FROM reports WHERE id = ?', [reportId]);

      if (!report) {
        return message.reply(`❌ ${getSnarkyResponse('notFound')} Report #${reportId} not found.`);
      }

      const reporter = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [report.reporterId]);
      const accused = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [report.accusedDiscordId]);
      const evidenceLinks = report.evidenceLinks ? JSON.parse(report.evidenceLinks) : [];

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Report #${report.id}`)
        .setColor(0xFF0000)
        .addFields(
          { name: 'Reporter', value: `<@${report.reporterId}> (${reporter?.username || 'Unknown'})`, inline: true },
          { name: 'Accused', value: `<@${report.accusedDiscordId}> (${accused?.username || 'Unknown'})`, inline: true },
          { name: 'Status', value: report.status.toUpperCase(), inline: true },
          { name: 'Details', value: report.details.substring(0, 1000), inline: false }
        )
        .setFooter({ text: `Report ID: ${report.id}` })
        .setTimestamp(new Date(report.createdAt));

      if (evidenceLinks.length > 0) {
        embed.addFields({ name: 'Evidence', value: evidenceLinks.join('\n'), inline: false });
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleVerify(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID, you moron. `!verify <id>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');

    try {
      await dbHelpers.run('UPDATE users SET verified = 1 WHERE discordId = ?', [userId]);

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'verify_user', userId, '']
      );

      await message.reply(`✅ ${getSnarkyResponse('success')} User <@${userId}> has been verified.`);
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleUnverify(message, args) {
    if (!args[0]) {
      return message.reply('❌ Provide a Discord ID, you moron. `!unverify <id>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');

    try {
      await dbHelpers.run('UPDATE users SET verified = 0 WHERE discordId = ?', [userId]);

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'unverify_user', userId, '']
      );

      await message.reply(`✅ ${getSnarkyResponse('success')} User <@${userId}> has been unverified.`);
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleServerStats(message) {
    try {
      const guild = message.guild;
      if (!guild) {
        return message.reply('❌ This command only works in a server, you absolute buffoon.');
      }

      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
      const totalChannels = guild.channels.cache.size;
      const totalRoles = guild.roles.cache.size;

      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Statistics: ${guild.name}`)
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👥 Total Members', value: `${totalMembers}`, inline: true },
          { name: '🟢 Online Members', value: `${onlineMembers}`, inline: true },
          { name: '📺 Channels', value: `${totalChannels}`, inline: true },
          { name: '🎭 Roles', value: `${totalRoles}`, inline: true },
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '📅 Created', value: guild.createdAt.toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `Server ID: ${guild.id}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleCleanup(message) {
    try {
      // Delete trades older than 5 hours
      const result = await dbHelpers.run(
        `UPDATE trades SET status = 'expired' 
         WHERE status = 'active' 
         AND datetime(createdAt, '+5 hours') < datetime('now')`
      );

      await message.reply(`✅ ${getSnarkyResponse('success')} Cleanup completed. ${result.changes || 0} trades expired.`);
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  // ... (keeping all the existing methods like handleAccept, handleDecline, etc. - they're already good)
  async setupAcceptanceCollector(data) {
    try {
      const { requestId, threadId, messageId, user1Id, user2Id, request } = data;
      console.log(`🔧 Setting up acceptance collector for request #${requestId}`);

      const thread = await this.client.channels.fetch(threadId);
      const message = await thread.messages.fetch(messageId);

      const filter = (reaction, user) => {
        const userId = user.id;
        return (userId === user1Id || userId === user2Id) && reaction.emoji.name === '✅' && !user.bot;
      };

      const collector = message.createReactionCollector({
        filter,
        time: 5 * 60 * 1000,
        max: 2
      });

      this.activeCollectors.set(requestId, collector);

      collector.on('collect', async (reaction, user) => {
        const userId = user.id;
        console.log(`✅ User ${user.tag} (${userId}) accepted trade #${requestId}`);

        if (userId === user1Id) {
          await dbHelpers.run(
            'UPDATE middleman SET user1Accepted = 1 WHERE id = ?',
            [requestId]
          );
        } else if (userId === user2Id) {
          await dbHelpers.run(
            'UPDATE middleman SET user2Accepted = 1 WHERE id = ?',
            [requestId]
          );
        }

        const updatedRequest = await dbHelpers.get(
          'SELECT * FROM middleman WHERE id = ?',
          [requestId]
        );

        if (updatedRequest && updatedRequest.user1Accepted === 1 && updatedRequest.user2Accepted === 1) {
          collector.stop('both_accepted');
        }
      });

      collector.on('end', async (collected, reason) => {
        this.activeCollectors.delete(requestId);

        const finalRequest = await dbHelpers.get(
          'SELECT * FROM middleman WHERE id = ?',
          [requestId]
        );

        if (reason === 'both_accepted' || (finalRequest && finalRequest.user1Accepted === 1 && finalRequest.user2Accepted === 1)) {
          const roleMention = process.env.MIDDLEMAN_ROLE_ID ? `<@&${process.env.MIDDLEMAN_ROLE_ID}>` : '';
          await thread.send({
            content: `🎉 **Both parties have accepted the trade!**\n\n${roleMention} A middleman is needed for this trade.\n\n**Trade Details:**\n${request.item}\n\n**Participants:**\n- <@${user1Id}>\n- <@${user2Id}>`
          });
          console.log(`✅ Both parties accepted trade #${requestId}, middleman pinged`);
        } else {
          try {
            await thread.send('⏰ **Time expired or not all parties accepted.**\n\nThis thread will be deleted in 10 seconds.');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await thread.delete();
            console.log(`🗑️ Deleted thread for request #${requestId} (timeout/no acceptance)`);
            
            await dbHelpers.run(
              'UPDATE middleman SET status = ? WHERE id = ?',
              ['declined', requestId]
            );
          } catch (deleteError) {
            console.error('Error deleting thread:', deleteError.message);
          }
        }
      });

      console.log(`✅ Acceptance collector set up for request #${requestId}`);
    } catch (error) {
      console.error('Error setting up acceptance collector:', error);
    }
  }

  async createAcceptanceThread(request) {
    try {
      console.log('📨 Creating acceptance thread for request:', request.id);
      
      const middlemanChannel = this.client.channels.cache.get(process.env.MIDDLEMAN_CHANNEL_ID);
      if (!middlemanChannel) {
        console.error('❌ Middleman channel not found');
        return;
      }

      const user1Id = request.user1 ? String(request.user1).replace(/[<@!>]/g, '') : '';
      const user2Id = request.user2 ? String(request.user2).replace(/[<@!>]/g, '') : '';

      if (!user1Id || !user2Id) {
        console.error('❌ Invalid user IDs in request');
        return;
      }

      const requester = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [request.requesterId]
      );

      const proofLinks = request.proofLinks ? JSON.parse(request.proofLinks) : [];

      const initialMessage = await middlemanChannel.send({
        content: `🔒 **Trade Agreement Required**\n\n<@${user1Id}> and <@${user2Id}> must both accept this trade within 5 minutes.\n\nIf both parties don't accept, this thread will be automatically deleted.`
      });

      const threadName = `MM-${request.id} | ${request.item?.substring(0, 50) || 'Trade'}`;
      const thread = await initialMessage.startThread({
        name: threadName,
        type: 12,
        autoArchiveDuration: 60,
        reason: `Middleman request #${request.id} - awaiting acceptance`
      });

      console.log(`✅ Created acceptance thread: ${thread.name} (${thread.id})`);

      await dbHelpers.run(
        'UPDATE middleman SET threadId = ? WHERE id = ?',
        [thread.id, request.id]
      );

      const usersToAdd = [request.requesterId, user1Id, user2Id];
      const uniqueUsers = [...new Set(usersToAdd.filter(id => id && id.length > 0))];
      
      const axios = require('axios').default;
      for (const userId of uniqueUsers) {
        try {
          await axios.put(
            `https://discord.com/api/v10/channels/${thread.id}/thread-members/${userId}`,
            {},
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (error) {
          console.log(`⚠️ Could not add user ${userId} to thread (they can join manually)`);
        }
      }

      const tradeEmbed = new EmbedBuilder()
        .setTitle(`📋 Trade Agreement - Request #${request.id}`)
        .setColor(0xFFA500)
        .setDescription('**Both parties must accept this trade by reacting with ✅**\n\nYou have 5 minutes to both accept, or this thread will be deleted.')
        .addFields(
          { name: '👤 Requester', value: `<@${request.requesterId}>`, inline: true },
          { name: '👥 User 1', value: `<@${user1Id}>`, inline: true },
          { name: '👥 User 2', value: `<@${user2Id}>`, inline: true },
          { name: '🛒 Item/Details', value: request.item || 'N/A', inline: false },
          { name: '💰 Value', value: request.value || 'N/A', inline: true },
          { name: '🎮 Roblox Username', value: request.robloxUsername || 'N/A', inline: true }
        )
        .setFooter({ text: `Request ID: ${request.id} | React with ✅ to accept` })
        .setTimestamp();

      if (proofLinks.length > 0) {
        tradeEmbed.addFields({ 
          name: '📎 Proof Links', 
          value: proofLinks.map(link => `[Link](${link})`).join('\n'), 
          inline: false 
        });
      }

      const acceptMessage = await thread.send({
        content: `<@${user1Id}> <@${user2Id}>\n\n**Please react with ✅ to accept this trade.**\n\n⏰ You have 5 minutes. If both parties don't accept, this thread will be deleted.`,
        embeds: [tradeEmbed]
      });

      await acceptMessage.react('✅');

      const filter = (reaction, user) => {
        const userId = user.id;
        return (userId === user1Id || userId === user2Id) && reaction.emoji.name === '✅' && !user.bot;
      };

      const collector = acceptMessage.createReactionCollector({
        filter,
        time: 5 * 60 * 1000,
        max: 2
      });

      this.activeCollectors.set(request.id, collector);

      collector.on('collect', async (reaction, user) => {
        const userId = user.id;
        console.log(`✅ User ${user.tag} (${userId}) accepted trade #${request.id}`);

        if (userId === user1Id) {
          await dbHelpers.run(
            'UPDATE middleman SET user1Accepted = 1 WHERE id = ?',
            [request.id]
          );
        } else if (userId === user2Id) {
          await dbHelpers.run(
            'UPDATE middleman SET user2Accepted = 1 WHERE id = ?',
            [request.id]
          );
        }

        const updatedRequest = await dbHelpers.get(
          'SELECT * FROM middleman WHERE id = ?',
          [request.id]
        );

        if (updatedRequest.user1Accepted === 1 && updatedRequest.user2Accepted === 1) {
          collector.stop('both_accepted');
        }
      });

      collector.on('end', async (collected, reason) => {
        this.activeCollectors.delete(request.id);

        const finalRequest = await dbHelpers.get(
          'SELECT * FROM middleman WHERE id = ?',
          [request.id]
        );

        if (reason === 'both_accepted' || (finalRequest && finalRequest.user1Accepted === 1 && finalRequest.user2Accepted === 1)) {
          const roleMention = process.env.MIDDLEMAN_ROLE_ID ? `<@&${process.env.MIDDLEMAN_ROLE_ID}>` : '';
          await thread.send({
            content: `🎉 **Both parties have accepted the trade!**\n\n${roleMention} A middleman is needed for this trade.\n\n**Trade Details:**\n${request.item}\n\n**Participants:**\n- <@${user1Id}>\n- <@${user2Id}>`
          });
          console.log(`✅ Both parties accepted trade #${request.id}, middleman pinged`);
        } else {
          try {
            await thread.send('⏰ **Time expired or not all parties accepted.**\n\nThis thread will be deleted in 10 seconds.');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await thread.delete();
            console.log(`🗑️ Deleted thread for request #${request.id} (timeout/no acceptance)`);
            
            await dbHelpers.run(
              'UPDATE middleman SET status = ? WHERE id = ?',
              ['declined', request.id]
            );
          } catch (deleteError) {
            console.error('Error deleting thread:', deleteError.message);
          }
        }
      });

    } catch (error) {
      console.error('Error creating acceptance thread:', error);
    }
  }

  async postMiddlemanRequest(request) {
    try {
      console.log('📨 postMiddlemanRequest called for request:', request.id);
      
      let channel = this.client.channels.cache.get(process.env.MIDDLEMAN_CHANNEL_ID);
      if (!channel) {
        console.log('⚠️ Channel not in cache, fetching...');
        try {
          channel = await this.client.channels.fetch(process.env.MIDDLEMAN_CHANNEL_ID);
          if (!channel) {
            console.error('❌ Channel fetch returned null');
            return;
          }
          console.log('✅ Successfully fetched channel:', channel.name);
        } catch (fetchError) {
          console.error('❌ Error fetching channel:', fetchError.message);
          return;
        }
      } else {
        console.log('✅ Channel found in cache:', channel.name);
      }

      const requester = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [request.requesterId]
      );

      const proofLinks = request.proofLinks ? JSON.parse(request.proofLinks) : [];

      const embed = new EmbedBuilder()
        .setTitle(`Middleman Request #${request.id}`)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Requester', value: requester?.username || 'Unknown', inline: true },
          { name: 'User 1', value: request.user1, inline: true },
          { name: 'User 2', value: request.user2, inline: true },
          { name: 'Item/Details', value: request.item, inline: false },
          { name: 'Value', value: request.value || 'N/A', inline: true },
          { name: 'Roblox Username', value: request.robloxUsername || 'N/A', inline: true }
        )
        .setFooter({ text: `Request ID: ${request.id}` })
        .setTimestamp(new Date(request.createdAt));

      if (proofLinks.length > 0) {
        embed.addFields({ name: 'Proof Links', value: proofLinks.join('\n'), inline: false });
      }

      const roleMention = `<@&${process.env.MIDDLEMAN_ROLE_ID}>`;
      const message = await channel.send({
        content: `${roleMention} New middleman request!`,
        embeds: [embed]
      });

      console.log('✅ Successfully posted middleman request to Discord. Message ID:', message.id);
    } catch (error) {
      console.error('❌ Error posting middleman request:', error);
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  async notifyModerationChannel(report) {
    try {
      const channelId = '1443391819638636585';
      const channel = this.client.channels.cache.get(channelId);
      if (!channel) {
        console.error('Scammer reports channel not found');
        return;
      }

      const reporter = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [report.reporterId]
      );

      const accused = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [report.accusedDiscordId]
      );

      const evidenceLinks = report.evidenceLinks ? JSON.parse(report.evidenceLinks) : [];

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Scammer Report #${report.id}`)
        .setColor(0xFF0000)
        .addFields(
          { name: 'Reporter', value: `<@${report.reporterId}> (${reporter?.username || 'Unknown'})`, inline: true },
          { name: 'Accused', value: `<@${report.accusedDiscordId}> (${accused?.username || 'Unknown'})`, inline: true },
          { name: 'Details', value: report.details.substring(0, 1000), inline: false }
        )
        .setFooter({ text: `Report ID: ${report.id}` })
        .setTimestamp(new Date(report.createdAt));

      if (evidenceLinks.length > 0) {
        embed.addFields({ name: 'Evidence Links', value: evidenceLinks.join('\n'), inline: false });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`report_request_info_${report.id}`)
            .setLabel('Request More Info')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬'),
          new ButtonBuilder()
            .setCustomId(`report_chat_accused_${report.id}`)
            .setLabel('Chat with Accused')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📱'),
          new ButtonBuilder()
            .setLabel('View on Website')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.BASE_URL || 'http://localhost:5173'}/admin/reports/${report.id}`)
        );

      const message = await channel.send({ 
        embeds: [embed],
        components: [row]
      });

      await dbHelpers.run(
        'UPDATE reports SET discordMessageId = ? WHERE id = ?',
        [message.id, report.id]
      );

      console.log(`✅ Sent scammer report #${report.id} to channel ${channelId}`);
    } catch (error) {
      console.error('Error notifying moderation channel:', error);
    }
  }

  async sendStoreEmbed() {
    try {
      const channelId = '1387655173782114375';
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🛒 Store Item')
        .setDescription('Buy this **spaghetti tualetti diamond with shark mutation**\n**250 M/s** for **25 USD**\n\nDM <@909463977787015228>')
        .setImage('https://bloxystore.com/cdn/shop/files/spageh.png?v=1759459891&width=1946')
        .setColor(0x5865F2)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log(`✅ Sent store embed to channel ${channelId}`);
    } catch (error) {
      console.error('Error sending store embed:', error);
      throw error;
    }
  }

  async handleRequestMoreInfo(interaction, reportId) {
    try {
      if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
        return interaction.reply({ content: '❌ You do not have permission to perform this action.', ephemeral: true });
      }

      const report = await dbHelpers.get('SELECT * FROM reports WHERE id = ?', [reportId]);
      if (!report) {
        return interaction.reply({ content: '❌ Report not found.', ephemeral: true });
      }

      await dbHelpers.run(
        'UPDATE reports SET requestedMoreInfo = 1 WHERE id = ?',
        [reportId]
      );

      const reporter = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [report.reporterId]);
      const accused = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [report.accusedDiscordId]);

      this.emit('reportRequestMoreInfo', {
        reportId,
        moderatorId: interaction.user.id,
        reporterId: report.reporterId,
        accusedId: report.accusedDiscordId
      });

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Scammer Report #${report.id}`)
        .setColor(0xFF0000)
        .addFields(
          { name: 'Reporter', value: `<@${report.reporterId}> (${reporter?.username || 'Unknown'})`, inline: true },
          { name: 'Accused', value: `<@${report.accusedDiscordId}> (${accused?.username || 'Unknown'})`, inline: true },
          { name: 'Details', value: report.details.substring(0, 1000), inline: false },
          { name: 'Status', value: `ℹ️ More info requested by <@${interaction.user.id}>`, inline: false }
        )
        .setFooter({ text: `Report ID: ${report.id}` })
        .setTimestamp(new Date(report.createdAt));

      const evidenceLinks = report.evidenceLinks ? JSON.parse(report.evidenceLinks) : [];
      if (evidenceLinks.length > 0) {
        embed.addFields({ name: 'Evidence Links', value: evidenceLinks.join('\n'), inline: false });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`report_request_info_${report.id}`)
            .setLabel('Request More Info')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`report_chat_accused_${report.id}`)
            .setLabel('Chat with Accused')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📱'),
          new ButtonBuilder()
            .setLabel('View on Website')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.BASE_URL || 'http://localhost:5173'}/admin/reports/${report.id}?chat=true`)
        );

      await interaction.update({ embeds: [embed], components: [row] });

      await interaction.followUp({
        content: `✅ More info requested for Report #${reportId}.\n\n**To chat with the accused person:**\n1. Click "Chat with Accused" button\n2. Or visit: ${process.env.BASE_URL || 'http://localhost:5173'}/admin/reports/${report.id}?chat=true`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error handling request more info:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
      }
    }
  }

  async handleBridgeThreadMessage(message) {
    try {
      const threadId = message.channel.id;
      const axios = require('axios');
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

      try {
        await dbHelpers.run(
          `CREATE TABLE IF NOT EXISTS bridge_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reportId INTEGER NOT NULL,
            threadId TEXT NOT NULL,
            accusedDiscordId TEXT NOT NULL,
            moderatorDiscordId TEXT NOT NULL,
            webhookUrl TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reportId) REFERENCES reports(id)
          )`
        );
      } catch (e) {
        // Table might already exist, ignore
      }

      const session = await dbHelpers.get(
        'SELECT * FROM bridge_sessions WHERE threadId = ?',
        [threadId]
      );

      if (!session) {
        return;
      }

      if (message.author.bot) {
        return;
      }

      if (message.author.id !== session.moderatorDiscordId) {
        return;
      }

      try {
        await axios.post(
          `${baseUrl}/api/discord-bridge/webhook`,
          {
            threadId: threadId,
            authorId: message.author.id,
            content: message.content,
            messageId: message.id
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(webhookSecret && { 'x-webhook-secret': webhookSecret })
            }
          }
        );
        console.log(`✅ Forwarded bridge message from ${message.author.tag} to website`);
      } catch (webhookError) {
        console.error('Error forwarding bridge message to webhook:', webhookError.message);
      }
    } catch (error) {
      console.error('Error handling bridge thread message:', error);
    }
  }

  async handleChatWithAccused(interaction, reportId) {
    try {
      if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
        return interaction.reply({ content: '❌ You do not have permission to perform this action.', ephemeral: true });
      }

      const report = await dbHelpers.get('SELECT * FROM reports WHERE id = ?', [reportId]);
      if (!report) {
        return interaction.reply({ content: '❌ Report not found.', ephemeral: true });
      }

      await dbHelpers.run(
        `CREATE TABLE IF NOT EXISTS bridge_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reportId INTEGER NOT NULL,
          threadId TEXT NOT NULL,
          accusedDiscordId TEXT NOT NULL,
          moderatorDiscordId TEXT NOT NULL,
          webhookUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reportId) REFERENCES reports(id)
        )`
      ).catch(() => {});

      const existingSession = await dbHelpers.get(
        'SELECT * FROM bridge_sessions WHERE reportId = ?',
        [reportId]
      );

      if (existingSession) {
        const thread = await this.client.channels.fetch(existingSession.threadId);
        if (thread) {
          return interaction.reply({
            content: `💬 **Bridge Already Active**\n\nA chat thread already exists for this report:\n<#${existingSession.threadId}>\n\nYou can chat there, and messages will sync with the website.`,
            ephemeral: true
          });
        }
      }

      const accusedUser = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [report.accusedDiscordId]
      );

      if (!accusedUser) {
        return interaction.reply({ content: '❌ Accused user not found in database.', ephemeral: true });
      }

      const reporter = await dbHelpers.get(
        'SELECT * FROM users WHERE discordId = ?',
        [report.reporterId]
      );

      const reportsChannelId = process.env.REPORTS_CHANNEL_ID || '1443391819638636585';
      const reportsChannel = await this.client.channels.fetch(reportsChannelId);

      if (!reportsChannel) {
        return interaction.reply({ content: '❌ Reports channel not found.', ephemeral: true });
      }

      const initialMessage = await reportsChannel.send({
        content: `🔗 **Bridged Chat Session**\n\n**Report:** #${report.id}\n**Reporter:** ${reporter?.username || 'Unknown'} (<@${report.reporterId}>)\n**Accused:** ${accusedUser.username} (<@${report.accusedDiscordId}>)\n**Moderator:** ${interaction.user.username} (<@${interaction.user.id}>)\n\n*Messages from the website will appear as if from ${accusedUser.username}*\n*Messages from Discord will appear as ${interaction.user.username} on the website*`
      });

      const thread = await initialMessage.startThread({
        name: `Report #${report.id} - ${accusedUser.username}`,
        type: 11,
        invitable: false
      });

      try {
        await thread.members.add(report.accusedDiscordId);
      } catch (e) {
        console.warn('Could not add accused user to thread:', e.message);
      }

      await dbHelpers.run(
        `INSERT INTO bridge_sessions (reportId, threadId, accusedDiscordId, moderatorDiscordId)
         VALUES (?, ?, ?, ?)`,
        [reportId, thread.id, report.accusedDiscordId, interaction.user.id]
      );

      await interaction.reply({
        content: `✅ **Bridge Created!**\n\nA private thread has been created: <#${thread.id}>\n\nYou can now chat there, and messages will automatically sync with the website. The accused user (<@${report.accusedDiscordId}>) has been added to the thread.`,
        ephemeral: true
      });

      await thread.send(`👋 **Bridge Active**\n\nThis thread is now connected to the website. Messages you send here will appear on the website as if from ${interaction.user.username}. Messages from the website will appear here as if from ${accusedUser.username}.`);

    } catch (error) {
      console.error('Error handling chat with accused:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
      }
    }
  }

  async handleAccept(message, args) {
    const requestId = parseInt(args[0]);
    if (!requestId) {
      return message.reply(`❌ ${getSnarkyResponse('error')} Provide a request ID: \`!mm accept <id>\``);
    }

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [requestId]
    );

    if (!request) {
      return message.reply(`❌ ${getSnarkyResponse('notFound')} Request not found.`);
    }

    if (request.status !== 'pending') {
      return message.reply(`❌ Request is already ${request.status}. What the fuck did you expect?`);
    }

    const requester = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [request.requesterId]
    );

    await dbHelpers.run(
      'UPDATE middleman SET status = ?, middlemanId = ? WHERE id = ?',
      ['accepted', message.author.id, requestId]
    );

    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [message.author.id, 'accept_middleman', requestId.toString(), '']
    );

    try {
      const middlemanChannel = this.client.channels.cache.get(process.env.MIDDLEMAN_CHANNEL_ID);
      if (!middlemanChannel) {
        throw new Error('Middleman channel not found');
      }

      const user1Id = request.user1 ? request.user1.replace(/[<@!>]/g, '') : '';
      const user2Id = request.user2 ? request.user2.replace(/[<@!>]/g, '') : '';

      const usersToAdd = [
        request.requesterId,
        user1Id,
        user2Id,
        message.author.id
      ];

      const uniqueUsers = [...new Set(usersToAdd.filter(id => id && id.length > 0))];

      const userObjects = [];
      for (const userId of uniqueUsers) {
        try {
          const user = await this.client.users.fetch(userId);
          userObjects.push(user);
          console.log(`✅ Fetched user: ${user.tag} (${userId})`);
        } catch (error) {
          console.error(`❌ Could not fetch user ${userId}:`, error.message);
        }
      }

      const threadName = `MM-${requestId} | ${request.item?.substring(0, 50) || 'Trade'}`;
      
      const initialMessage = await middlemanChannel.send({
        content: `🔒 Private thread for Middleman Request #${requestId}\n${uniqueUsers.map(id => `<@${id}>`).join(' ')}`
      });

      const thread = await initialMessage.startThread({
        name: threadName,
        type: 12,
        autoArchiveDuration: 1440,
        reason: `Middleman request #${requestId} accepted by ${message.author.tag}`
      });

      console.log(`✅ Created private thread: ${thread.name} (${thread.id})`);

      const axios = require('axios').default;
      for (const user of userObjects) {
        try {
          await axios.put(
            `https://discord.com/api/v10/channels/${thread.id}/thread-members/${user.id}`,
            {},
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`✅ Added ${user.tag} to thread via API`);
        } catch (apiError) {
          const status = apiError.response?.status;
          const errorData = apiError.response?.data;
          
          if (status === 403) {
            console.error(`❌ Permission denied adding ${user.tag} (${user.id}) to thread. Bot needs "Manage Threads" permission.`);
            try {
              await thread.send(`<@${user.id}> - You've been mentioned in this private thread. Please click to join if you haven't been added automatically.`);
            } catch (sendError) {
              console.error('Could not mention user in thread:', sendError.message);
            }
          } else if (status === 404) {
            console.error(`❌ User ${user.tag} (${user.id}) not found or not in server`);
          } else {
            console.error(`❌ Could not add user ${user.tag} (${user.id}) to thread:`, errorData || apiError.message);
            try {
              await thread.send(`<@${user.id}>`);
            } catch (e) {
              // Ignore
            }
          }
        }
      }

      const proofLinks = request.proofLinks ? JSON.parse(request.proofLinks) : [];
      
      const tradeEmbed = new EmbedBuilder()
        .setTitle(`📋 Middleman Request #${requestId}`)
        .setColor(0x00D166)
        .setDescription('This is a private thread for the middleman trade. Only the participants and moderator can see this thread.')
        .addFields(
          { name: '👤 Requester', value: `<@${request.requesterId}>`, inline: true },
          { name: '👥 User 1', value: `<@${user1Id}>`, inline: true },
          { name: '👥 User 2', value: `<@${user2Id}>`, inline: true },
          { name: '🛒 Item/Details', value: request.item || 'N/A', inline: false },
          { name: '💰 Value', value: request.value || 'N/A', inline: true },
          { name: '🎮 Roblox Username', value: request.robloxUsername || 'N/A', inline: true },
          { name: '✅ Accepted By', value: `<@${message.author.id}>`, inline: true }
        )
        .setFooter({ text: `Request ID: ${requestId}` })
        .setTimestamp(new Date(request.createdAt));

      if (proofLinks.length > 0) {
        tradeEmbed.addFields({ 
          name: '📎 Proof Links', 
          value: proofLinks.map(link => `[Link](${link})`).join('\n'), 
          inline: false 
        });
      }

      const participantsMention = uniqueUsers.map(id => `<@${id}>`).join(' ');
      await thread.send({
        content: `✅ **Middleman Request Accepted**\n\n${participantsMention}\n\nThis private thread has been created for your trade. Only you, the other party, and the moderator can see this thread.\n\n**Trade Details:**`,
        embeds: [tradeEmbed]
      });

      try {
        const requesterUser = await this.client.users.fetch(request.requesterId);
        await requesterUser.send(`✅ Your middleman request #${requestId} has been accepted by ${message.author.tag}. A private thread has been created: ${thread.toString()}`);
      } catch (error) {
        console.error('Error sending DM:', error);
      }

      await message.channel.send(`✅ Middleman request #${requestId} has been accepted by ${message.author.tag}. Private thread created: ${thread.toString()}`);

      message.reply(`✅ ${getSnarkyResponse('success')} Request #${requestId} accepted. Private thread: ${thread.toString()}`);
    } catch (error) {
      console.error('Error creating thread:', error);
      message.reply(`⚠️ Request #${requestId} accepted, but failed to create thread: ${error.message}. Fuck.`);
    }
  }

  async handleDecline(message, args) {
    const requestId = parseInt(args[0]);
    if (!requestId) {
      return message.reply(`❌ ${getSnarkyResponse('error')} Provide a request ID: \`!mm decline <id>\``);
    }

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [requestId]
    );

    if (!request) {
      return message.reply(`❌ ${getSnarkyResponse('notFound')} Request not found.`);
    }

    if (request.status !== 'pending') {
      return message.reply(`❌ Request is already ${request.status}. Too late, dumbass.`);
    }

    await dbHelpers.run(
      'UPDATE middleman SET status = ? WHERE id = ?',
      ['declined', requestId]
    );

    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [message.author.id, 'decline_middleman', requestId.toString(), '']
    );

    try {
      const requester = await this.client.users.fetch(request.requesterId);
      await requester.send(`❌ Your middleman request #${requestId} has been declined.`);
    } catch (error) {
      console.error('Error sending DM:', error);
    }

    message.reply(`✅ ${getSnarkyResponse('success')} Request #${requestId} declined.`);
  }

  async handleComplete(message, args) {
    const requestId = parseInt(args[0]);
    if (!requestId) {
      return message.reply(`❌ ${getSnarkyResponse('error')} Provide a request ID: \`!mm complete <id>\``);
    }

    const request = await dbHelpers.get(
      'SELECT * FROM middleman WHERE id = ?',
      [requestId]
    );

    if (!request) {
      return message.reply(`❌ ${getSnarkyResponse('notFound')} Request not found.`);
    }

    await dbHelpers.run(
      'UPDATE middleman SET status = ? WHERE id = ?',
      ['completed', requestId]
    );

    await dbHelpers.run(
      'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
      [message.author.id, 'complete_middleman', requestId.toString(), '']
    );

    message.reply(`✅ ${getSnarkyResponse('success')} Request #${requestId} marked as completed.`);
  }

  async handleList(message, args) {
    const status = args[0] || 'pending';

    const requests = await dbHelpers.all(
      'SELECT * FROM middleman WHERE status = ? ORDER BY createdAt DESC LIMIT 10',
      [status]
    );

    if (requests.length === 0) {
      return message.reply(`No ${status} requests found. Lucky you, I guess.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${status.toUpperCase()} Middleman Requests`)
      .setColor(0x5865F2)
      .setDescription(
        requests.map(r => `#${r.id} - ${r.item} (Requester: <@${r.requesterId}>)`).join('\n')
      );

    message.reply({ embeds: [embed] });
  }

  async handleTicket(message, args) {
    const requestId = parseInt(args[0]);
    if (!requestId) {
      return message.reply(`❌ ${getSnarkyResponse('error')} Provide a request ID: \`!mm ticket <id>\``);
    }

    message.reply('⚠️ Ticket creation feature not yet implemented. Maybe one day, who knows.');
  }

  // Casino Command Handlers
  async handleBalance(message) {
    try {
      const balance = await this.casino.getBalance(message.author.id);
      const embed = new EmbedBuilder()
        .setTitle('💰 Your Balance')
        .setColor(0x00D166)
        .setDescription(`You have **${balance.toLocaleString()}** coins.`)
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleDaily(message) {
    try {
      const result = await this.casino.dailyReward(message.author.id);
      
      if (!result.success) {
        const embed = new EmbedBuilder()
          .setTitle('⏰ Daily Reward')
          .setColor(0xFFA500)
          .setDescription(`You've already claimed your daily reward today.\n\nCome back in **${result.hoursLeft} hours**, you impatient fuck.`)
          .setTimestamp();
        return await message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Reward Claimed!')
        .setColor(0x00D166)
        .setDescription(`You received **${result.reward.toLocaleString()}** coins!\n\nYour new balance: **${result.balance.toLocaleString()}** coins.`)
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleCasinoStats(message, args) {
    try {
      const userId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
      const stats = await this.casino.getStats(userId);
      
      const winRate = stats.gamesPlayed > 0 
        ? ((stats.totalWon / (stats.totalWon + stats.totalLost)) * 100).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setTitle('🎰 Casino Statistics')
        .setColor(0x5865F2)
        .addFields(
          { name: '💰 Balance', value: `${stats.balance.toLocaleString()} coins`, inline: true },
          { name: '🎮 Games Played', value: `${stats.gamesPlayed}`, inline: true },
          { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
          { name: '✅ Total Won', value: `${stats.totalWon.toLocaleString()} coins`, inline: true },
          { name: '❌ Total Lost', value: `${stats.totalLost.toLocaleString()} coins`, inline: true },
          { name: '💵 Net Profit', value: `${(stats.totalWon - stats.totalLost).toLocaleString()} coins`, inline: true }
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleCoinflip(message, args) {
    try {
      const bet = parseInt(args[0]);
      const choice = args[1]?.toLowerCase();

      if (!bet || !choice) {
        return message.reply('❌ Usage: `!coinflip <bet> <heads/tails>`\nExample: `!coinflip 100 heads`');
      }

      if (!['heads', 'tails'].includes(choice)) {
        return message.reply('❌ Choice must be "heads" or "tails", you absolute moron.');
      }

      const result = await this.casino.coinflip(message.author.id, bet, choice);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The coin landed on **${result.result}**!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The coin landed on **${result.result}**.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleDice(message, args) {
    try {
      const bet = parseInt(args[0]);
      const guess = parseInt(args[1]);

      if (!bet || !guess) {
        return message.reply('❌ Usage: `!dice <bet> <number 1-6>`\nExample: `!dice 100 3`');
      }

      if (guess < 1 || guess > 6) {
        return message.reply('❌ Guess must be between 1 and 6, you absolute moron.');
      }

      const result = await this.casino.dice(message.author.id, bet, guess);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The dice rolled **${result.diceRoll}**!\n\nYou won **${result.winnings.toLocaleString()}** coins (5x multiplier)!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The dice rolled **${result.diceRoll}**.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleDouble(message, args) {
    try {
      const bet = parseInt(args[0]);

      if (!bet) {
        return message.reply('❌ Usage: `!double <bet>`\nExample: `!double 100`\n\nDouble or nothing - 50/50 chance to double your bet.');
      }

      const result = await this.casino.double(message.author.id, bet);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `You won! Double or nothing successful!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `You lost. Better luck next time, you unlucky fuck.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleRoulette(message, args) {
    try {
      const bet = parseInt(args[0]);
      const choice = args[1];

      if (!bet || !choice) {
        return message.reply('❌ Usage: `!roulette <bet> <red/black/green/number>`\nExample: `!roulette 100 red` or `!roulette 100 7`');
      }

      const result = await this.casino.roulette(message.author.id, bet, choice);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The ball landed on **${result.number}** (${result.color})!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The ball landed on **${result.number}** (${result.color}).\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlackjack(message, args) {
    try {
      const bet = parseInt(args[0]);

      if (!bet) {
        return message.reply('❌ Usage: `!blackjack <bet>`\nExample: `!blackjack 100`\n\nThen use `!hit` or `!stand` to play.');
      }

      const result = await this.casino.blackjack(message.author.id, bet);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack Game Started')
        .setColor(0x5865F2)
        .setDescription(
          `**Your Cards:** ${result.game.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.game.playerTotal}\n\n` +
          `**Dealer's Card:** ${result.game.dealerCard.display}\n\n` +
          `Use \`!hit\` to draw another card or \`!stand\` to end your turn.`
        )
        .setFooter({ text: `Bet: ${bet.toLocaleString()} coins | User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlackjackHit(message) {
    try {
      const result = await this.casino.blackjackHit(message.author.id);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      if (result.bust) {
        const embed = new EmbedBuilder()
          .setTitle('💀 Bust!')
          .setColor(0xDC3545)
          .setDescription(
            `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
            `**Your Total:** ${result.playerTotal}\n\n` +
            `You went over 21! You lost your bet.\n\n` +
            `New balance: **${result.balance.toLocaleString()}** coins.`
          )
          .setFooter({ text: `User: ${message.author.tag}` })
          .setTimestamp();

        return await message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack - Hit')
        .setColor(0x5865F2)
        .setDescription(
          `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.playerTotal}\n\n` +
          `Use \`!hit\` to draw another card or \`!stand\` to end your turn.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleBlackjackStand(message) {
    try {
      const result = await this.casino.blackjackStand(message.author.id);

      if (!result.success) {
        return message.reply(`❌ ${result.error}`);
      }

      if (result.push) {
        const embed = new EmbedBuilder()
          .setTitle('🤝 Push!')
          .setColor(0xFFA500)
          .setDescription(
            `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
            `**Your Total:** ${result.playerTotal}\n\n` +
            `**Dealer's Cards:** ${result.dealerCards.map(c => c.display).join(', ')}\n` +
            `**Dealer's Total:** ${result.dealerTotal}\n\n` +
            `It's a tie! Your bet is returned.\n\n` +
            `Balance: **${result.balance.toLocaleString()}** coins.`
          )
          .setFooter({ text: `User: ${message.author.tag}` })
          .setTimestamp();

        return await message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.playerTotal}\n\n` +
          `**Dealer's Cards:** ${result.dealerCards.map(c => c.display).join(', ')}\n` +
          `**Dealer's Total:** ${result.dealerTotal}\n\n` +
          (result.won
            ? `You won **${result.winnings.toLocaleString()}** coins!\n\n`
            : `You lost **${result.loss.toLocaleString()}** coins.\n\n`) +
          `New balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  // Admin Casino Commands
  async handleCasinoAdd(message, args) {
    if (!args[0] || !args[1]) {
      return message.reply('❌ Usage: `!casinoadd <user> <amount>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
      return message.reply('❌ Amount must be a positive number, you absolute moron.');
    }

    try {
      const newBalance = await this.casino.updateBalance(userId, amount, true);
      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'casino_add', userId, `Added ${amount} coins`]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Coins Added')
        .setColor(0x00D166)
        .setDescription(`Added **${amount.toLocaleString()}** coins to <@${userId}>.\n\nNew balance: **${newBalance.toLocaleString()}** coins.`)
        .setFooter({ text: `Admin: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleCasinoRemove(message, args) {
    if (!args[0] || !args[1]) {
      return message.reply('❌ Usage: `!casinoremove <user> <amount>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
      return message.reply('❌ Amount must be a positive number, you absolute moron.');
    }

    try {
      const balance = await this.casino.getBalance(userId);
      if (amount > balance) {
        return message.reply(`❌ User only has ${balance.toLocaleString()} coins. Can't remove more than that, dumbass.`);
      }

      const newBalance = await this.casino.updateBalance(userId, -amount, false);
      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'casino_remove', userId, `Removed ${amount} coins`]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Coins Removed')
        .setColor(0xFFA500)
        .setDescription(`Removed **${amount.toLocaleString()}** coins from <@${userId}>.\n\nNew balance: **${newBalance.toLocaleString()}** coins.`)
        .setFooter({ text: `Admin: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  async handleCasinoReset(message, args) {
    if (!args[0]) {
      return message.reply('❌ Usage: `!casinoreset <user>`');
    }

    const userId = args[0].replace(/[<@!>]/g, '');

    try {
      await dbHelpers.run(
        'UPDATE casino_balances SET balance = 1000, totalWon = 0, totalLost = 0, gamesPlayed = 0, updatedAt = CURRENT_TIMESTAMP WHERE discordId = ?',
        [userId]
      );

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [message.author.id, 'casino_reset', userId, 'Reset casino stats']
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Casino Stats Reset')
        .setColor(0x5865F2)
        .setDescription(`Reset casino statistics for <@${userId}>.\n\nBalance set to 1000 coins.`)
        .setFooter({ text: `Admin: ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ ${getSnarkyResponse('error')} ${error.message}`);
    }
  }

  // Slash Command Handlers
  async handleSlashHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 ZRX Market Bot - Commands')
      .setColor(0x5865F2)
      .setDescription('Here are all the fucking commands. Use them wisely.')
      .addFields(
        {
          name: '🌐 Public Commands',
          value: [
            '`/help` - Show this help (obviously)',
            '`/ping` - Check if I\'m alive (spoiler: I am)',
            '`/stats` - Show market statistics',
            '`/user <discordId>` - Look up a user',
            '`/trade <id>` - View trade details'
          ].join('\n'),
          inline: false
        },
        {
          name: '🎰 Casino Commands',
          value: [
            '`/balance` - Check your coin balance',
            '`/daily` - Claim daily reward (500-1000 coins)',
            '`/casinostats [user]` - View casino statistics',
            '`/coinflip <bet> <heads/tails>` - Flip a coin',
            '`/dice <bet> <1-6>` - Roll dice (5x multiplier)',
            '`/double <bet>` - Double or nothing',
            '`/roulette <bet> <red/black/green/number>` - Play roulette',
            '`/blackjack <bet>` - Start blackjack game',
            '`/hit` - Draw card in blackjack',
            '`/stand` - End turn in blackjack'
          ].join('\n'),
          inline: false
        },
        {
          name: '👮 Moderator Commands',
          value: [
            '`/mm accept/decline/complete/list` - Middleman management',
            '`/blacklist add/remove/list/check` - Blacklist management',
            '`/report list/view` - Report management',
            '`/verify <user>` - Verify a user',
            '`/unverify <user>` - Unverify a user',
            '`/serverstats` - Show server statistics',
            '`/cleanup` - Clean up old trades',
            '`/casinoadd/remove/reset` - Casino admin commands'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'ZRX Market Bot - Made with attitude' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async handleSlashStats(interaction) {
    try {
      const totalTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE status = ?', ['active']);
      const totalUsers = await dbHelpers.get('SELECT COUNT(*) as count FROM users');
      const pendingMM = await dbHelpers.get('SELECT COUNT(*) as count FROM middleman WHERE status = ?', ['pending']);
      const totalReports = await dbHelpers.get('SELECT COUNT(*) as count FROM reports WHERE status = ?', ['pending']);
      const completedTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE status = ?', ['completed']);

      const embed = new EmbedBuilder()
        .setTitle('📊 Market Statistics')
        .setColor(0x00D166)
        .setDescription('Here are the fucking stats. Impressive, right?')
        .addFields(
          { name: '🛒 Active Trades', value: `${totalTrades?.count || 0}`, inline: true },
          { name: '✅ Completed Trades', value: `${completedTrades?.count || 0}`, inline: true },
          { name: '👥 Total Users', value: `${totalUsers?.count || 0}`, inline: true },
          { name: '🤝 Pending Middleman', value: `${pendingMM?.count || 0}`, inline: true },
          { name: '🚨 Pending Reports', value: `${totalReports?.count || 0}`, inline: true },
          { name: '🤖 Bot Uptime', value: this.formatUptime(process.uptime()), inline: true }
        )
        .setFooter({ text: 'ZRX Market Bot' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashUserLookup(interaction) {
    const userId = interaction.options.getString('discordid').replace(/[<@!>]/g, '');
    
    try {
      const user = await dbHelpers.get('SELECT * FROM users WHERE discordId = ?', [userId]);
      
      if (!user) {
        return await interaction.editReply({ content: `❌ ${getSnarkyResponse('notFound')} User not found in database.` });
      }

      const userTrades = await dbHelpers.get('SELECT COUNT(*) as count FROM trades WHERE creatorId = ?', [userId]);
      const userMM = await dbHelpers.get('SELECT COUNT(*) as count FROM middleman WHERE requesterId = ?', [userId]);
      const userReports = await dbHelpers.get('SELECT COUNT(*) as count FROM reports WHERE reporterId = ? OR accusedDiscordId = ?', [userId, userId]);
      const isBlacklisted = await dbHelpers.get('SELECT * FROM blacklist WHERE discordId = ?', [userId]);

      const embed = new EmbedBuilder()
        .setTitle(`👤 User Lookup: ${user.username}`)
        .setColor(user.verified ? 0x00D166 : 0xFFA500)
        .setThumbnail(user.avatar || null)
        .addFields(
          { name: '🆔 Discord ID', value: user.discordId, inline: true },
          { name: '✅ Verified', value: user.verified ? 'Yes' : 'No', inline: true },
          { name: '🚫 Blacklisted', value: isBlacklisted ? `Yes - ${isBlacklisted.reason}` : 'No', inline: true },
          { name: '🛒 Trades Created', value: `${userTrades?.count || 0}`, inline: true },
          { name: '🤝 Middleman Requests', value: `${userMM?.count || 0}`, inline: true },
          { name: '🚨 Reports', value: `${userReports?.count || 0}`, inline: true },
          { name: '📅 Joined', value: new Date(user.createdAt).toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `User ID: ${userId}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashTradeLookup(interaction) {
    const tradeId = interaction.options.getInteger('id');

    try {
      const trade = await dbHelpers.get(
        `SELECT t.*, u.username, u.avatar 
         FROM trades t 
         JOIN users u ON t.creatorId = u.discordId 
         WHERE t.id = ?`,
        [tradeId]
      );

      if (!trade) {
        return await interaction.editReply({ content: `❌ ${getSnarkyResponse('notFound')} Trade #${tradeId} not found.` });
      }

      const offered = trade.offered ? JSON.parse(trade.offered) : [];
      const wanted = trade.wanted ? JSON.parse(trade.wanted) : [];

      const embed = new EmbedBuilder()
        .setTitle(`🛒 Trade #${trade.id}`)
        .setColor(0x5865F2)
        .setDescription(`**Status:** ${trade.status.toUpperCase()}`)
        .addFields(
          { name: '👤 Creator', value: `<@${trade.creatorId}> (${trade.username})`, inline: true },
          { name: '📅 Created', value: new Date(trade.createdAt).toLocaleDateString(), inline: true },
          { name: '🎮 Category', value: trade.isCrossTrade ? 'Cross-Trade' : 'Same Game', inline: true },
          { 
            name: '📤 Offered', 
            value: offered.length > 0 
              ? offered.map(item => `${item.name}${item.mutation ? ` (${item.mutation})` : ''}${item.value ? ` - ${item.value}` : ''}`).join('\n').substring(0, 1024)
              : 'None',
            inline: false 
          },
          { 
            name: '📥 Wanted', 
            value: wanted.length > 0 
              ? wanted.map(item => `${item.name}${item.mutation ? ` (${item.mutation})` : ''}${item.value ? ` - ${item.value}` : ''}`).join('\n').substring(0, 1024)
              : 'None',
            inline: false 
          }
        )
        .setFooter({ text: `Trade ID: ${trade.id}` })
        .setTimestamp(new Date(trade.createdAt));

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashBalance(interaction) {
    try {
      const balance = await this.casino.getBalance(interaction.user.id);
      const embed = new EmbedBuilder()
        .setTitle('💰 Your Balance')
        .setColor(0x00D166)
        .setDescription(`You have **${balance.toLocaleString()}** coins.`)
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashDaily(interaction) {
    try {
      const result = await this.casino.dailyReward(interaction.user.id);
      
      if (!result.success) {
        const embed = new EmbedBuilder()
          .setTitle('⏰ Daily Reward')
          .setColor(0xFFA500)
          .setDescription(`You've already claimed your daily reward today.\n\nCome back in **${result.hoursLeft} hours**, you impatient fuck.`)
          .setTimestamp();
        return await interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Reward Claimed!')
        .setColor(0x00D166)
        .setDescription(`You received **${result.reward.toLocaleString()}** coins!\n\nYour new balance: **${result.balance.toLocaleString()}** coins.`)
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCasinoStats(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const userId = targetUser ? targetUser.id : interaction.user.id;
      const stats = await this.casino.getStats(userId);
      
      const winRate = stats.gamesPlayed > 0 
        ? ((stats.totalWon / (stats.totalWon + stats.totalLost)) * 100).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setTitle('🎰 Casino Statistics')
        .setColor(0x5865F2)
        .addFields(
          { name: '💰 Balance', value: `${stats.balance.toLocaleString()} coins`, inline: true },
          { name: '🎮 Games Played', value: `${stats.gamesPlayed}`, inline: true },
          { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
          { name: '✅ Total Won', value: `${stats.totalWon.toLocaleString()} coins`, inline: true },
          { name: '❌ Total Lost', value: `${stats.totalLost.toLocaleString()} coins`, inline: true },
          { name: '💵 Net Profit', value: `${(stats.totalWon - stats.totalLost).toLocaleString()} coins`, inline: true }
        )
        .setFooter({ text: `User: ${targetUser ? targetUser.tag : interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCoinflip(interaction) {
    try {
      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice').toLowerCase();

      const result = await this.casino.coinflip(interaction.user.id, bet, choice);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The coin landed on **${result.result}**!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The coin landed on **${result.result}**.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashDice(interaction) {
    try {
      const bet = interaction.options.getInteger('bet');
      const guess = interaction.options.getInteger('guess');

      const result = await this.casino.dice(interaction.user.id, bet, guess);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The dice rolled **${result.diceRoll}**!\n\nYou won **${result.winnings.toLocaleString()}** coins (5x multiplier)!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The dice rolled **${result.diceRoll}**.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashDouble(interaction) {
    try {
      const bet = interaction.options.getInteger('bet');

      const result = await this.casino.double(interaction.user.id, bet);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `You won! Double or nothing successful!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `You lost. Better luck next time, you unlucky fuck.\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashRoulette(interaction) {
    try {
      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice');

      const result = await this.casino.roulette(interaction.user.id, bet, choice);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          result.won
            ? `The ball landed on **${result.number}** (${result.color})!\n\nYou won **${result.winnings.toLocaleString()}** coins!\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
            : `The ball landed on **${result.number}** (${result.color}).\n\nYou lost **${result.loss.toLocaleString()}** coins.\n\nNew balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashBlackjack(interaction) {
    try {
      const bet = interaction.options.getInteger('bet');

      const result = await this.casino.blackjack(interaction.user.id, bet);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack Game Started')
        .setColor(0x5865F2)
        .setDescription(
          `**Your Cards:** ${result.game.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.game.playerTotal}\n\n` +
          `**Dealer's Card:** ${result.game.dealerCard.display}\n\n` +
          `Use \`/hit\` to draw another card or \`/stand\` to end your turn.`
        )
        .setFooter({ text: `Bet: ${bet.toLocaleString()} coins | User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashBlackjackHit(interaction) {
    try {
      const result = await this.casino.blackjackHit(interaction.user.id);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      if (result.bust) {
        const embed = new EmbedBuilder()
          .setTitle('💀 Bust!')
          .setColor(0xDC3545)
          .setDescription(
            `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
            `**Your Total:** ${result.playerTotal}\n\n` +
            `You went over 21! You lost your bet.\n\n` +
            `New balance: **${result.balance.toLocaleString()}** coins.`
          )
          .setFooter({ text: `User: ${interaction.user.tag}` })
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack - Hit')
        .setColor(0x5865F2)
        .setDescription(
          `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.playerTotal}\n\n` +
          `Use \`/hit\` to draw another card or \`/stand\` to end your turn.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashBlackjackStand(interaction) {
    try {
      const result = await this.casino.blackjackStand(interaction.user.id);

      if (!result.success) {
        return await interaction.editReply({ content: `❌ ${result.error}` });
      }

      if (result.push) {
        const embed = new EmbedBuilder()
          .setTitle('🤝 Push!')
          .setColor(0xFFA500)
          .setDescription(
            `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
            `**Your Total:** ${result.playerTotal}\n\n` +
            `**Dealer's Cards:** ${result.dealerCards.map(c => c.display).join(', ')}\n` +
            `**Dealer's Total:** ${result.dealerTotal}\n\n` +
            `It's a tie! Your bet is returned.\n\n` +
            `Balance: **${result.balance.toLocaleString()}** coins.`
          )
          .setFooter({ text: `User: ${interaction.user.tag}` })
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle(result.won ? '🎉 You Won!' : '💀 You Lost')
        .setColor(result.won ? 0x00D166 : 0xDC3545)
        .setDescription(
          `**Your Cards:** ${result.playerCards.map(c => c.display).join(', ')}\n` +
          `**Your Total:** ${result.playerTotal}\n\n` +
          `**Dealer's Cards:** ${result.dealerCards.map(c => c.display).join(', ')}\n` +
          `**Dealer's Total:** ${result.dealerTotal}\n\n` +
          (result.won
            ? `You won **${result.winnings.toLocaleString()}** coins!\n\n`
            : `You lost **${result.loss.toLocaleString()}** coins.\n\n`) +
          `New balance: **${result.balance.toLocaleString()}** coins.`
        )
        .setFooter({ text: `User: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashMM(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'accept':
          const acceptId = interaction.options.getInteger('id');
          // Convert to message-like format for existing handler
          const acceptMessage = { author: { id: interaction.user.id }, channel: interaction.channel, reply: (content) => interaction.editReply({ content }) };
          await this.handleAccept(acceptMessage, [acceptId.toString()]);
          break;
        case 'decline':
          const declineId = interaction.options.getInteger('id');
          const declineMessage = { author: { id: interaction.user.id }, channel: interaction.channel, reply: (content) => interaction.editReply({ content }) };
          await this.handleDecline(declineMessage, [declineId.toString()]);
          break;
        case 'complete':
          const completeId = interaction.options.getInteger('id');
          const completeMessage = { author: { id: interaction.user.id }, channel: interaction.channel, reply: (content) => interaction.editReply({ content }) };
          await this.handleComplete(completeMessage, [completeId.toString()]);
          break;
        case 'list':
          const status = interaction.options.getString('status') || 'pending';
          const listMessage = { reply: async (content) => {
            if (typeof content === 'string') {
              await interaction.editReply({ content });
            } else {
              await interaction.editReply({ embeds: content.embeds });
            }
          }};
          await this.handleList(listMessage, [status]);
          break;
      }
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashBlacklist(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'add':
          const user = interaction.options.getUser('user');
          const reason = interaction.options.getString('reason');
          const addMessage = { author: { id: interaction.user.id }, reply: (content) => interaction.editReply({ content }) };
          await this.handleBlacklistAdd(addMessage, [user.id, reason]);
          break;
        case 'remove':
          const removeUser = interaction.options.getUser('user');
          const removeMessage = { author: { id: interaction.user.id }, reply: (content) => interaction.editReply({ content }) };
          await this.handleBlacklistRemove(removeMessage, [removeUser.id]);
          break;
        case 'list':
          const listMessage = { reply: async (content) => {
            if (typeof content === 'string') {
              await interaction.editReply({ content });
            } else {
              await interaction.editReply({ embeds: content.embeds });
            }
          }};
          await this.handleBlacklistList(listMessage);
          break;
        case 'check':
          const checkUser = interaction.options.getUser('user');
          const checkMessage = { reply: (content) => interaction.editReply({ content }) };
          await this.handleBlacklistCheck(checkMessage, [checkUser.id]);
          break;
      }
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashReport(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'list':
          const status = interaction.options.getString('status') || 'pending';
          const listMessage = { reply: async (content) => {
            if (typeof content === 'string') {
              await interaction.editReply({ content });
            } else {
              await interaction.editReply({ embeds: content.embeds });
            }
          }};
          await this.handleReportList(listMessage, [status]);
          break;
        case 'view':
          const reportId = interaction.options.getInteger('id');
          const viewMessage = { reply: async (content) => {
            if (typeof content === 'string') {
              await interaction.editReply({ content });
            } else {
              await interaction.editReply({ embeds: content.embeds });
            }
          }};
          await this.handleReportView(viewMessage, [reportId.toString()]);
          break;
      }
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashVerify(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const user = interaction.options.getUser('user');
    const message = { author: { id: interaction.user.id }, reply: (content) => interaction.editReply({ content }) };
    await this.handleVerify(message, [user.id]);
  }

  async handleSlashUnverify(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const user = interaction.options.getUser('user');
    const message = { author: { id: interaction.user.id }, reply: (content) => interaction.editReply({ content }) };
    await this.handleUnverify(message, [user.id]);
  }

  async handleSlashServerStats(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    try {
      const guild = interaction.guild;
      if (!guild) {
        return await interaction.editReply({ content: '❌ This command only works in a server, you absolute buffoon.' });
      }

      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
      const totalChannels = guild.channels.cache.size;
      const totalRoles = guild.roles.cache.size;

      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Statistics: ${guild.name}`)
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👥 Total Members', value: `${totalMembers}`, inline: true },
          { name: '🟢 Online Members', value: `${onlineMembers}`, inline: true },
          { name: '📺 Channels', value: `${totalChannels}`, inline: true },
          { name: '🎭 Roles', value: `${totalRoles}`, inline: true },
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '📅 Created', value: guild.createdAt.toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `Server ID: ${guild.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCleanup(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    try {
      const result = await dbHelpers.run(
        `UPDATE trades SET status = 'expired' 
         WHERE status = 'active' 
         AND datetime(createdAt, '+5 hours') < datetime('now')`
      );

      await interaction.editReply({ content: `✅ ${getSnarkyResponse('success')} Cleanup completed. ${result.changes || 0} trades expired.` });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCasinoAdd(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
      const newBalance = await this.casino.updateBalance(user.id, amount, true);
      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [interaction.user.id, 'casino_add', user.id, `Added ${amount} coins`]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Coins Added')
        .setColor(0x00D166)
        .setDescription(`Added **${amount.toLocaleString()}** coins to <@${user.id}>.\n\nNew balance: **${newBalance.toLocaleString()}** coins.`)
        .setFooter({ text: `Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCasinoRemove(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
      const balance = await this.casino.getBalance(user.id);
      if (amount > balance) {
        return await interaction.editReply({ content: `❌ User only has ${balance.toLocaleString()} coins. Can't remove more than that, dumbass.` });
      }

      const newBalance = await this.casino.updateBalance(user.id, -amount, false);
      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [interaction.user.id, 'casino_remove', user.id, `Removed ${amount} coins`]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Coins Removed')
        .setColor(0xFFA500)
        .setDescription(`Removed **${amount.toLocaleString()}** coins from <@${user.id}>.\n\nNew balance: **${newBalance.toLocaleString()}** coins.`)
        .setFooter({ text: `Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async handleSlashCasinoReset(interaction) {
    const hasModeratorRole = interaction.member?.roles.cache.has(process.env.MODERATOR_ROLE_ID);
    if (!hasModeratorRole) {
      // Already deferred at top level, use editReply
      return await interaction.editReply({ content: `❌ ${getSnarkyResponse('noPermission')}` });
    }

    const user = interaction.options.getUser('user');

    try {
      await dbHelpers.run(
        'UPDATE casino_balances SET balance = 1000, totalWon = 0, totalLost = 0, gamesPlayed = 0, updatedAt = CURRENT_TIMESTAMP WHERE discordId = ?',
        [user.id]
      );

      await dbHelpers.run(
        'INSERT INTO admin_logs (actorId, action, targetId, details) VALUES (?, ?, ?, ?)',
        [interaction.user.id, 'casino_reset', user.id, 'Reset casino stats']
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Casino Stats Reset')
        .setColor(0x5865F2)
        .setDescription(`Reset casino statistics for <@${user.id}>.\n\nBalance set to 1000 coins.`)
        .setFooter({ text: `Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${getSnarkyResponse('error')} ${error.message}` });
    }
  }

  async login() {
    await this.client.login(process.env.DISCORD_BOT_TOKEN);
  }
}

// Create and export bot instance
const bot = new MiddlemanBot();

// Make bot accessible globally for API routes
global.middlemanBot = bot;

// Start bot if token is provided
if (process.env.DISCORD_BOT_TOKEN) {
  bot.login().catch((error) => {
    console.error('❌ Bot login failed:', error);
    process.exit(1);
  });
} else {
  console.warn('⚠️  DISCORD_BOT_TOKEN not set. Bot will not start.');
}

module.exports = bot;
