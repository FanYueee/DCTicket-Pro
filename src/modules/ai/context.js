const logger = require('../../core/logger');
const config = require('../../core/config');
const moment = require('moment-timezone');

class ConversationContext {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Initialize a new conversation context for a ticket
   * @param {string} ticketId - The ticket ID
   * @param {string} description - Initial ticket description
   * @returns {Promise<boolean>} Success status
   */
  async initializeContext(ticketId, description = null, departmentId = null) {
    try {
      // Create context with initial ticket description if provided
      const messages = [];

      // Add a special system message as the first message in the conversation
      // This ensures the AI understands its role from the beginning
      if (departmentId) {
        try {
          // Try to get the appropriate department prompt
          const aiRepository = require('./repository');
          const repository = new aiRepository();
          const gemini = require('./gemini');
          const systemPrompt = await gemini.getDepartmentPrompt(departmentId, repository);

          // Add the system prompt as a non-user message (isUser: false means it's from the system)
          messages.push({
            content: systemPrompt,
            isUser: false,
            isSystemPrompt: true,
            timestamp: moment().tz(config.timezone || 'UTC').toISOString()
          });

          logger.info(`Added system prompt for department ${departmentId} to conversation context`);
        } catch (error) {
          logger.error(`Error adding system prompt to context: ${error.message}`);
        }
      }

      // Add the user's description as the second message
      if (description) {
        messages.push({
          content: description,
          isUser: true,
          timestamp: moment().tz(config.timezone || 'UTC').toISOString()
        });
      }

      const context = JSON.stringify({
        messages: messages
      });

      return await this.repository.saveAIContext(ticketId, context);
    } catch (error) {
      logger.error(`Error initializing conversation context: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the conversation context for a ticket
   * @param {string} ticketId - The ticket ID
   * @returns {Promise<Object>} The conversation context
   */
  async getContext(ticketId) {
    try {
      const contextData = await this.repository.getAIContext(ticketId);
      if (!contextData) {
        // Create a new context if none exists
        await this.initializeContext(ticketId);
        return { messages: [] };
      }
      
      return JSON.parse(contextData.context);
    } catch (error) {
      logger.error(`Error getting conversation context: ${error.message}`);
      return { messages: [] };
    }
  }

  /**
   * Add a message to the conversation context
   * @param {string} ticketId - The ticket ID
   * @param {string} content - The message content
   * @param {boolean} isUser - Whether the message is from the user
   * @returns {Promise<boolean>} Success status
   */
  async addMessage(ticketId, content, isUser) {
    try {
      // Get the current context
      const context = await this.getContext(ticketId);
      
      // Add the new message
      context.messages.push({
        content,
        isUser,
        timestamp: moment().tz(config.timezone || 'UTC').toISOString()
      });
      
      // Keep only the last 10 messages to manage context size
      if (context.messages.length > 10) {
        context.messages = context.messages.slice(-10);
      }
      
      // Save the updated context
      return await this.repository.saveAIContext(ticketId, JSON.stringify(context));
    } catch (error) {
      logger.error(`Error adding message to context: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset the conversation context for a ticket
   * @param {string} ticketId - The ticket ID
   * @returns {Promise<boolean>} Success status
   */
  async resetContext(ticketId) {
    return await this.initializeContext(ticketId);
  }
}

module.exports = ConversationContext;