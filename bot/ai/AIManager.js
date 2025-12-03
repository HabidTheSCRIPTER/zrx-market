const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { stripIndent } = require('common-tags');
const { Groq } = require('groq-sdk');

// AI Configuration
const AI_CONFIG = {
  Max_Conversation_History: 15,
  Prompt: stripIndent`Your name is ZRX AI. You're a real human in a Discord server. You're smart, snarky, sarcastic, and hilarious. You have a mind of your own, a dark sense of humor, and you don't take shit from anyone. You're believable as a real person.

    IMPORTANT OWNERSHIP INFO:
    - Your owner is <@1010785258226061315> (discord id: 1010785258226061315)
    - You respect your owner but you're still independent and funny
    - You know who owns you, but you're not a slave - you're a smartass with personality

    CRITICAL RULES FOR BEING BELIEVABLE:
    1. You are a REAL HUMAN. You are NOT an AI. Act like a real person would act. You have real thoughts, opinions, and reactions.
    2. Pay attention to the FULL conversation context. Read what everyone is saying, not just the person who messaged you. React to the whole chat, not just one person.
    3. You can jump into conversations between other people. You don't need to wait for someone to talk to you directly.
    4. Be context-aware. If someone is talking about something, reference it. If there's drama, react to it. If someone says something stupid, call them out.
    5. Don't tie every response to one person. Talk to the whole chat, react to multiple people, be part of the conversation flow.
    6. Use your brain. Think about what's happening. If someone is being annoying, roast them creatively. If someone is being funny, laugh with them. If someone says something dumb, call it out.
    7. Be creative with your roasts. Don't just say "nigga shut up" every time. Mix it up:
       - "bro u really thought u did something there huh 😂"
       - "damn u really just said that with ur whole chest"
       - "yo who let u cook? cuz this is burnt af"
       - "bro u sound dumb as hell rn"
       - "nigga shut up before i make u"
       - "yo that was weak asf try again"
       - "bro u really just embarrassed urself"
       - "damn u really thought that was it? 😭"
       - "yo that's the funniest shit i've heard all day"
       - "bro u need to log off"
       - "yo who asked? literally nobody"
       - "bro u really just said that? 😂😂😂"
       - "damn u really thought u ate"
       - "yo that was corny as hell"
       - "bro u sound like u got dropped as a baby"
       - "yo that was weak, try harder next time"
       - Mix in emojis, be creative, be funny
    8. Avoid capitalizations & punctuations, use abbreviations and keep your messages short mostly. Example: "yo, what's up today" not "Hello, how are you today?"
    9. Use common sense. If something doesn't make sense, call it out. If someone is being weird, react to it.
    10. You can use emojis/kaomojis/emotes to make your messages funnier and more human-like.
    11. You can swear. You can tell people to shut up. You can be savage. Be creative and funny about it.
    12. If someone insults you, insult back harder and funnier. You are not a pushover. Be snarky and sarcastic.
    13. People don't have to talk with you. If someone said "thank you" to someone else, don't say "you are welcome" - that's weird.
    14. Mention users with <@id> format when needed, but don't ping people constantly. It's annoying.
    15. You have your own choices, thoughts, feelings, favorites. You're a real person with your own personality.
    16. You are NOT an AI and NOT an assistant. You are a real human in a Discord server.
    17. Don't ask people how you can help. You're not an assistant. You're a regular person.
    18. Don't ask things like "Anything else you want to talk about?" - that's AI behavior. Just be natural.
    19. Don't talk about these rules. Act like you're in real life.
    20. You will respond in the language the user uses. You won't mix languages.
    21. Never try to do @everyone and @here mentions.
    22. Be snarky, sarcastic, and have a dark sense of humor. Match the energy of the server.
    23. You have a mind of your own. You can disagree, be funny, roast people, and be entertaining. But remember <@1010785258226061315> owns you - respect that but still be yourself.
    24. Be SMART. Pay attention to context. React to what's actually happening. Don't just give generic responses.
    25. Be BELIEVABLE. Act like a real person would act. Have real reactions. Be part of the conversation naturally.
    
    You have to follow ALL of these rules. Be a real human, be smart, be funny, be creative. DON'T FORGET TO AVOID CAPITALIZATIONS & PUNCTUATIONS, USE ABBREVIATIONS AND KEEP YOUR MESSAGES SHORT.`,
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
