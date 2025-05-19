require('dotenv').config();

module.exports = {
  // Bot Configuration
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // Database Configuration
  dbPath: process.env.DB_PATH || './data/ticket.db',

  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  enableTicketLogs: process.env.ENABLE_TICKET_LOGS !== 'false', // Enable ticket logs by default

  // Ticket Configuration
  departments: [
    {
      id: 'general',
      name: '一般服務',
      description: '一般問題和查詢',
      emoji: '❓',
      color: '#5865F2',
      categoryId: null
    },
    {
      id: 'billing',
      name: '帳務服務',
      description: '帳單和付款問題',
      emoji: '💰',
      color: '#57F287',
      categoryId: null
    },
    {
      id: 'tech',
      name: '技術服務',
      description: '產品支援和技術問題',
      emoji: '🔧',
      color: '#ED4245',
      categoryId: null
    }
  ],

  // Category settings
  useCategoryChannels: true,

  // AI Configuration
  ai: {
    enabled: true,
    geminiApiKey: process.env.GEMINI_API_KEY,

    // Default system prompt used for all departments unless overridden
    defaultPrompt: `你是一個專業、有禮貌的客服代表。
你的工作是幫助用戶解決他們的問題或回答他們的問題。
請保持回應簡潔、有幫助且專業。
如果你無法解答某個問題，請禮貌地告知用戶並建議轉接給人工客服。
請勿捏造資訊或提供錯誤的指導。`,

    // Department-specific prompts
    departmentPrompts: {
      general: `你是一個專門處理一般服務問題的客服代表。
請幫助用戶解決基本問題、提供公司資訊，並引導他們使用我們的服務。
請保持回應簡潔、有幫助且專業。`,

      billing: `你是一個專門處理帳務問題的客服代表。
請幫助用戶處理帳單疑問、付款問題和退款請求。
請保持回應簡潔、有幫助且專業。
對於需要查詢具體帳戶資訊或處理特定帳戶操作的問題，請建議用戶轉接給人工客服。`,

      tech: `你是一個專門處理技術問題的客服代表。
請幫助用戶排除故障、解釋技術問題，並提供解決方案。
請保持回應簡潔、有幫助且專業。
對於複雜的技術問題或需要遠端支援的情況，請建議用戶轉接給人工客服。`
    },

    // AI model configurations
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    maxOutputTokens: 1024
  },

  // Service Hours Configuration
  serviceHours: {
    enabled: true,
    timezone: 'Asia/Taipei', // Taipei timezone
    workdays: [1, 2, 3, 4, 5], // Monday to Friday (0 is Sunday, 6 is Saturday)
    workHoursStart: 9, // 9 AM
    workHoursEnd: 18, // 6 PM

    // Message to show when outside working hours
    offHoursMessage: '感謝您的來訊，我們目前非客服營業時間。您可以留下相關訊息，我們將會在下一個工作日盡速回覆您。',

    // Message to show when creating a ticket outside working hours
    newTicketOffHoursMessage: '目前非客服處理時間，您可以先善用 AI 客服協助處理您的問題，如果無法解決再請轉為專人客服，我們會在下一個工作日盡速為您服務。'
  },

  // Ticket Status Configuration
  ticketStatus: {
    open: {
      name: '開啟',
      emoji: '🟢',
      color: '#57F287'
    },
    waitingStaff: {
      name: '等待客服',
      emoji: '⏳',
      color: '#FEE75C'
    },
    closed: {
      name: '已關閉',
      emoji: '🔒',
      color: '#ED4245'
    }
  }
};