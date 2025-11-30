const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { dbHelpers } = require('../db/config');

passport.serializeUser((user, done) => {
  done(null, user.discordId);
});

passport.deserializeUser(async (discordId, done) => {
  try {
    if (!discordId) {
      return done(null, false);
    }
    
    const user = await dbHelpers.get(
      'SELECT * FROM users WHERE discordId = ?',
      [discordId]
    );
    
    if (!user) {
      // User doesn't exist in database - clear the session
      return done(null, false);
    }
    
    done(null, user);
  } catch (error) {
    console.error('Error deserializing user:', error);
    // On error, return false to clear the invalid session
    done(null, false);
  }
});

// Initialize Discord strategy
// Always register it, but check credentials at runtime
passport.use(
  'discord',
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || 'placeholder',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'placeholder',
      callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
      scope: ['identify', 'guilds', 'guilds.join']
    },
    async (accessToken, refreshToken, profile, done) => {
      // Check if credentials are actually configured
      if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        return done(new Error('Discord OAuth credentials not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env file.'), null);
      }
      try {
        // Check if user is in the guild
        const axios = require('axios').default;
        let inGuild = false;
        let roles = [];

        try {
          // Get user's guilds list with retry logic for rate limits
          const targetGuildId = process.env.GUILD_ID;
          let guildsResponse;
          let retries = 0;
          const maxRetries = 3;

          while (retries < maxRetries) {
            try {
              guildsResponse = await axios.get(
                'https://discord.com/api/v10/users/@me/guilds',
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`
                  }
                }
              );
              break; // Success, exit retry loop
            } catch (rateLimitError) {
              if (rateLimitError.response?.status === 429 && retries < maxRetries - 1) {
                const retryAfter = (rateLimitError.response.data?.retry_after || 1) * 1000; // Convert to milliseconds
                console.log(`Rate limited. Retrying after ${retryAfter}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter));
                retries++;
              } else {
                throw rateLimitError; // Re-throw if not rate limit or max retries reached
              }
            }
          }

          // Check if user is in the target guild
          const userGuilds = guildsResponse?.data || [];
          const isInGuild = userGuilds.some(guild => guild.id === targetGuildId);

          if (isInGuild) {
            inGuild = true;
            // Try to get roles from guild member API using bot token
            try {
              const botToken = process.env.DISCORD_BOT_TOKEN;
              if (botToken) {
                const memberResponse = await axios.get(
                  `https://discord.com/api/v10/guilds/${targetGuildId}/members/${profile.id}`,
                  {
                    headers: {
                      Authorization: `Bot ${botToken}`
                    }
                  }
                );
                if (memberResponse.data && memberResponse.data.roles) {
                  roles = memberResponse.data.roles;
                  console.log(`✅ Synced roles for user ${profile.id}:`, roles);
                }
              }
            } catch (roleError) {
              console.log('Could not fetch roles via bot API:', roleError.message);
              roles = [];
            }
          } else {
            // User is not in guild - try to add them automatically
            console.log(`User ${profile.id} is not in guild ${targetGuildId}. Attempting to add them...`);
            
            try {
              // Use bot token to add user to guild
              const botToken = process.env.DISCORD_BOT_TOKEN;
              const targetGuildId = process.env.GUILD_ID;
              
              if (!botToken) {
                console.error('❌ Bot token not available, cannot auto-add user to server');
                console.error('Make sure DISCORD_BOT_TOKEN is set in .env file');
              } else if (!targetGuildId) {
                console.error('❌ Guild ID not available, cannot auto-add user to server');
                console.error('Make sure GUILD_ID is set in .env file');
              } else {
                console.log(`🔄 Attempting to add user ${profile.id} (${profile.username}) to guild ${targetGuildId}...`);
                
                // Add user to guild with retry logic for rate limits
                let addRetries = 0;
                const maxAddRetries = 3;
                let addMemberResponse;

                while (addRetries < maxAddRetries) {
                  try {
                    addMemberResponse = await axios.put(
                      `https://discord.com/api/v10/guilds/${targetGuildId}/members/${profile.id}`,
                      {
                        access_token: accessToken
                      },
                      {
                        headers: {
                          Authorization: `Bot ${botToken}`,
                          'Content-Type': 'application/json'
                        },
                        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
                      }
                    );

                    if (addMemberResponse.status === 201 || addMemberResponse.status === 204) {
                      console.log(`✅ Successfully added user ${profile.id} to guild ${targetGuildId}`);
                      inGuild = true;
                      
                      // Assign auto-role
                      const autoRoleId = '1399955798414590042';
                      try {
                        await axios.put(
                          `https://discord.com/api/v10/guilds/${targetGuildId}/members/${profile.id}/roles/${autoRoleId}`,
                          {},
                          {
                            headers: {
                              Authorization: `Bot ${botToken}`,
                              'Content-Type': 'application/json'
                            },
                            validateStatus: (status) => status < 500
                          }
                        );
                        console.log(`✅ Assigned role ${autoRoleId} to user ${profile.id}`);
                        roles = [autoRoleId];
                      } catch (roleError) {
                        console.error('Failed to assign role:', roleError.response?.data || roleError.message);
                        roles = [];
                      }

                      // Send welcome message - try via bot first, then fallback to API
                      // Wait a moment for the user to be fully added to the server
                      await new Promise(resolve => setTimeout(resolve, 1500));
                      
                      let welcomeSent = false;
                      
                      // Try using bot client if available
                      if (global.middlemanBot && global.middlemanBot.client && global.middlemanBot.client.readyAt) {
                        try {
                          const guild = await global.middlemanBot.client.guilds.fetch(targetGuildId);
                          const member = await guild.members.fetch(profile.id);
                          if (member) {
                            await member.send('Hi and welcome to my server i was made by ZRX');
                            console.log(`✅ Sent welcome message via bot to user ${profile.id}`);
                            welcomeSent = true;
                          }
                        } catch (botError) {
                          console.log('Bot client method failed, trying API method:', botError.message);
                        }
                      }
                      
                      // Fallback to API method if bot client didn't work
                      if (!welcomeSent) {
                        try {
                          // Create a DM channel with the user
                          const dmChannelResponse = await axios.post(
                            `https://discord.com/api/v10/users/@me/channels`,
                            {
                              recipient_id: profile.id
                            },
                            {
                              headers: {
                                Authorization: `Bot ${botToken}`,
                                'Content-Type': 'application/json'
                              },
                              validateStatus: (status) => status < 500
                            }
                          );

                          if (dmChannelResponse.status === 200 && dmChannelResponse.data && dmChannelResponse.data.id) {
                            // Send message to the DM channel
                            const messageResponse = await axios.post(
                              `https://discord.com/api/v10/channels/${dmChannelResponse.data.id}/messages`,
                              {
                                content: 'Hi and welcome to my server i was made by ZRX'
                              },
                              {
                                headers: {
                                  Authorization: `Bot ${botToken}`,
                                  'Content-Type': 'application/json'
                                },
                                validateStatus: (status) => status < 500
                              }
                            );

                            if (messageResponse.status === 200 || messageResponse.status === 201) {
                              console.log(`✅ Sent welcome message via API to user ${profile.id}`);
                              welcomeSent = true;
                            } else {
                              console.error(`Failed to send message. Status: ${messageResponse.status}`, messageResponse.data);
                            }
                          } else {
                            console.error('Failed to create DM channel:', dmChannelResponse.status, dmChannelResponse.data);
                          }
                        } catch (welcomeError) {
                          // User might have DMs disabled or other error
                          console.error('Could not send welcome message:', {
                            status: welcomeError.response?.status,
                            data: welcomeError.response?.data,
                            message: welcomeError.message
                          });
                        }
                      }

                      break; // Success, exit retry loop
                    } else if (addMemberResponse.status === 429) {
                      // Rate limited, retry
                      const retryAfter = (addMemberResponse.data?.retry_after || 1) * 1000;
                      console.log(`Rate limited on add member. Retrying after ${retryAfter}ms...`);
                      await new Promise(resolve => setTimeout(resolve, retryAfter));
                      addRetries++;
                    } else {
                      // Other error, don't retry
                      console.error(`❌ Failed to add user. Status: ${addMemberResponse.status}`);
                      console.error('Response:', addMemberResponse.data);
                      break;
                    }
                  } catch (addError) {
                    if (addError.response?.status === 429 && addRetries < maxAddRetries - 1) {
                      const retryAfter = (addError.response.data?.retry_after || 1) * 1000;
                      console.log(`Rate limited on add member. Retrying after ${retryAfter}ms...`);
                      await new Promise(resolve => setTimeout(resolve, retryAfter));
                      addRetries++;
                    } else {
                      throw addError; // Re-throw if not rate limit or max retries reached
                    }
                  }
                }
              }
            } catch (addError) {
              console.error('Failed to auto-add user to server:');
              console.error('Status:', addError.response?.status);
              console.error('Error data:', addError.response?.data);
              console.error('Error message:', addError.message);
              // Continue with authentication even if auto-add fails
            }
          }
        } catch (error) {
          console.log('Error checking guild membership:', error.response?.data || error.message);
          // Allow authentication even if guild check fails
          inGuild = false;
        }

        // Allow authentication even if not in guild
        // Guild membership is optional but recommended

        // Check if user is blacklisted
        const blacklisted = await dbHelpers.get(
          'SELECT * FROM blacklist WHERE discordId = ?',
          [profile.id]
        );

        if (blacklisted) {
          return done(null, false, { message: 'Your account has been blacklisted.' });
        }

        // Upsert user
        const username = profile.discriminator === '0' 
          ? profile.username 
          : `${profile.username}#${profile.discriminator}`;
        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null;

        await dbHelpers.run(
          `INSERT INTO users (discordId, username, avatar, roles)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(discordId) DO UPDATE SET
           username = excluded.username,
           avatar = excluded.avatar,
           roles = excluded.roles`,
          [profile.id, username, avatar, JSON.stringify(roles)]
        );

        const user = await dbHelpers.get(
          'SELECT * FROM users WHERE discordId = ?',
          [profile.id]
        );

        user.inGuild = inGuild;
        user.roles = roles;

        // Update verified status based on guild membership
        if (inGuild && user.verified === 0) {
          await dbHelpers.run(
            'UPDATE users SET verified = 1 WHERE discordId = ?',
            [profile.id]
          );
          user.verified = 1;
        } else if (!inGuild) {
          await dbHelpers.run(
            'UPDATE users SET verified = 0 WHERE discordId = ?',
            [profile.id]
          );
          user.verified = 0;
        }

        return done(null, user);
      } catch (error) {
        console.error('Passport strategy error:', error);
        return done(error, null);
      }
    }
  )
);

// Warn if credentials are not configured
if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  console.warn('⚠️  Discord OAuth credentials not found. Authentication will not work until .env is configured.');
}

module.exports = passport;

