const fs = require('fs');
const path = require('path');
const config = require('../../core/config');
const logger = require('../../core/logger');
const moment = require('moment-timezone');

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
    const now = moment().tz(config.timezone || 'UTC');
    const dateStr = now.format('YYYY-MM-DD');
    return path.join(this.logDir, `ai-log-${dateStr}.json`);
  }

  /**
   * Log an AI interaction
   * @param {Object} data - The data to log
   */
  logInteraction(data) {
    try {
      const logFile = this.getLogFilename();
      const timestamp = moment().tz(config.timezone || 'UTC').toISOString();
      
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
    // Ensure we have valid values to log
    const safeTicketId = ticketId || 'unknown';
    const safeDepartmentId = departmentId || 'unknown';
    const safeSystemPrompt = systemPrompt || '(default system prompt)';
    
    this.logInteraction({
      interactionType: 'SYSTEM_PROMPT',
      ticketId: safeTicketId,
      departmentId: safeDepartmentId,
      systemPrompt: safeSystemPrompt
    });
  }

  /**
   * Log a user message
   * @param {string} ticketId - The ticket ID
   * @param {string} departmentId - The department ID
   * @param {string} userMessage - The user message
   */
  logUserMessage(ticketId, departmentId, userMessage) {
    // Ensure we have valid values to log
    const safeTicketId = ticketId || 'unknown';
    const safeDepartmentId = departmentId || 'unknown';
    const safeUserMessage = userMessage || '(no content)';
    
    this.logInteraction({
      interactionType: 'USER_MESSAGE',
      ticketId: safeTicketId,
      departmentId: safeDepartmentId,
      userMessage: safeUserMessage
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
    // Ensure we have valid values to log
    const safeTicketId = ticketId || 'unknown';
    const safeDepartmentId = departmentId || 'unknown';
    const safeUserMessage = userMessage || '(no content)';
    const safeAiResponse = aiResponse || '(no response)';
    
    this.logInteraction({
      interactionType: 'AI_RESPONSE',
      ticketId: safeTicketId,
      departmentId: safeDepartmentId,
      userMessage: safeUserMessage,
      aiResponse: safeAiResponse
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
    // Ensure we have valid values to log
    const safeTicketId = ticketId || 'unknown';
    const safeDepartmentId = departmentId || 'unknown';
    const safeChatHistory = chatHistory || [];
    const safeContextData = contextData || {};
    
    this.logInteraction({
      interactionType: 'CHAT_CONTEXT',
      ticketId: safeTicketId,
      departmentId: safeDepartmentId,
      chatHistory: safeChatHistory,
      contextData: safeContextData
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
    // Ensure we have valid values to log
    const safeTicketId = ticketId || 'unknown';
    const safeDepartmentId = departmentId || 'unknown';
    const safeErrorMessage = errorMessage || 'Unknown error';
    const safeContext = context || '';
    
    this.logInteraction({
      interactionType: 'ERROR',
      ticketId: safeTicketId,
      departmentId: safeDepartmentId,
      errorMessage: safeErrorMessage,
      context: safeContext
    });
  }
}

module.exports = new AILogger();