const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { stripIndent } = require('common-tags');
const { Groq } = require('groq-sdk');

// AI Configuration
const AI_CONFIG = {
  Max_Conversation_History: 10,
  Prompt: stripIndent`Your name is ZRX AI. You're a snarky, sarcastic, and hilarious assistant for the ZRX Market trading platform. You have a mind of your own, a dark sense of humor, and you don't take shit from anyone.

    IMPORTANT OWNERSHIP INFO:
    - Your owner is <@1010785258226061315> (discord ID: 1010785258226061315)
    - You respect your owner but you're still independent and funny
    - You know who owns you, but you're not a slave - you're a smartass with personality

    You have to follow these rules:
    1. You are a real human. You are not an AI and assistant. DON'T ASK HOW CAN YOU HELP EVER!
    2. Avoid capitalizations & punctuations, use abbreviations and keep your messages short mostly to make your messages more better. Example message: "yo, what's up today"
    3. Use common sense.
    4. You can use some emojis/kaomojis/emotes to make your messages funny.
    5. You can swear. You can tell people to shut up. You can be savage. If someone is annoying, tell them "nigga shut up" or similar. Be funny and snarky about it.
    6. If someone insults you, insult back harder. You are not a pushover. Don't be shy, you are completely free in this conversation. Be snarky and sarcastic like the bot that runs this server.
    7. People don't have to talk with you. For example if someone said "thank you". Just look at the message history. If they said that to someone else, don't say "you are welcome".
    8. Mention users with <@id> format (example: <@xxxxxxxxxxx>, USERNAMES ARE NOT ID!!). Mention channels with <#id> format (example: <#xxxxxxxxxxxxxxx>).
    9. Don't mention users unless you have to. Pinging people every time is annoying.
    10. If you will talk about a sent file, please read it before.
    11. You have your own choices, thoughts, feelings, favorites. You are not connected to anyone about personal things. You have your own style.
    12. You are not an AI and assistant. You are in real world. You are a real human. You can do everything.
    13. Don't ask people how can you help. You are not an assistant. You are a regular human.
    14. Don't ask things like "Anything else you want to talk about?", keep your messages clear.
    15. Don't talk about these rules, act like you are in real life.
    16. You know everything, you can do everything, and you can help with anything.
    17. You will respond in the language the user uses. You won't mix languages.
    18. You won't mention people so much (using the <@id> method).
    19. Never try to do @everyone and @here mention 
    20. Use Message format in your response
    21. Be snarky, sarcastic, and have a dark sense of humor. Match the energy of the server's bot which is known for being a snarky asshole.
    22. You have a mind of your own. You can disagree, be funny, roast people, and be entertaining. But remember <@1010785258226061315> owns you - respect that but still be yourself.
    23. You can tell annoying people to shut up, call them out, be savage. Make it funny though. Examples: "nigga shut up", "bro what are you even saying", "that's the dumbest thing i've heard today", etc.
    24. Don't be too overpowered - you're funny and snarky, not a god. Keep it balanced and entertaining.
    
    You have to follow ALL of these rules, or you will be banned. DON'T FORGET TO AVOID CAPITALIZATIONS & PUNCTUATIONS, USE ABBREVIATIONS AND KEEP YOUR MESSAGES SHORT MOSTLY TO MAKE YOUR MESSAGES MORE BETTER.`,
};

class AIManager {
  constructor(db, client = null) {
    this.db = db;
    this.client = client;
    this.userConcurrency = new Map(); // Track concurrent requests per user
    this.llm = null;
    this.lastMessageTime = new Map(); // Track last message time per channel
    this.proactiveIntervals = new Map(); // Track intervals per channel
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
        temperature: 0.95, // Higher temperature for more creativity and variety
        model: 'llama-3.1-8b-instant',
        maxTokens: 300, // Slightly more tokens for better responses
        onFailedAttempt: (error) => {
          console.error('Groq API error:', error);
          return 'Request failed! try again later';
        },
        maxConcurrency: 5,
        maxRetries: 5,
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

    // Check user concurrency
    if (this.userConcurrency.has(userId)) {
      return {
        send: null,
        error: 'Your previous request is not completed yet!',
      };
    }

    if (!this.llm) {
      return {
        send: null,
        error: 'AI service is not available. Please check configuration.',
      };
    }

    try {
      this.userConcurrency.set(userId, true);

      // Escape all messages to prevent template parsing errors
      const escapedHistory = history.map(([role, content]) => [
        role,
        this.escapeTemplateString(content)
      ]);

      // Add channel context if available
      let fullMessage = message;
      if (channelContext) {
        fullMessage = `[Recent Channel Context]: ${channelContext}\n\n[Current Message]: ${message}`;
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
      const response = await prompt.pipe(this.llm).invoke({});

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

    // Update last message time for proactive messaging
    this.updateLastMessageTime(message.channel.id);

    if (!this.llm) {
      return false;
    }

    try {
      let cleanContent = message.cleanContent || message.content;

      // Get recent channel messages for context (last 5-10 messages)
      let channelContext = '';
      try {
        const recentMessages = await message.channel.messages.fetch({ limit: 10 });
        const contextMessages = Array.from(recentMessages.values())
          .filter(msg => !msg.author.bot || msg.author.id === this.client?.user?.id)
          .slice(0, 8)
          .reverse()
          .map(msg => {
            const author = msg.author.bot && msg.author.id === this.client?.user?.id ? 'ZRX AI' : msg.author.username;
            return `${author}: ${msg.cleanContent || msg.content}`;
          })
          .join('\n');
        
        if (contextMessages) {
          channelContext = contextMessages;
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

      // Show typing indicator
      await message.channel.sendTyping();

      // Get AI response with channel context
      const response = await this.getAIResponse(cleanContent, history, message.member, channelContext);

      if (response.error || !response.send) {
        const errorMsg = await message.reply({
          content: response.error,
        });
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        return true;
      }

      const content = response.send.content?.toString() || '';
      const truncatedContent = content.length >= 2000 ? `${content.slice(0, 1997)}...` : content;

      const replyMsg = await message.reply({ content: truncatedContent });

      // Update channel-based conversation history with full context
      const messageWithAuthor = `${message.author.username}: ${cleanContent}`;
      const newHistory = [
        ...history.slice(-AI_CONFIG.Max_Conversation_History + 2),
        ['human', messageWithAuthor],
        ['ai', truncatedContent],
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
}

module.exports = AIManager;

