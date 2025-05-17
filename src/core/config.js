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
  useCategoryChannels: true
};