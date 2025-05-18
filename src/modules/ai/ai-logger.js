const fs = require('fs');
const path = require('path');
const config = require('../../core/config');
const logger = require('../../core/logger');

class AILogger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'ai');
    this.initLogDirectory();
  }

  /**
   * Initialize the log directory
   */
  initLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      logger.error(`Failed to create AI log directory: ${error.message}`);
    }
  }

  /**
   * Generate a timestamped log filename
   * @returns {string} The log filename
   */
  getLogFilename() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `ai-log-${dateStr}.json`);
  }

  /**
   * Log an AI interaction
   * @param {Object} data - The data to log
   */
  logInteraction(data) {
    try {
      const logFile = this.getLogFilename();
      const timestamp = new Date().toISOString();
      
      // Add timestamp to the log entry
      const logEntry = {
        timestamp,
        ...data
      };
      
      // Format the log entry
      const logStr = JSON.stringify(logEntry, null, 2);
      
      // Append to the log file
      fs.appendFileSync(logFile, logStr + ',\n');
      
      // Also log a summary to the main log
      logger.info(`AI Interaction [${data.interactionType}] - Ticket: ${data.ticketId}, Dept: ${data.departmentId}`);
    } catch (error) {
      logger.error(`Failed to log AI interaction: ${error.message}`);
    }
  }

  /**
   * Log an AI prompt
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {string} systemPrompt - The system prompt
   */
  logPrompt(ticketId, departmentId, systemPrompt) {
    this.logInteraction({
      interactionType: 'SYSTEM_PROMPT',
      ticketId,
      departmentId,
      systemPrompt
    });
  }

  /**
   * Log a user message
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {string} userMessage - The user message
   */
  logUserMessage(ticketId, departmentId, userMessage) {
    this.logInteraction({
      interactionType: 'USER_MESSAGE',
      ticketId,
      departmentId,
      userMessage
    });
  }

  /**
   * Log an AI response
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {string} userMessage - The user message that triggered the response
   * @param {string} aiResponse - The AI response
   */
  logResponse(ticketId, departmentId, userMessage, aiResponse) {
    this.logInteraction({
      interactionType: 'AI_RESPONSE',
      ticketId,
      departmentId,
      userMessage,
      aiResponse
    });
  }

  /**
   * Log the chat history and context
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {Array} chatHistory - The chat history
   * @param {Object} contextData - The full context data
   */
  logChatContext(ticketId, departmentId, chatHistory, contextData) {
    this.logInteraction({
      interactionType: 'CHAT_CONTEXT',
      ticketId,
      departmentId,
      chatHistory,
      contextData
    });
  }

  /**
   * Log an error in AI processing
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {string} errorMessage - The error message
   * @param {string} context - Additional context
   */
  logError(ticketId, departmentId, errorMessage, context = '') {
    this.logInteraction({
      interactionType: 'ERROR',
      ticketId,
      departmentId,
      errorMessage,
      context
    });
  }
}

module.exports = new AILogger();