const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../core/logger');
const config = require('../../core/config');
const AIRepository = require('./repository');
const AIService = require('./service');
const gemini = require('./gemini');

class AIModule {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Collection();
    
    // Create singleton instances
    this.repository = new AIRepository();
    this.service = new AIService(this.repository);
    
    // Bind event handler methods to this instance
    this.onInteraction = this.onInteraction.bind(this);
  }
  
  async initialize() {
    try {
      // Initialize Gemini API
      const aiEnabled = config.ai && config.ai.enabled;
      if (aiEnabled) {
        await gemini.initialize();
        logger.info('Gemini API initialized successfully');
      } else {
        logger.info('AI functionality is disabled in config');
      }
      
      // Load AI commands
      await this.loadCommands();
      
      logger.info('AI module initialized');
      return true;
    } catch (error) {
      logger.error(`Error initializing AI module: ${error.message}`);
      return false;
    }
  }
  
  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, 'commands');
      
      if (!fs.existsSync(commandsPath)) {
        logger.warn(`AI commands directory does not exist: ${commandsPath}`);
        return;
      }
      
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Set references to the module in the command
        if (command.setModule) {
          command.setModule(this);
        }
        
        // Register the command
        if ('data' in command && 'execute' in command) {
          this.commands.set(command.data.name, command);
          logger.info(`Loaded AI command: ${command.data.name}`);
        } else {
          logger.warn(`The command at ${filePath} is missing required properties`);
        }
      }
    } catch (error) {
      logger.error(`Error loading AI commands: ${error.message}`);
    }
  }
  
  async onReady() {
    logger.info('AI module ready');
    return true;
  }
  
  /**
   * Handle interactions related to the AI module
   * @param {Interaction} interaction - The Discord interaction
   * @returns {Promise<boolean>} Whether the interaction was handled
   */
  async onInteraction(interaction) {
    try {
      // Handle message context menu commands
      if (interaction.isMessageContextMenuCommand()) {
        // Find the command in our collection
        const command = this.commands.get(interaction.commandName);
        if (command) {
          await command.execute(interaction);
          return true; // We handled this interaction
        }
      }
      
      // If we got here, this interaction wasn't for us
      return false;
    } catch (error) {
      logger.error(`Error handling AI interaction: ${error.message}`);
      logger.error(error.stack);
      
      // Try to respond to the user
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '處理您的請求時發生錯誤。', ephemeral: true });
        } else {
          await interaction.reply({ content: '處理您的請求時發生錯誤。', ephemeral: true });
        }
      } catch (responseError) {
        logger.error(`Could not respond to interaction: ${responseError.message}`);
      }
      
      return true; // We tried to handle it, even though there was an error
    }
  }
  
  async shutdown() {
    logger.info('AI module shutting down');
    return true;
  }
}

// For singleton access to the repository and service
const repository = new AIRepository();
const service = new AIService(repository);

module.exports = AIModule;
module.exports.repository = repository;
module.exports.service = service;
module.exports.gemini = gemini;