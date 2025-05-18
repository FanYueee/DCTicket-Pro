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