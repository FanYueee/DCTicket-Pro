const { Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../core/logger');
const config = require('../../core/config');
const TicketController = require('./controller');
const TicketService = require('./service');
const TicketRepository = require('./repository');
const { service: aiService } = require('../ai');

class TicketModule {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Collection();

    // Setup dependency injection
    this.repository = new TicketRepository();
    this.service = new TicketService(this.repository);
    this.controller = new TicketController(this.service);

    // Bind event handler methods to this instance
    this.onInteraction = this.onInteraction.bind(this);
    this.onMessage = this.onMessage.bind(this);
  }

  async initialize() {
    try {
      // Initialize repository
      await this.repository.initialize();

      // Load commands
      await this.loadCommands();

      // Initialize AI service if enabled
      if (config.ai && config.ai.enabled) {
        await aiService.initialize();
        logger.info('AI service initialized for ticket module');
      }

      logger.info('Ticket module initialized');
      return true;
    } catch (error) {
      logger.error(`Error initializing ticket module: ${error.message}`);
      throw error;
    }
  }

  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, 'commands');
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
          logger.info(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`The command at ${filePath} is missing required properties`);
        }
      }
    } catch (error) {
      logger.error(`Error loading ticket commands: ${error.message}`);
      throw error;
    }
  }

  async onReady() {
    try {
      // Check for existing panels and restore them
      await this.controller.restorePanels(this.bot.client);
      return true;
    } catch (error) {
      logger.error(`Error in ticket module onReady: ${error.message}`);
      return false;
    }
  }

  async onInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        // Handle button interactions
        if (interaction.customId.startsWith('create_ticket:')) {
          const departmentId = interaction.customId.split(':')[1];
          await this.controller.startTicketCreation(interaction, departmentId);
          return true;
        }
        else if (interaction.customId === 'close_ticket') {
          await this.controller.closeTicket(interaction);
          return true;
        }
        else if (interaction.customId === 'human_handoff') {
          await this.controller.handleHumanHandoff(interaction);
          return true;
        }
        else if (interaction.customId.startsWith('confirm_close:')) {
          const action = interaction.customId.split(':')[1];
          if (action === 'yes') {
            await this.controller.confirmCloseTicket(interaction);
          } else {
            await interaction.update({ content: '取消了關閉操作。', components: [], embeds: [] });
          }
          return true;
        }
      }
      else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        if (interaction.customId.startsWith('ticket_create_modal:')) {
          const departmentId = interaction.customId.split(':')[1];
          const description = interaction.fields.getTextInputValue('ticketDescription');
          await this.controller.createTicket(interaction, departmentId, description);
          return true;
        }
        else if (interaction.customId.startsWith('edit_prompt:')) {
          const departmentOption = interaction.customId.split(':')[1];
          const promptHandler = require('../ai/commands/prompt').handlePromptEditSubmit;
          await promptHandler(interaction, departmentOption);
          return true;
        }
      }

      // If we got here, this interaction wasn't for us
      return false;
    } catch (error) {
      logger.error(`Error handling ticket interaction: ${error.message}`);
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
      return true; // We handled it, even though there was an error
    }
  }

  /**
   * Handle message events for AI processing in ticket channels
   * @param {Message} message - The Discord message
   * @returns {Promise<boolean>} Whether the message was handled
   */
  async onMessage(message) {
    // Only process messages if AI is enabled
    if (!config.ai || !config.ai.enabled) return false;

    try {
      // Check if this is a ticket channel
      const ticket = await this.repository.getTicketByChannelId(message.channel.id);
      if (!ticket) return false; // Not a ticket channel, let other modules handle it
      
      // Pass message to controller for AI processing
      await this.controller.handleTicketMessage(message);
      
      // Always return true if it's a ticket channel, even if there's an error
      // This prevents other modules from also trying to handle this message
      return true;
    } catch (error) {
      logger.error(`Error handling message in ticket module: ${error.message}`);
      // Still return true to prevent other modules from processing this message
      // as long as we've identified it as a ticket channel message
      return true;
    }
  }

  async shutdown() {
    // No specific cleanup needed yet
    logger.info('Ticket module shutting down');
    return true;
  }
}

module.exports = TicketModule;