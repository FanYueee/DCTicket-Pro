const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../core/logger');
const config = require('../../core/config');
const ServiceHoursRepository = require('./repository');
const ServiceHoursService = require('./service');

class ServiceHoursModule {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Collection();
    
    // Create singleton instances
    this.repository = new ServiceHoursRepository();
    this.service = new ServiceHoursService(this.repository);
    this.enabled = true; // Default to enabled
  }
  
  /**
   * Check if the module is enabled
   * @returns {boolean} Whether the module is enabled
   */
  isEnabled() {
    return this.enabled && (config.serviceHours?.enabled !== false);
  }
  
  /**
   * Enable or disable the module
   * @param {boolean} enabled - Whether to enable or disable
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`Service hours module ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  async initialize() {
    try {
      // Check if service hours are enabled in config
      if (config.serviceHours && config.serviceHours.enabled === false) {
        this.setEnabled(false);
        logger.info('Service hours functionality is disabled in config');
        return true;
      }
      
      // Load service hours commands
      await this.loadCommands();
      
      logger.info('Service hours module initialized');
      return true;
    } catch (error) {
      logger.error(`Error initializing service hours module: ${error.message}`);
      return false;
    }
  }
  
  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, 'commands');
      
      if (!fs.existsSync(commandsPath)) {
        logger.warn(`Service hours commands directory does not exist: ${commandsPath}`);
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
          logger.info(`Loaded service hours command: ${command.data.name}`);
        } else {
          logger.warn(`The command at ${filePath} is missing required properties`);
        }
      }
    } catch (error) {
      logger.error(`Error loading service hours commands: ${error.message}`);
    }
  }
  
  async onReady() {
    logger.info('Service hours module ready');
    return true;
  }
  
  async onInteraction(interaction) {
    try {
      if (!interaction.isChatInputCommand()) return false;
      
      const command = this.commands.get(interaction.commandName);
      if (!command) return false;
      
      // Execute the command with repository and service
      await command.execute(interaction, {
        repository: this.repository,
        service: this.service
      });
      
      return true;
    } catch (error) {
      logger.error(`Error handling service hours interaction: ${error.message}`);
      
      const errorMessage = {
        content: '❌ 執行指令時發生錯誤',
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
      
      return true;
    }
  }
  
  async shutdown() {
    logger.info('Service hours module shutting down');
    return true;
  }
}

// For singleton access to the repository and service
const repository = new ServiceHoursRepository();
const service = new ServiceHoursService(repository);

module.exports = ServiceHoursModule;
module.exports.repository = repository;
module.exports.service = service;