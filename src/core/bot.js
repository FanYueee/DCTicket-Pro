const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const database = require('./database');

class Bot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });

    this.commands = new Collection();
    this.modules = new Map();
    
    this.client.once(Events.ClientReady, this.onReady.bind(this));
    this.client.on(Events.InteractionCreate, this.onInteraction.bind(this));
  }

  async start() {
    try {
      logger.info('Starting bot initialization...');
      
      // Initialize database before connecting to Discord
      await database.initialize();
      
      // Load all available modules
      await this.loadModules();
      
      // Finally, log in to Discord
      await this.client.login(config.token);
      
      logger.info('Bot initialization completed.');
    } catch (error) {
      logger.error(`Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  async loadModules() {
    try {
      const modulesPath = path.join(__dirname, '..', 'modules');
      const modulesFolders = fs.readdirSync(modulesPath).filter(file => {
        return fs.statSync(path.join(modulesPath, file)).isDirectory();
      });

      for (const folder of modulesFolders) {
        const modulePath = path.join(modulesPath, folder);
        
        // Check if the module has an index.js file
        const indexFile = path.join(modulePath, 'index.js');
        if (fs.existsSync(indexFile)) {
          const moduleClass = require(indexFile);
          if (typeof moduleClass === 'function') {
            // Create a new instance of the module and initialize it
            const moduleInstance = new moduleClass(this);
            if (typeof moduleInstance.initialize === 'function') {
              await moduleInstance.initialize();
            }
            this.modules.set(folder, moduleInstance);
            logger.info(`Loaded module: ${folder}`);
            
            // Load commands from this module if it has them
            if (moduleInstance.commands && moduleInstance.commands.size > 0) {
              moduleInstance.commands.forEach((command, name) => {
                this.commands.set(name, command);
              });
              logger.info(`Registered ${moduleInstance.commands.size} commands from module: ${folder}`);
            }
          }
        }
      }
      
      logger.info(`Loaded ${this.modules.size} modules with ${this.commands.size} total commands`);
    } catch (error) {
      logger.error(`Error loading modules: ${error.message}`);
      throw error;
    }
  }

  async onReady() {
    logger.info(`Bot logged in as ${this.client.user.tag}`);
    
    // Initialize all loaded modules that have an onReady method
    for (const [name, module] of this.modules.entries()) {
      if (typeof module.onReady === 'function') {
        try {
          await module.onReady();
          logger.info(`Module ${name} is ready`);
        } catch (error) {
          logger.error(`Error initializing module ${name}: ${error.message}`);
        }
      }
    }
  }

  async onInteraction(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
      } else {
        // Dispatch interaction to all modules that have an onInteraction method
        for (const [name, module] of this.modules.entries()) {
          if (typeof module.onInteraction === 'function') {
            const handled = await module.onInteraction(interaction);
            if (handled) break; // Stop if a module handled the interaction
          }
        }
      }
    } catch (error) {
      logger.error(`Error handling interaction: ${error.message}`);
      logger.error(error.stack);
      
      // Reply to the user if possible
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error processing your request.',
          ephemeral: true
        }).catch(err => logger.error(`Could not send followUp: ${err.message}`));
      } else {
        await interaction.reply({
          content: 'There was an error processing your request.',
          ephemeral: true
        }).catch(err => logger.error(`Could not reply to interaction: ${err.message}`));
      }
    }
  }

  getModule(name) {
    return this.modules.get(name);
  }

  async shutdown() {
    logger.info('Bot shutdown initiated...');
    
    // Call shutdown method on all modules that have one
    for (const [name, module] of this.modules.entries()) {
      if (typeof module.shutdown === 'function') {
        try {
          await module.shutdown();
          logger.info(`Module ${name} shut down successfully`);
        } catch (error) {
          logger.error(`Error shutting down module ${name}: ${error.message}`);
        }
      }
    }
    
    // Close database connection
    await database.close().catch(err => logger.error(`Error closing database: ${err.message}`));
    
    // Destroy the client
    if (this.client) {
      this.client.destroy();
      logger.info('Discord client destroyed');
    }
    
    logger.info('Bot shutdown completed');
  }
}

module.exports = Bot;