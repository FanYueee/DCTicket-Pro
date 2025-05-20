const database = require('../../core/database');
const logger = require('../../core/logger');
const config = require('../../core/config');
const moment = require('moment-timezone');

class AIRepository {
  /**
   * Get an AI prompt for a department or the default prompt
   * @param {string} departmentId - The department ID or null for default
   * @returns {Promise<Object>} The prompt object
   */
  async getAIPrompt(departmentId = null) {
    try {
      let prompt;
      
      if (departmentId) {
        // Try to get department-specific prompt
        prompt = await database.get(
          'SELECT * FROM ai_prompts WHERE department_id = ?',
          [departmentId]
        );
      }
      
      // If no department-specific prompt, get the default
      if (!prompt) {
        prompt = await database.get(
          'SELECT * FROM ai_prompts WHERE is_default = 1'
        );
      }
      
      if (!prompt) return null;
      
      return {
        id: prompt.id,
        departmentId: prompt.department_id,
        promptText: prompt.prompt_text,
        isDefault: prompt.is_default === 1,
        createdAt: new Date(prompt.created_at),
        updatedAt: new Date(prompt.updated_at)
      };
    } catch (error) {
      logger.error(`Database error getting AI prompt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save or update an AI prompt
   * @param {string} departmentId - The department ID or null for default
   * @param {string} promptText - The prompt text
   * @returns {Promise<boolean>} Success status
   */
  async saveAIPrompt(departmentId, promptText) {
    try {
      const isDefault = !departmentId;
      const now = moment().tz(config.timezone || 'UTC').toISOString();
      
      // Check if prompt already exists
      const existingPrompt = await this.getAIPrompt(departmentId);
      
      if (existingPrompt) {
        // Update existing prompt
        await database.run(
          `UPDATE ai_prompts 
           SET prompt_text = ?, updated_at = ? 
           WHERE ${isDefault ? 'is_default = 1' : 'department_id = ?'}`,
          isDefault ? [promptText, now] : [promptText, now, departmentId]
        );
      } else {
        // Insert new prompt
        await database.run(
          `INSERT INTO ai_prompts 
           (department_id, prompt_text, is_default, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [departmentId, promptText, isDefault ? 1 : 0, now, now]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error saving AI prompt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get AI conversation context for a ticket
   * @param {string} ticketId - The ticket ID
   * @returns {Promise<Object>} The context object
   */
  async getAIContext(ticketId) {
    try {
      const context = await database.get(
        'SELECT * FROM ai_conversations WHERE ticket_id = ?',
        [ticketId]
      );
      
      if (!context) return null;
      
      return {
        ticketId: context.ticket_id,
        context: context.context,
        lastUpdated: new Date(context.last_updated)
      };
    } catch (error) {
      logger.error(`Database error getting AI context: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save AI conversation context for a ticket
   * @param {string} ticketId - The ticket ID
   * @param {string} context - The context JSON string
   * @returns {Promise<boolean>} Success status
   */
  async saveAIContext(ticketId, context) {
    try {
      const now = moment().tz(config.timezone || 'UTC').toISOString();
      
      // Check if context already exists
      const existingContext = await this.getAIContext(ticketId);
      
      if (existingContext) {
        // Update existing context
        await database.run(
          'UPDATE ai_conversations SET context = ?, last_updated = ? WHERE ticket_id = ?',
          [context, now, ticketId]
        );
      } else {
        // Insert new context
        await database.run(
          'INSERT INTO ai_conversations (ticket_id, context, last_updated) VALUES (?, ?, ?)',
          [ticketId, context, now]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error saving AI context: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update ticket AI handling status
   * @param {string} ticketId - The ticket ID
   * @param {boolean} aiHandled - Whether the ticket was handled by AI
   * @returns {Promise<boolean>} Success status
   */
  async updateTicketAIHandled(ticketId, aiHandled) {
    try {
      await database.run(
        'UPDATE tickets SET ai_handled = ?, updated_at = ? WHERE id = ?',
        [aiHandled ? 1 : 0, moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error updating ticket AI handled: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update ticket staff handling status
   * @param {string} ticketId - The ticket ID
   * @param {string} staffId - The staff user ID
   * @returns {Promise<boolean>} Success status
   */
  async assignTicketToStaff(ticketId, staffId) {
    try {
      await database.run(
        'UPDATE tickets SET human_handled = ?, staff_id = ?, updated_at = ? WHERE id = ?',
        [1, staffId, moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error assigning ticket to staff: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update ticket status
   * @param {string} ticketId - The ticket ID
   * @param {string} status - The new status
   * @returns {Promise<boolean>} Success status
   */
  async updateTicketStatus(ticketId, status) {
    try {
      await database.run(
        'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
        [status, moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error updating ticket status: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AIRepository;