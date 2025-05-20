const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../core/logger');
const config = require('../../core/config');
const aiLogger = require('./ai-logger');

class GeminiAPI {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  /**
   * Initialize the Gemini API client
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      if (!config.ai || !config.ai.enabled) {
        logger.warn('AI is disabled in configuration');
        return false;
      }

      if (!config.ai.geminiApiKey) {
        logger.error('Gemini API key is not configured');
        return false;
      }

      this.genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
      
      // Get the model specified in config or use default
      const modelName = config.ai.model || 'gemini-2.0-flash';
      this.model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: config.ai.defaultPrompt,
        generationConfig: {
          temperature: config.ai.temperature || 0.7,
          maxOutputTokens: config.ai.maxOutputTokens || 1024,
        },
      });

      this.initialized = true;
      logger.info(`Gemini API initialized with model: ${modelName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Gemini API: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if the API is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Generate a response based on a chat history
   * @param {Array<{role: string, parts: string}>} chatHistory - The chat history
   * @param {string} departmentId - Optional department ID for specialized prompt
   * @param {Object} repository - Optional repository for database operations
   * @returns {Promise<string>} The generated response
   */
  async generateResponse(chatHistory, departmentId = null, repository = null, contextData = null, ticketId = null) {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
        if (!this.isInitialized()) {
          return '很抱歉，AI 助手目前無法使用。請稍後再試或等待客服人員協助。';
        }
      }

      // Get the appropriate prompt for this department
      let systemPrompt = config.ai.defaultPrompt;

      // First try to get system prompt from context data if available
      if (contextData && contextData.messages) {
        const systemMessage = contextData.messages.find(msg => msg.isSystemPrompt);
        if (systemMessage) {
          systemPrompt = systemMessage.content;
          logger.info('Using system prompt from conversation context');
        }
      }

      // If no system prompt in context, get from database or config
      if (systemPrompt === config.ai.defaultPrompt) {
        try {
          systemPrompt = await this.getDepartmentPrompt(departmentId, repository);
          logger.info(`Using prompt for department ${departmentId || 'default'} from repository`);
        } catch (error) {
          logger.warn(`Error getting department prompt: ${error.message}. Using default.`);
        }
      }

      // Add debug logging to see what prompt is being used
      const promptPreview = systemPrompt.substring(0, 50) + '...';
      logger.info(`Prompt preview: ${promptPreview}`);

      // Log the full system prompt to the AI logger
      if (ticketId) {
        let promptSource = 'default';
        if (contextData && contextData.messages && contextData.messages.find(msg => msg.isSystemPrompt)) {
          promptSource = 'context';
        } else if (systemPrompt !== config.ai.defaultPrompt) {
          promptSource = 'repository';
        }

        aiLogger.logPrompt(ticketId, departmentId, `[${promptSource}] ${systemPrompt}`);

        // Also log the chat context and history
        aiLogger.logChatContext(ticketId, departmentId, chatHistory, contextData);
      }

      // CRITICAL FIX: Gemini's system instruction needs careful handling
      // For Gemini 2.0, we need to ensure we're using the system instruction in a way
      // that works consistently, as systemInstruction parameter may not be working properly

      // Create the base model without system instruction first
      const baseModel = this.genAI.getGenerativeModel({
        model: config.ai.model || 'gemini-2.0-flash',
        generationConfig: {
          temperature: config.ai.temperature || 0.7,
          maxOutputTokens: config.ai.maxOutputTokens || 1024,
        },
      });

      // For debugging - log the type of each message in history
      if (chatHistory.length > 0) {
        logger.info(`Chat history roles: ${chatHistory.map(m => m.role).join(', ')}`);
      }

      // Prepare history with system message FIRST
      let fullHistory = [];

      // Add the system prompt as the first message with role "model"
      // Note: Gemini uses "model" role for assistant messages
      fullHistory.push({
        role: "model",  // Using "model" role to represent the AI
        parts: systemPrompt
      });

      // Now add the real conversation history
      for (const msg of chatHistory) {
        if (msg.role !== 'system') {  // Avoid duplicate system messages
          fullHistory.push(msg);
        }
      }

      logger.info(`Prepared history with system message first, total messages: ${fullHistory.length}`);

      // Create a chat session with the full history including system message first
      const chat = baseModel.startChat({
        history: fullHistory,
      });

      // Get the last message (should be from user)
      let userMessage = '';
      if (chatHistory.length > 0) {
        const lastMessage = chatHistory[chatHistory.length - 1];
        if (lastMessage.role === 'user') {
          userMessage = lastMessage.parts;
        } else {
          logger.warn(`Expected last message to be from user, but was from ${lastMessage.role}`);
          // Try to find the last user message
          for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].role === 'user') {
              userMessage = chatHistory[i].parts;
              break;
            }
          }
        }
      }

      // Log the user message that's being sent to the AI
      if (ticketId) {
        aiLogger.logUserMessage(ticketId, departmentId, userMessage);
      }

      // CRITICAL FIX: Get the response - using structured format for maximum compatibility
      logger.info(`Sending user message to AI: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

      const structuredMessage = {
        role: "user",
        parts: userMessage
      };

      logger.info(`Using structured message format: ${JSON.stringify(structuredMessage)}`);

      let response;
      try {
        // First try with structured format
        const result = await chat.sendMessage(structuredMessage);
        response = result.response.text();
        logger.info("Successfully got response using structured message format");
      } catch (structuredError) {
        // IMPORTANT: Only try string format if structured format actually failed
        if (structuredError) {
          logger.warn(`Error with structured format: ${structuredError.message}. Trying string format...`);
          try {
            const fallbackResult = await chat.sendMessage(userMessage);
            response = fallbackResult.response.text();
            logger.info("Successfully got response using string format fallback");
          } catch (stringError) {
            logger.error(`Both message formats failed. String error: ${stringError.message}`);
            throw new Error(`Failed to get AI response: ${structuredError.message}, ${stringError.message}`);
          }
        } else {
          // This should never happen, but just in case
          logger.error("Structured format failed without an error");
          throw new Error("Failed to get AI response: Unknown error with structured format");
        }
      }

      // Log the result
      logger.info(`Gemini response generated for department ${departmentId || 'default'}`);

      // Log the AI response
      if (ticketId) {
        aiLogger.logResponse(ticketId, departmentId, userMessage, response);
      }

      return response;
    } catch (error) {
      logger.error(`Error generating Gemini response: ${error.message}`);
      return '很抱歉，AI 助手在處理您的請求時遇到了問題。請稍後再試或等待客服人員協助。';
    }
  }

  /**
   * Create a chat history structure for Gemini from messages
   * @param {Array} messages - Array of message objects
   * @returns {Array} Formatted chat history for Gemini
   */
  formatChatHistory(messages) {
    const history = [];

    // Filter out system prompts - they're not part of the conversation history
    // Instead, they'll be used as systemInstruction in the model configuration
    const conversationMessages = messages.filter(msg => !msg.isSystemPrompt);

    for (const message of conversationMessages) {
      // Determine if this is a user or assistant (bot) message
      const role = message.isUser ? 'user' : 'model';

      history.push({
        role: role,
        parts: message.content
      });
    }

    // Log the processed history
    const userMsgCount = history.filter(msg => msg.role === 'user').length;
    const modelMsgCount = history.filter(msg => msg.role === 'model').length;
    logger.info(`Formatted chat history: ${userMsgCount} user messages, ${modelMsgCount} model messages`);

    return history;
  }

  /**
   * Get a specialized prompt for a department
   * @param {string} departmentId - The department ID
   * @param {Object} repository - Repository for database operations
   * @returns {Promise<string>} The prompt text
   */
  async getDepartmentPrompt(departmentId, repository) {
    try {
      // Get prompt from database
      const prompt = await repository.getAIPrompt(departmentId);

      if (prompt) {
        // Fix: Use promptText (camelCase) instead of prompt_text (snake_case)
        return prompt.promptText;
      }

      // If no prompt found in database, use the one from config
      if (config.ai.departmentPrompts && config.ai.departmentPrompts[departmentId]) {
        return config.ai.departmentPrompts[departmentId];
      }

      // Fallback to default prompt
      return config.ai.defaultPrompt;
    } catch (error) {
      logger.error(`Error getting department prompt: ${error.message}`);
      return config.ai.defaultPrompt;
    }
  }
}

module.exports = new GeminiAPI();