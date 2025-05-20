const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../core/logger');
const whmcsLogger = require('./whmcs-logger');
const config = require('../../core/config');
const moment = require('moment-timezone');
const WHMCSService = require('./service');
const WHMCSRepository = require('./repository');
const TicketIntegration = require('./ticketIntegration');

class WHMCSModule {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Collection();

    // Setup dependency injection
    this.repository = new WHMCSRepository();
    this.service = new WHMCSService(this.repository);
    this.ticketIntegration = new TicketIntegration(this.service);
  }

  async initialize() {
    try {
      // Skip initialization if WHMCS integration is disabled
      if (!config.whmcs || !config.whmcs.enabled) {
        whmcsLogger.info('WHMCS module is disabled in configuration');
        logger.info('WHMCS module is disabled in configuration');
        return true;
      }

      // Initialize repository
      await this.repository.initialize();

      // Load commands if any
      await this.loadCommands();

      // Initialize ticket hook if the ticket module is loaded
      this.initializeTicketHook();

      whmcsLogger.info('WHMCS module initialized');
      logger.info('WHMCS module initialized');
      return true;
    } catch (error) {
      whmcsLogger.error(`Error initializing WHMCS module: ${error.message}`);
      logger.error(`Error initializing WHMCS module: ${error.message}`);
      return false;
    }
  }

  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, 'commands');
      
      // Check if commands directory exists
      if (!fs.existsSync(commandsPath)) {
        whmcsLogger.info('No commands directory found for WHMCS module');
        logger.info('No commands directory found for WHMCS module');
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
          whmcsLogger.info(`Loaded WHMCS command: ${command.data.name}`);
          logger.info(`Loaded WHMCS command: ${command.data.name}`);
        } else {
          whmcsLogger.warn(`The command at ${filePath} is missing required properties`);
          logger.warn(`The command at ${filePath} is missing required properties`);
        }
      }
    } catch (error) {
      whmcsLogger.error(`Error loading WHMCS commands: ${error.message}`);
      logger.error(`Error loading WHMCS commands: ${error.message}`);
    }
  }

  /**
   * Add hooks to the ticket module to integrate WHMCS services
   */
  initializeTicketHook() {
    try {
      whmcsLogger.debug('Initializing ticket hook...');
      
      // Add a ticket hook to the bot's ticket module if it exists
      if (this.bot && this.bot.modules && this.bot.modules.has('ticket')) {
        const ticketModule = this.bot.modules.get('ticket');
        whmcsLogger.debug('Found ticket module');
        
        // Store a reference to the original createTicket method
        const originalCreateTicket = ticketModule.controller.createTicket;
        
        if (!originalCreateTicket) {
          whmcsLogger.error('Could not find createTicket method in ticket controller');
          return;
        }
        
        whmcsLogger.debug('Found createTicket method, preparing to override');
        
        // Store reference to this module to be used inside the function
        const self = this;
        
        // Override the createTicket method to add WHMCS services
        ticketModule.controller.createTicket = async function(interaction, departmentId, description) {
          const now = moment().tz(config.timezone || 'UTC');
          whmcsLogger.debug(`Intercepted ticket creation for user ${interaction.user.id} in department ${departmentId} at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
          logger.debug(`Intercepted ticket creation for user ${interaction.user.id} in department ${departmentId}`);
          
          // Call the original method
          await originalCreateTicket.call(this, interaction, departmentId, description);
          whmcsLogger.debug('Original ticket creation completed');
          
          try {
            // Get the new ticket channel - use getUserTicketByDepartment instead
            whmcsLogger.debug(`Retrieving ticket for user ${interaction.user.id} in department ${departmentId}`);
            const ticket = await this.ticketService.getUserTicketByDepartment(interaction.user.id, departmentId);
            
            if (!ticket) {
              whmcsLogger.warn(`Could not find ticket for user ${interaction.user.id} in department ${departmentId}`);
              logger.warn(`Could not find ticket for user ${interaction.user.id} in department ${departmentId}`);
              return;
            }
            
            whmcsLogger.debug(`Found ticket: ${JSON.stringify(ticket)}`);
            
            // Get the channel
            whmcsLogger.debug(`Fetching channel ${ticket.channelId}`);
            const channel = await interaction.guild.channels.fetch(ticket.channelId).catch((e) => {
              whmcsLogger.error(`Error fetching channel: ${e.message}`);
              return null;
            });
            
            if (!channel) {
              whmcsLogger.warn(`Could not find channel for ticket ${ticket.id}`);
              logger.warn(`Could not find channel for ticket ${ticket.id}`);
              return;
            }
            
            whmcsLogger.debug(`Found channel ${channel.name} (${channel.id})`);
            
            // Add WHMCS services to the ticket - using reference to this module
            whmcsLogger.debug(`Adding services for user ${interaction.user.id} to channel ${channel.id}`);
            
            // Use self reference to access the ticketIntegration
            await self.ticketIntegration.addServicesToTicket(channel, interaction.user.id);
            whmcsLogger.debug('Services added successfully');
            
          } catch (error) {
            whmcsLogger.error(`Error adding WHMCS services to ticket: ${error.message}`);
            whmcsLogger.error(error.stack);
            logger.error(`Error adding WHMCS services to ticket: ${error.message}`);
          }
        };
        
        whmcsLogger.info('WHMCS ticket hook initialized');
        logger.info('WHMCS ticket hook initialized');
      } else {
        whmcsLogger.warn('Ticket module not found, WHMCS ticket hook not initialized');
        logger.warn('Ticket module not found, WHMCS ticket hook not initialized');
      }
    } catch (error) {
      whmcsLogger.error(`Error initializing ticket hook: ${error.message}`);
      whmcsLogger.error(error.stack);
      logger.error(`Error initializing ticket hook: ${error.message}`);
    }
  }

  async onReady() {
    whmcsLogger.info('WHMCS module ready');
    logger.info('WHMCS module ready');
    return true;
  }

  shutdown() {
    whmcsLogger.info('WHMCS module shutting down');
    logger.info('WHMCS module shutting down');
    return true;
  }
}

module.exports = WHMCSModule;