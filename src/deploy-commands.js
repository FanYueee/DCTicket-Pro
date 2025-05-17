const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./core/config');
const logger = require('./core/logger');

async function registerCommands() {
  try {
    const commands = [];
    const commandFolders = [];
    
    // Look for command files in the modules directory
    const modulesPath = path.join(__dirname, 'modules');
    const modulesFolders = fs.readdirSync(modulesPath).filter(file => {
      return fs.statSync(path.join(modulesPath, file)).isDirectory();
    });

    for (const folder of modulesFolders) {
      const modulePath = path.join(modulesPath, folder);
      const commandsPath = path.join(modulePath, 'commands');
      
      // Skip if the module doesn't have a commands directory
      if (!fs.existsSync(commandsPath)) continue;
      
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      if (commandFiles.length > 0) {
        commandFolders.push({ folder, count: commandFiles.length });
      }
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        } else {
          logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
      }
    }

    if (commands.length === 0) {
      logger.warn('No commands found to register.');
      return;
    }

    logger.info(`Found ${commands.length} commands across ${commandFolders.length} modules.`);
    commandFolders.forEach(cf => {
      logger.info(`- ${cf.folder}: ${cf.count} commands`);
    });

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
      logger.info(`Started refreshing ${commands.length} application commands.`);

      let data;
      // The put method is used to fully refresh all commands
      if (config.guildId) {
        // Guild specific commands (faster for testing)
        data = await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: commands },
        );
        logger.info(`Successfully registered ${data.length} guild commands for guild ID: ${config.guildId}`);
      } else {
        // Global commands (up to 1-hour delay to update)
        data = await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: commands },
        );
        logger.info(`Successfully registered ${data.length} global commands.`);
      }

      logger.info('Command registration complete.');
    } catch (error) {
      logger.error(`Error refreshing commands: ${error.message}`);
      if (error.rawError) {
        logger.error(`API Error: ${JSON.stringify(error.rawError)}`);
      }
    }
  } catch (error) {
    logger.error(`Error loading command files: ${error.message}`);
    logger.error(error.stack);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  registerCommands();
}

module.exports = { registerCommands };