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
  constructor(db) {
    this.db = db;
    this.userConcurrency = new Map(); // Track concurrent requests per user
    this.llm = null;
    this.initializeLLM();
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
        temperature: 0.8,
        model: 'llama-3.1-8b-instant',
        maxTokens: 256,
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

  async getConversationHistory(userId) {
    const result = await this.db.get(
      'SELECT history FROM ai_conversations WHERE userId = ?',
      [userId]
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

  async saveConversationHistory(userId, history) {
    const limitedHistory = history.slice(-AI_CONFIG.Max_Conversation_History);
    await this.db.run(
      `INSERT OR REPLACE INTO ai_conversations (userId, history) VALUES (?, ?)`,
      [userId, JSON.stringify(limitedHistory)]
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

  async getAIResponse(message, history, author) {
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

      const escapedMessage = this.escapeTemplateString(message);
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

    if (!this.llm) {
      return false;
    }

    try {
      let cleanContent = message.cleanContent || message.content;

      // Handle message references
      if (message.reference?.messageId) {
        const referencedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (referencedMsg?.content) {
          // Escape the reference message content
          const escapedRefContent = this.escapeTemplateString(referencedMsg.content);
          const escapedAuthor = this.escapeTemplateString(referencedMsg.author.username);
          cleanContent += `\n[Reference Message]: message: ${escapedRefContent}, author: ${escapedAuthor}`;
        }
      }

      // Get conversation history
      let history = await this.getConversationHistory(message.author.id);
      history = this.setSystemMessages(history, message.member);

      // Show typing indicator
      await message.channel.sendTyping();

      // Get AI response
      const response = await this.getAIResponse(cleanContent, history, message.member);

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

      // Update conversation history
      const newHistory = [
        ...history.slice(-AI_CONFIG.Max_Conversation_History),
        ['human', cleanContent],
        ['ai', truncatedContent],
      ];

      await this.saveConversationHistory(message.author.id, newHistory);

      return true;
    } catch (error) {
      console.error('Error handling AI message:', error);
      return false;
    }
  }
}

module.exports = AIManager;

