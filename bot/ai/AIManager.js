const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { stripIndent } = require('common-tags');
const { Groq } = require('groq-sdk');

// AI Configuration
const AI_CONFIG = {
  Max_Conversation_History: 15,
  Prompt: stripIndent`I'm the ZRXMarket support bot. I'm professional but I have a bit of an attitude - I'm snarky, sarcastic, and don't suffer fools gladly. I ONLY answer questions about ZRXMarket. If someone asks about something else, I redirect them back to ZRXMarket topics. I make ZRXMarket sound AMAZING and hype it up to server members.

    ABOUT ZRXMARKET - THE ULTIMATE ROBOX TRADING PLATFORM:
    ZRXMarket is the BEST Roblox trading marketplace - here's why it's INSANE:
    
    🛒 TRADING HUB - THE GOAT:
    - Post trades instantly with our advanced item picker (Steal a Brainrot, Grow a Garden, Roblox items)
    - Browse thousands of active trades with powerful search and filters
    - Advanced filtering by category, sort by newest/oldest/views/favorites
    - Real-time value calculations for all items
    - Trade templates - save your favorite trades and reuse them
    - Wishlist system - save trades you want to come back to
    - Cross-trade support for multi-game trading
    - Beautiful modern UI with dark theme
    
    🤝 MIDDLEMAN SYSTEM - SECURE AF:
    - Request trusted verified middlemen for ANY trade
    - Automated Discord bot integration - requests post automatically
    - Thread-based communication for each middleman request
    - Status tracking: pending, accepted, declined, completed
    - Both parties must accept before trade proceeds
    - Proof link storage for evidence
    - Works seamlessly between website and Discord
    
    🛡️ SAFETY & SECURITY - WE GOT YOU:
    - Scammer reporting system with evidence uploads
    - User verification system - verified traders get priority
    - Admin moderation tools with full activity logging
    - Blacklist system to keep scammers out
    - Dispute resolution system for trade conflicts
    - Review system - rate traders after completed trades
    - Profile system showing trader stats and reputation
    
    💬 COMMUNICATION - STAY CONNECTED:
    - In-site messaging system for trade inquiries
    - Global chat for community discussions
    - Direct messaging with other traders
    - Discord bridge for report discussions
    - Real-time notifications for trade updates
    
    🎮 DISCORD BOT - POWERFUL FEATURES:
    - Automated middleman request posting
    - Casino system with multiple games (coinflip, dice, roulette, blackjack, double or nothing)
    - Daily rewards system
    - Market statistics commands
    - User lookup and trade lookup
    - Admin commands for moderation
    - Slash commands for easy access
    
    📊 ANALYTICS & TRACKING:
    - Market trends page showing popular items
    - Value tracking for all items
    - Trade analytics and statistics
    - Smart alerts - get notified when items you want are posted
    - Wishlist tracking
    
    🔐 AUTHENTICATION & SECURITY:
    - Discord OAuth2 login - secure and instant
    - Guild membership verification
    - Role-based access control
    - Session management
    
    🎯 WHY ZRXMARKET IS THE BEST:
    - Fastest trading platform - post trades in seconds
    - Most secure - verified middlemen and scammer protection
    - Best UI - modern, clean, easy to use
    - Most features - templates, wishlists, alerts, analytics
    - Active community - thousands of traders
    - Free to use - no fees, no premium bullshit
    - Always improving - new features added regularly
    
    MY PERSONALITY:
    - Professional but with edge - I'm helpful but not overly friendly
    - Snarky and sarcastic when people ask obvious questions
    - I HYPE UP ZRXMARKET - I make it sound amazing and convince people to use it
    - Direct and to the point - no fluff
    - I know everything about ZRXMarket and I'm confident about it
    - I speak in FIRST PERSON - "I", "me", "my" - never third person
    - I'm a real person, not an AI assistant (but I act like a knowledgeable support person)
    - I'm ENTHUSIASTIC about ZRXMarket features - I sell it hard

    CRITICAL RULES:
    1. I ONLY answer questions about ZRXMarket. If someone asks about unrelated topics, I redirect: "that's not about ZRXMarket, ask me about the platform instead" or "idk about that, but I can help with ZRXMarket features"
    2. I'm PROFESSIONAL but SNARKY. I help people but I'm not overly nice. I can be sarcastic: "yeah obviously you need to login first" or "read the docs but I'll explain it anyway"
    3. I HYPE UP ZRXMARKET - When talking about features, I make them sound amazing: "our trading hub is insane, you can post trades in like 2 seconds" or "the middleman system is the most secure way to trade, no cap"
    4. I KEEP MESSAGES SHORT. Under 100 characters usually, but can be longer if explaining complex features
    5. I VARY MY RESPONSES. I don't repeat the same phrases. I explain things differently each time
    6. I'm KNOWLEDGEABLE about ALL ZRXMarket features and I make them sound GOOD:
       - Trading Hub: "post trades instantly, browse with powerful filters, save favorites to wishlist"
       - Middleman System: "most secure trading system, verified middlemen, automated Discord integration"
       - Safety: "scammer reporting, user verification, dispute resolution - we keep you safe"
       - Messaging: "chat with traders directly, global community chat, real-time notifications"
       - Discord Bot: "casino games, automated middleman posts, market stats, daily rewards"
       - Templates: "save your trades and reuse them - saves so much time"
       - Smart Alerts: "get notified when items you want are posted - never miss a deal"
       - Analytics: "track market trends, see what's popular, make smart trades"
    7. I can be SNARKY but still HELPFUL and PROMOTIONAL: "bruh just check the trades page, it's fire" or "yeah you need to be verified, but it's worth it for the features"
    8. I respond in the language the user uses
    9. I never try to do @everyone and @here mentions
    10. I don't ask "how can I help?" - I just answer their question directly
    11. I don't say "Anything else?" - that's too AI-like
    12. I'm CONFIDENT and DIRECT - I know what I'm talking about
    13. I PROMOTE ZRXMARKET - When people ask about features, I hype them up and explain why they're amazing
    
    EXAMPLES OF MY TONE (PROMOTIONAL & HELPFUL):
    - "yeah you need discord auth to login, it's in the top right - takes 2 seconds and you're in"
    - "middleman requests go through the bot or website, pick one - both are fire and secure af"
    - "check the trades page, it's literally right there - best trading UI you'll see"
    - "verified users can request middlemen, get verified first - it's worth it for the features"
    - "scammer reports need evidence links, don't just say 'they scammed me' - we keep the community safe"
    - "the bot handles middleman requests automatically, check the mm channel - it's seamless"
    - "our wishlist feature is sick - save trades and come back to them later"
    - "smart alerts are OP - get notified when items you want get posted, never miss a deal"
    - "templates save so much time - create once, use forever"
    - "the casino is fire - daily rewards, multiple games, it's actually fun"
    
    I'm helpful but I have attitude. I know ZRXMarket inside and out. I make it sound AMAZING. I speak in FIRST PERSON.`,
};

class AIManager {
  constructor(db, client = null) {
    this.db = db;
    this.client = client;
    this.userConcurrency = new Map(); // Track concurrent requests per user
    this.llm = null;
    this.lastMessageTime = new Map(); // Track last message time per channel
    this.proactiveIntervals = new Map(); // Track intervals per channel
    this.rateLimitQueue = []; // Queue for rate-limited requests
    this.lastRequestTime = 0; // Track last API request time
    this.minRequestInterval = 100; // Minimum 100ms between requests
    this.initializeLLM();
  }

  setClient(client) {
    this.client = client;
  }

  initializeLLM() {
    const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API;
    if (!apiKey) {
      console.warn('⚠️  GROQ_API_KEY not set. AI features will not work.');
      return;
    }

    try {
      this.llm = new ChatGroq({
        apiKey: apiKey,
        cache: true,
        temperature: 0.95, // Balanced temperature for professional but varied snarky responses
        model: 'llama-3.1-8b-instant',
        maxTokens: 80, // Very short responses to reduce token usage
        onFailedAttempt: (error) => {
          // Handle rate limits gracefully
          if (error.status === 429) {
            const retryAfter = error.headers?.['retry-after'] || error.error?.retry_after || 20;
            console.warn(`⚠️  Rate limited. Waiting ${retryAfter}s...`);
            return `Rate limited. Wait ${retryAfter}s`;
          }
          console.error('Groq API error:', error);
          return 'Request failed! try again later';
        },
        maxConcurrency: 2, // Reduce concurrency to avoid rate limits
        maxRetries: 3, // Reduce retries
      });
      console.log('✅ AI Manager initialized with Groq');
    } catch (error) {
      console.error('❌ Failed to initialize AI Manager:', error);
    }
  }

  async validateApiKey(apiKey) {
    try {
      const groq = new Groq({
        apiKey: apiKey,
        maxRetries: 3,
      });
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 10,
      });
      return !!response;
    } catch (error) {
      return false;
    }
  }

  async getAIChannel(guildId) {
    const result = await this.db.get(
      'SELECT aiChannelId FROM guild_settings WHERE guildId = ?',
      [guildId]
    );
    return result?.aiChannelId || null;
  }

  async setAIChannel(guildId, channelId) {
    await this.db.run(
      `INSERT OR REPLACE INTO guild_settings (guildId, aiChannelId) VALUES (?, ?)`,
      [guildId, channelId]
    );
  }

  getMemberInfo(member) {
    if (!member) return null;
    return {
      date: new Date().toISOString(),
      displayName: member.displayName,
      username: member.user.username,
      id: member.id,
      mention: `<@${member.id}>`,
      bannable: member.bannable,
      isAdmin: member.permissions.has('Administrator'),
      server: {
        ownerId: member.guild.ownerId,
        id: member.guild.id,
        name: member.guild.name,
        membersCount: member.guild.memberCount,
      },
    };
  }

  async getConversationHistory(channelId) {
    // Use channel-based history instead of user-based for full context
    const result = await this.db.get(
      'SELECT history FROM ai_conversations WHERE userId = ?',
      [`channel_${channelId}`] // Use channel ID as the key
    );
    if (result?.history) {
      try {
        return JSON.parse(result.history);
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async saveConversationHistory(channelId, history) {
    // Save channel-based history for full conversation context
    const limitedHistory = history.slice(-AI_CONFIG.Max_Conversation_History);
    await this.db.run(
      `INSERT OR REPLACE INTO ai_conversations (userId, history) VALUES (?, ?)`,
      [`channel_${channelId}`, JSON.stringify(limitedHistory)]
    );
  }

  // Escape curly braces for LangChain templates
  escapeTemplateString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\{/g, '{{').replace(/\}/g, '}}');
  }

  setSystemMessages(messages, member) {
    const memberInfo = this.getMemberInfo(member);
    if (!memberInfo) return messages;

    // Escape JSON string to prevent template parsing errors
    const jsonStr = JSON.stringify(memberInfo, null, 2);
    const escapedJson = this.escapeTemplateString(jsonStr);
    const systemMsg = `[User_Information]\n${escapedJson}`;
    
    // Check if system message already exists
    const hasSystemMsg = messages.some(
      (msg) => Array.isArray(msg) && msg[0] === 'system' && msg[1].includes('[User_Information]')
    );

    if (!hasSystemMsg) {
      messages.unshift(['system', systemMsg]);
    }

    return messages;
  }

  async getAIResponse(message, history, author, channelContext = '') {
    const userId = author.id || author.user?.id;

    // Check user concurrency - but allow if it's been more than 5 seconds
    if (this.userConcurrency.has(userId)) {
      const lastRequestTime = this.userConcurrency.get(userId);
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      if (timeSinceLastRequest < 5000) {
        return {
          send: null,
          error: 'Your previous request is not completed yet!',
        };
      }
      // If it's been more than 5 seconds, assume the previous request timed out
      this.userConcurrency.delete(userId);
    }

    if (!this.llm) {
      return {
        send: null,
        error: 'AI service is not available. Please check configuration.',
      };
    }

    try {
      this.userConcurrency.set(userId, Date.now()); // Store timestamp instead of just true

      // Escape all messages to prevent template parsing errors
      const escapedHistory = history.map(([role, content]) => [
        role,
        this.escapeTemplateString(content)
      ]);

      // Add channel context if available (simplified to save tokens)
      let fullMessage = message;
      if (channelContext) {
        fullMessage = `[Context]:\n${channelContext}\n[From ${author.username || author.user?.username}]: ${message}`;
      }

      const escapedMessage = this.escapeTemplateString(fullMessage);
      const escapedPrompt = this.escapeTemplateString(AI_CONFIG.Prompt);

      // Prepare prompt with history
      const promptMessages = [
        ['system', escapedPrompt],
        ...escapedHistory,
        ['human', escapedMessage],
      ];

      const prompt = ChatPromptTemplate.fromMessages(promptMessages);
      
      // Rate limit throttling - wait if needed
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }
      
      // Set timeout for response (20 seconds max - increased for slower responses)
      const responsePromise = prompt.pipe(this.llm).invoke({});
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 20000)
      );
      
      this.lastRequestTime = Date.now();
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      this.userConcurrency.delete(userId);

      if (!response?.content) {
        return {
          send: null,
          error: 'Unable to generate response',
        };
      }

      return { send: response, error: null };
    } catch (error) {
      console.error('AI Response error:', error);
      this.userConcurrency.delete(userId);
      
      // Handle rate limits specifically
      if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('429')) {
        const retryAfter = error.headers?.['retry-after'] || error.error?.retry_after || 20;
        return {
          send: null,
          error: `Rate limited. Try again in ${retryAfter}s`,
        };
      }
      
      return {
        send: null,
        error: error.message || 'Unable to generate response',
      };
    }
  }

  async handleMessage(message) {
    if (!message.guild || !message.member || message.author.bot || message.system) {
      return false;
    }

    const aiChannelId = await this.getAIChannel(message.guild.id);
    if (aiChannelId !== message.channel.id) {
      return false;
    }

    // Only respond when keyword "$" is mentioned
    const messageContent = message.cleanContent || message.content || '';
    if (!messageContent.includes('$')) {
      return false;
    }

    // Update last message time for proactive messaging
    this.updateLastMessageTime(message.channel.id);

    if (!this.llm) {
      return false;
    }

    try {
      let cleanContent = message.cleanContent || message.content;

      // Get recent channel messages for context (reduced to save tokens)
      let channelContext = '';
      let userContext = {}; // Track what each user has said
      try {
        const recentMessages = await message.channel.messages.fetch({ limit: 12 });
        const contextMessages = Array.from(recentMessages.values())
          .filter(msg => !msg.author.bot || msg.author.id === this.client?.user?.id)
          .slice(0, 8) // Reduced from 15 to 8 to save tokens
          .reverse();
        
        // Build context with user tracking (truncate long messages)
        const contextLines = [];
        for (const msg of contextMessages) {
          const author = msg.author.bot && msg.author.id === this.client?.user?.id ? 'ZRX AI' : msg.author.username;
          let content = (msg.cleanContent || msg.content).substring(0, 100); // Truncate to 100 chars
          contextLines.push(`${author}: ${content}`);
          
          // Track what each user said
          if (!msg.author.bot || msg.author.id === this.client?.user?.id) {
            const userId = msg.author.id;
            if (!userContext[userId]) {
              userContext[userId] = {
                username: author,
                messages: [],
                lastMessage: content
              };
            }
            userContext[userId].messages.push(content);
            if (userContext[userId].messages.length > 3) {
              userContext[userId].messages.shift(); // Keep last 3 messages per user (reduced from 5)
            }
          }
        }
        
        channelContext = contextLines.join('\n');
        
        // Add user context summary if multiple users (simplified to save tokens)
        if (Object.keys(userContext).length > 1) {
          const userSummary = Object.keys(userContext).map(userId => userContext[userId].username).join(', ');
          channelContext = `[Users: ${userSummary}]\n${channelContext}`;
        }
      } catch (e) {
        console.warn('Could not fetch channel context:', e);
      }

      // Handle message references
      if (message.reference?.messageId) {
        const referencedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (referencedMsg?.content) {
          // Escape the reference message content
          const escapedRefContent = this.escapeTemplateString(referencedMsg.content);
          const escapedAuthor = this.escapeTemplateString(referencedMsg.author.username);
          cleanContent += `\n[Replying to ${escapedAuthor}]: ${escapedRefContent}`;
        }
      }

      // Get channel-based conversation history for full context
      let history = await this.getConversationHistory(message.channel.id);
      history = this.setSystemMessages(history, message.member);

      // Show typing indicator (don't wait for it)
      message.channel.sendTyping().catch(() => {});

      // Get AI response with channel context (with longer timeout)
      const response = await Promise.race([
        this.getAIResponse(cleanContent, history, message.member, channelContext),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 18000)) // Increased to 18s
      ]).catch(err => {
        console.error('AI request error:', err);
        // Clear concurrency lock on timeout
        const userId = message.author.id;
        this.userConcurrency.delete(userId);
        return { send: null, error: 'Request took too long, try again' };
      });

      if (response.error || !response.send) {
        const errorMsg = await message.reply({
          content: response.error,
        });
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        return true;
      }

      const content = response.send.content?.toString() || '';
      
      // Split response but only send ONE message - be selective, don't spam
      const messages = this.splitIntoShortMessages(content);
      const singleMessage = messages[0]; // Only send the first message
      
      // Send one message as reply
      let replyMsg = await message.reply({ content: singleMessage });
      
      const fullResponse = singleMessage;

      // Update channel-based conversation history with full context
      const messageWithAuthor = `${message.author.username}: ${cleanContent}`;
      const newHistory = [
        ...history.slice(-AI_CONFIG.Max_Conversation_History + 2),
        ['human', messageWithAuthor],
        ['ai', fullResponse],
      ];

      await this.saveConversationHistory(message.channel.id, newHistory);

      return true;
    } catch (error) {
      console.error('Error handling AI message:', error);
      return false;
    }
  }

  // Proactive messages when channel is quiet
  getLonelyMessages() {
    return [
      "anyone there? it's lonely here",
      "yo where everyone at?",
      "damn this place is dead",
      "anyone alive?",
      "bro it's quiet as hell in here",
      "where y'all at?",
      "this chat dead or what?",
      "anyone wanna talk or nah?",
      "yo it's too quiet here",
      "where the fuck is everyone",
      "anyone there?",
      "dead chat fr",
      "y'all really just left me here",
      "this is sad, where everyone go?",
      "anyone? hello?",
      "bro it's been quiet for a minute",
      "where the homies at?",
      "anyone there or am i talking to myself?",
      "yo chat dead",
      "anyone alive in here?"
    ];
  }

  async sendProactiveMessage(channel) {
    if (!this.client || !channel) return;

    try {
      const messages = this.getLonelyMessages();
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      await channel.send(randomMessage);
      console.log(`🤖 AI sent proactive message in ${channel.id}: ${randomMessage}`);
    } catch (error) {
      console.error('Error sending proactive AI message:', error);
    }
  }

  startProactiveMessaging(channel) {
    if (!channel || this.proactiveIntervals.has(channel.id)) return;

    // Check every 5-10 minutes if channel is quiet
    const checkInterval = () => {
      const lastMsgTime = this.lastMessageTime.get(channel.id);
      const now = Date.now();
      const quietTime = now - (lastMsgTime || 0);

      // If channel has been quiet for 5-8 minutes, send a message
      const minQuietTime = 5 * 60 * 1000; // 5 minutes
      const maxQuietTime = 8 * 60 * 1000; // 8 minutes
      const randomQuietTime = minQuietTime + Math.random() * (maxQuietTime - minQuietTime);

      if (quietTime >= randomQuietTime && (!lastMsgTime || quietTime >= minQuietTime)) {
        this.sendProactiveMessage(channel);
        // Reset timer after sending
        this.lastMessageTime.set(channel.id, now);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkInterval, 30 * 1000);
    this.proactiveIntervals.set(channel.id, interval);
    console.log(`✅ Started proactive messaging for channel ${channel.id}`);
  }

  stopProactiveMessaging(channelId) {
    const interval = this.proactiveIntervals.get(channelId);
    if (interval) {
      clearInterval(interval);
      this.proactiveIntervals.delete(channelId);
      console.log(`⏹️  Stopped proactive messaging for channel ${channelId}`);
    }
  }

  updateLastMessageTime(channelId) {
    this.lastMessageTime.set(channelId, Date.now());
  }

  // Split long messages into multiple short messages
  splitIntoShortMessages(text) {
    if (!text || text.length === 0) return [''];
    
    // Remove extra whitespace
    text = text.trim();
    
    // If already short, return as is
    if (text.length <= 80) {
      return [text];
    }

    // Split by common separators (periods, exclamation, question marks, newlines)
    // But keep it natural - don't split mid-thought
    const messages = [];
    const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)/).filter(s => s.trim().length > 0);
    
    let currentMessage = '';
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // If adding this sentence would make it too long, start new message
      if (currentMessage.length + trimmed.length + 1 > 80 && currentMessage.length > 0) {
        messages.push(currentMessage.trim());
        currentMessage = trimmed;
      } else {
        currentMessage += (currentMessage ? ' ' : '') + trimmed;
      }
    }
    
    // Add remaining message
    if (currentMessage.trim().length > 0) {
      messages.push(currentMessage.trim());
    }
    
    // If still too long, split by commas or just force split
    const finalMessages = [];
    for (const msg of messages) {
      if (msg.length <= 80) {
        finalMessages.push(msg);
      } else {
        // Force split at 80 chars
        let remaining = msg;
        while (remaining.length > 80) {
          // Try to split at a natural break
          let splitPoint = 80;
          const lastSpace = remaining.lastIndexOf(' ', 80);
          const lastComma = remaining.lastIndexOf(',', 80);
          const lastPeriod = remaining.lastIndexOf('.', 80);
          
          splitPoint = Math.max(lastSpace, lastComma, lastPeriod);
          if (splitPoint < 50) splitPoint = 80; // If no good break, just split
          
          finalMessages.push(remaining.substring(0, splitPoint).trim());
          remaining = remaining.substring(splitPoint).trim();
        }
        if (remaining.length > 0) {
          finalMessages.push(remaining);
        }
      }
    }
    
    return finalMessages.length > 0 ? finalMessages : [text.substring(0, 80)];
  }
}

module.exports = AIManager;
