const Bot = require('./core/bot');
const logger = require('./core/logger');
const { registerCommands } = require('./deploy-commands');

// Handle process termination gracefully
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

let bot = null;

async function start() {
  try {
    logger.info('Starting Discord Ticket Bot...');
    
    // Create and initialize bot
    bot = new Bot();
    
    // Register slash commands
    logger.info('Registering application commands...');
    await registerCommands();
    
    // Start the bot
    await bot.start();
    
    logger.info('Bot startup complete!');
  } catch (error) {
    logger.error(`Failed to start bot: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

async function handleShutdown(signal) {
  logger.info(`Received ${signal || 'shutdown'} signal, shutting down gracefully...`);
  
  if (bot) {
    try {
      await bot.shutdown();
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
    }
  }
  
  process.exit(0);
}

// Start the bot
start();