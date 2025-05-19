const { REST, Routes } = require('discord.js');
const config = require('./core/config');
const logger = require('./core/logger');

async function clearCommands() {
  try {
    // Check if we have required config
    if (!config.token) {
      logger.error('Missing BOT_TOKEN in environment configuration.');
      return;
    }
    if (!config.clientId) {
      logger.error('Missing CLIENT_ID in environment configuration.');
      return;
    }

    // Create and configure REST instance
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      logger.info('Started clearing application commands...');

      let data;
      if (config.guildId) {
        // Clear guild specific commands
        data = await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: [] },
        );
        logger.info(`Successfully cleared all guild commands for guild ID: ${config.guildId}`);
      } else {
        // Clear global commands
        data = await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: [] },
        );
        logger.info('Successfully cleared all global commands.');
      }

      logger.info('Command clearing complete.');
    } catch (error) {
      logger.error(`Error clearing commands: ${error.message}`);
      if (error.rawError) {
        logger.error(`API Error: ${JSON.stringify(error.rawError)}`);
      }
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  clearCommands();
}

module.exports = { clearCommands };