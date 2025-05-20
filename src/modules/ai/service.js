const { v4: uuidv4 } = require('uuid');
const logger = require('../../core/logger');
const config = require('../../core/config');
const gemini = require('./gemini');
const ConversationContext = require('./context');
const aiLogger = require('./ai-logger');

// Import service-hours module if available
let serviceHoursModule;
try {
  serviceHoursModule = require('../service-hours');
  logger.info('Service hours module loaded for AI service');
} catch (error) {
  logger.info('Service hours module not available, hours functionality will be disabled');
}

class AIService {
  constructor(repository) {
    this.repository = repository;
    this.context = new ConversationContext(repository);
  }

  /**
   * Initialize the AI service
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Initialize the Gemini API
      const success = await gemini.initialize();
      if (!success) {
        logger.warn('AI functionality will be disabled');
      }
      
      return success;
    } catch (error) {
      logger.error(`Error initializing AI service: ${error.message}`);
      return false;
    }
  }

  /**
   * Process a user message and generate an AI response
   * @param {Object} ticket - The ticket object
   * @param {string} userMessage - The user's message
   * @returns {Promise<string>} The AI response
   */
  async processMessage(ticket, userMessage) {
    try {
      // Skip AI processing if disabled
      if (!config.ai || !config.ai.enabled || !gemini.isInitialized()) {
        logger.warn('AI processing skipped: AI is disabled or not initialized');
        return null;
      }

      // If ticket is waiting for staff, don't respond with AI
      if (ticket.status === 'waitingStaff') {
        logger.info(`Ticket ${ticket.id} is waiting for staff, skipping AI response`);
        return null;
      }

      logger.info(`Processing message for ticket ${ticket.id} in department ${ticket.departmentId}`);

      // Add the user message to the context
      await this.context.addMessage(ticket.id, userMessage, true);

      // Get the context history
      const contextData = await this.context.getContext(ticket.id);

      // Format for Gemini
      const chatHistory = gemini.formatChatHistory(contextData.messages);

      // Log chat history count
      logger.info(`Chat history contains ${chatHistory.length} messages`);

      // Generate the response, passing the repository and context data
      const response = await gemini.generateResponse(
        chatHistory,
        ticket.departmentId,
        this.repository,
        contextData,  // Pass the full context data including any system prompts
        ticket.id     // Pass the ticket ID for logging
      );

      // Add the AI response to the context
      await this.context.addMessage(ticket.id, response, false);

      // Mark the ticket as AI handled if not already
      if (!ticket.ai_handled) {
        await this.repository.updateTicketAIHandled(ticket.id, true);
      }

      return response;
    } catch (error) {
      logger.error(`Error processing AI message: ${error.message}`);
      return "很抱歉，我在處理您的訊息時遇到問題。如需進一步協助，請考慮轉接給人工客服。";
    }
  }

  /**
   * Get an AI prompt for a department
   * @param {string} departmentId - The department ID or null for default
   * @returns {Promise<Object>} The prompt object
   */
  async getPrompt(departmentId = null) {
    try {
      return await this.repository.getAIPrompt(departmentId);
    } catch (error) {
      logger.error(`Error getting AI prompt: ${error.message}`);
      return null;
    }
  }

  /**
   * Update or create an AI prompt
   * @param {string} departmentId - The department ID or null for default
   * @param {string} promptText - The prompt text
   * @returns {Promise<boolean>} Success status
   */
  async updatePrompt(departmentId, promptText) {
    try {
      return await this.repository.saveAIPrompt(departmentId, promptText);
    } catch (error) {
      logger.error(`Error updating AI prompt: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if it's currently within service hours
   * @param {string} guildId - The guild ID
   * @returns {Promise<boolean>} Whether it's within service hours
   */
  async isWithinServiceHours(guildId) {
    try {
      // If service hours module is available, use it
      if (serviceHoursModule && serviceHoursModule.service) {
        const result = await serviceHoursModule.service.isWithinServiceHours(guildId);
        logger.debug(`Service hours check result: ${result}, guildId: ${guildId}, timezone: ${config.timezone}`);
        return result;
      }
      
      // Otherwise, default to always within service hours
      logger.info('Service hours module not available, assuming within service hours');
      return true;
    } catch (error) {
      logger.error(`Error checking service hours: ${error.message}`);
      // Default to true in case of error
      return true;
    }
  }

  /**
   * Get the off-hours message
   * @returns {string} The off-hours message
   */
  getOffHoursMessage() {
    // If service hours module is available, use it
    if (serviceHoursModule && serviceHoursModule.service) {
      const message = serviceHoursModule.service.getOffHoursMessage();
      logger.debug(`AI service got off-hours message: ${message}`);
      return message;
    }
    
    // Otherwise, use default from config or fallback
    const defaultMessage = config.serviceHours?.offHoursMessage ||
      '感謝您的來訊，我們目前非客服營業時間。您可以留下相關訊息，我們將會在下一個工作日盡速回覆您。';
    
    // Add timezone info to the default message
    const timezone = config.timezone || 'Asia/Taipei';
    const now = moment.tz(timezone);
    const message = `${defaultMessage}\n\n當前時間: ${now.format('YYYY-MM-DD HH:mm:ss')} (${timezone})`;
    
    logger.debug(`AI service using default off-hours message: ${message}`);
    return message;
  }

  /**
   * Get the new ticket off-hours message
   * @returns {string} The new ticket off-hours message
   */
  getNewTicketOffHoursMessage() {
    // If service hours module is available, use it
    if (serviceHoursModule && serviceHoursModule.service) {
      const message = serviceHoursModule.service.getNewTicketOffHoursMessage();
      logger.debug(`AI service got new ticket off-hours message: ${message}`);
      return message;
    }
    
    // Otherwise, use default from config or fallback
    const defaultMessage = config.serviceHours?.newTicketOffHoursMessage ||
      '目前非客服處理時間，您可以先善用 AI 客服協助處理您的問題，如果無法解決再請轉為專人客服，我們會在下一個工作日盡速為您服務。';
    
    // Add timezone info to the default message
    const timezone = config.timezone || 'Asia/Taipei';
    const now = moment.tz(timezone);
    const message = `${defaultMessage}\n\n當前時間: ${now.format('YYYY-MM-DD HH:mm:ss')} (${timezone})`;
    
    logger.debug(`AI service using default new ticket off-hours message: ${message}`);
    return message;
  }
}

module.exports = AIService;