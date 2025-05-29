const database = require('../../core/database');
const logger = require('../../core/logger');
const config = require('../../core/config');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

class TicketRepository {
  async initialize() {
    // No additional initialization needed as the database is already set up
    return true;
  }

  /**
   * Save a ticket panel to the database
   * @param {String} guildId - The guild ID
   * @param {String} channelId - The channel ID
   * @param {String} messageId - The message ID
   * @return {Promise<Object>} The saved panel
   */
  async savePanel(guildId, channelId, messageId) {
    try {
      // Check if a panel already exists for this guild
      const existingPanel = await database.get(
        'SELECT * FROM settings WHERE guild_id = ?',
        [guildId]
      );
      
      if (existingPanel) {
        // Update existing panel
        await database.run(
          'UPDATE settings SET panel_channel_id = ?, panel_message_id = ? WHERE guild_id = ?',
          [channelId, messageId, guildId]
        );
      } else {
        // Insert new panel
        await database.run(
          'INSERT INTO settings (guild_id, panel_channel_id, panel_message_id) VALUES (?, ?, ?)',
          [guildId, channelId, messageId]
        );
      }
      
      return { guildId, channelId, messageId };
    } catch (error) {
      logger.error(`Database error saving panel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all panels from the database
   * @return {Promise<Array>} Array of panel objects
   */
  async getPanels() {
    try {
      const panels = await database.all('SELECT * FROM settings');
      return panels.map(panel => ({
        guildId: panel.guild_id,
        channelId: panel.panel_channel_id,
        messageId: panel.panel_message_id
      }));
    } catch (error) {
      logger.error(`Database error getting panels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a department by ID
   * @param {String} departmentId - The department ID
   * @return {Promise<Object>} The department object
   */
  async getDepartment(departmentId) {
    try {
      const department = await database.get(
        'SELECT * FROM departments WHERE id = ?',
        [departmentId]
      );
      
      if (!department) return null;
      
      return {
        id: department.id,
        name: department.name,
        description: department.description,
        emoji: department.emoji,
        color: department.color,
        categoryId: department.category_id
      };
    } catch (error) {
      logger.error(`Database error getting department: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update department category ID
   * @param {String} departmentId - The department ID
   * @param {String} categoryId - The category channel ID
   * @return {Promise<Boolean>} Success status
   */
  async updateDepartmentCategory(departmentId, categoryId) {
    try {
      await database.run(
        'UPDATE departments SET category_id = ? WHERE id = ?',
        [categoryId, departmentId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error updating department category: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get roles associated with a department
   * @param {String} departmentId - The department ID
   * @return {Promise<Array>} Array of role IDs
   */
  async getDepartmentRoles(departmentId) {
    try {
      const roles = await database.all(
        'SELECT role_id FROM department_roles WHERE department_id = ?',
        [departmentId]
      );
      
      return roles.map(role => role.role_id);
    } catch (error) {
      logger.error(`Database error getting department roles: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear all roles for a department
   * @param {String} departmentId - The department ID
   * @return {Promise<Boolean>} Success status
   */
  async clearDepartmentRoles(departmentId) {
    try {
      await database.run(
        'DELETE FROM department_roles WHERE department_id = ?',
        [departmentId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error clearing department roles: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a role to a department
   * @param {String} departmentId - The department ID
   * @param {String} roleId - The role ID
   * @return {Promise<Boolean>} Success status
   */
  async addDepartmentRole(departmentId, roleId) {
    try {
      await database.run(
        'INSERT OR IGNORE INTO department_roles (department_id, role_id) VALUES (?, ?)',
        [departmentId, roleId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error adding department role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new ticket
   * @param {Object} ticket - The ticket object
   * @return {Promise<Object>} The created ticket
   */
  async createTicket(ticket) {
    try {
      await database.run(
        `INSERT INTO tickets (
          id, channel_id, user_id, department_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ticket.id,
          ticket.channelId,
          ticket.userId,
          ticket.departmentId,
          ticket.status,
          ticket.createdAt.toISOString()
        ]
      );
      
      return ticket;
    } catch (error) {
      logger.error(`Database error creating ticket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a ticket by its channel ID
   * @param {String} channelId - The channel ID
   * @return {Promise<Object>} The ticket object
   */
  async getTicketByChannelId(channelId) {
    try {
      const ticket = await database.get(
        'SELECT * FROM tickets WHERE channel_id = ?',
        [channelId]
      );
      
      if (!ticket) return null;
      
      return {
        id: ticket.id,
        channelId: ticket.channel_id,
        userId: ticket.user_id,
        departmentId: ticket.department_id,
        status: ticket.status,
        createdAt: new Date(ticket.created_at),
        closedAt: ticket.closed_at ? new Date(ticket.closed_at) : null
      };
    } catch (error) {
      logger.error(`Database error getting ticket by channel ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a user's open ticket for a specific department
   * @param {String} userId - The user ID
   * @param {String} departmentId - The department ID
   * @return {Promise<Object>} The ticket object if found
   */
  async getUserTicketByDepartment(userId, departmentId) {
    try {
      const ticket = await database.get(
        'SELECT * FROM tickets WHERE user_id = ? AND department_id = ? AND status = "open"',
        [userId, departmentId]
      );
      
      if (!ticket) return null;
      
      return {
        id: ticket.id,
        channelId: ticket.channel_id,
        userId: ticket.user_id,
        departmentId: ticket.department_id,
        status: ticket.status,
        createdAt: new Date(ticket.created_at),
        closedAt: ticket.closed_at ? new Date(ticket.closed_at) : null
      };
    } catch (error) {
      logger.error(`Database error getting user ticket by department: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close a ticket
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Boolean>} Success status
   */
  async closeTicket(ticketId) {
    try {
      await database.run(
        'UPDATE tickets SET status = "closed", closed_at = ?, updated_at = ? WHERE id = ?',
        [moment().tz(config.timezone || 'UTC').toISOString(), moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error closing ticket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update ticket status
   * @param {String} ticketId - The ticket ID
   * @param {String} status - The new status
   * @return {Promise<Boolean>} Success status
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

  /**
   * Update ticket AI handling status
   * @param {String} ticketId - The ticket ID
   * @param {Boolean} aiHandled - Whether the ticket was handled by AI
   * @return {Promise<Boolean>} Success status
   */
  async updateTicketAIHandled(ticketId, aiHandled) {
    try {
      await database.run(
        'UPDATE tickets SET ai_handled = ?, updated_at = ? WHERE id = ?',
        [aiHandled ? 1 : 0, moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error updating ticket AI handled status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Assign a ticket to a staff member
   * @param {String} ticketId - The ticket ID
   * @param {String} staffId - The staff user ID
   * @return {Promise<Boolean>} Success status
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
   * Save a message to a ticket
   * @param {Object} message - The message object
   * @return {Promise<Object>} The saved message
   */
  async saveMessage(message) {
    try {
      // Store username in content JSON if provided
      let finalContent = message.content;
      
      // If username is provided, store it in a special field in content for regular users
      if (message.username && !message.isAI) {
        try {
          // Check if content can be parsed as JSON first
          try {
            const parsedContent = JSON.parse(message.content);
            parsedContent.username = message.username;
            finalContent = JSON.stringify(parsedContent);
          } catch (e) {
            // Not JSON, create a new JSON object with username and original content
            finalContent = JSON.stringify({
              text: message.content,
              username: message.username
            });
          }
        } catch (e) {
          // If any error occurs, fall back to original content
          logger.error(`Error adding username to message content: ${e.message}`);
          finalContent = message.content;
        }
      }
      
      await database.run(
        `INSERT OR REPLACE INTO messages (
          id, ticket_id, user_id, content, is_ai, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.ticketId,
          message.userId,
          finalContent,
          message.isAI ? 1 : 0,
          message.timestamp.toISOString()
        ]
      );

      return message;
    } catch (error) {
      logger.error(`Database error saving message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all messages for a ticket
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Array>} Array of message objects
   */
  async getTicketMessages(ticketId) {
    try {
      const messages = await database.all(
        'SELECT * FROM messages WHERE ticket_id = ? ORDER BY timestamp ASC',
        [ticketId]
      );
      
      return messages.map(message => ({
        id: message.id,
        ticketId: message.ticket_id,
        userId: message.user_id,
        content: message.content,
        isAI: Boolean(message.is_ai),
        timestamp: new Date(message.timestamp)
      }));
    } catch (error) {
      logger.error(`Database error getting ticket messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Export ticket messages to a file
   * @param {String} ticketId - The ticket ID
   * @param {Object} ticket - The ticket object
   * @param {Object} department - The department object
   * @return {Promise<String|null>} The path to the exported file or null if ticket logging is disabled
   */
  async exportTicketMessages(ticketId, ticket, department) {
    try {
      // Check if ticket logging is enabled in config
      if (!config.enableTicketLogs) {
        logger.info(`Ticket logging is disabled in config, skipping export of ticket ${ticketId}`);
        return null;
      }
      
      // Ensure the directory exists
      const ticketLogDir = path.join('logs', 'ticket');
      if (!fs.existsSync(ticketLogDir)) {
        fs.mkdirSync(ticketLogDir, { recursive: true });
      }
      
      // Get all messages for the ticket
      const messages = await this.getTicketMessages(ticketId);
      
      // Create a file path using the ticket ID as the filename
      const filePath = path.join(ticketLogDir, `${ticketId}.txt`);
      
      // Format the ticket information header
      let content = `====== 客服單記錄 ======\n`;
      content += `ID: ${ticketId}\n`;
      content += `部門: ${department?.name || '未知'}\n`;
      content += `創建時間: ${ticket.createdAt.toISOString()}\n`;
      content += `關閉時間: ${ticket.closedAt ? ticket.closedAt.toISOString() : '未關閉'}\n`;
      content += `狀態: ${ticket.status}\n`;
      content += `==================\n\n`;
      
      // Get user cache for display names
      const userCache = new Map();
      
      // Deduplicate messages by tracking AI response IDs
      const processedAIMessages = new Set();
      
      // Format each message
      for (const message of messages) {
        try {
          // Try to parse content as JSON for special messages
          let parsedContent;
          try {
            parsedContent = JSON.parse(message.content);
          } catch (e) {
            // Not JSON, use as is
            parsedContent = null;
          }
          
          // Format timestamp
          const timestamp = message.timestamp.toISOString();
          
          // Format different types of messages
          if (parsedContent && parsedContent.isDescription) {
            content += `[${timestamp}] [問題描述]\n${parsedContent.text}\n\n`;
          } else if (parsedContent && parsedContent.isOffHoursNotice) {
            content += `[${timestamp}] [系統通知]\n${parsedContent.message.content || '非服務時間通知'}\n\n`;
          } else if (parsedContent && parsedContent.isNewTicketOffHoursNotice) {
            content += `[${timestamp}] [系統通知]\n${parsedContent.message.content || '非服務時間通知'}\n\n`;
          } else if (parsedContent && parsedContent.embeds) {
            // Handle embed messages
            content += `[${timestamp}] [系統嵌入]\n系統嵌入訊息\n\n`;
          } else if (message.isAI) {
            // For AI responses, check if this is our new JSON format
            try {
              const aiContent = JSON.parse(message.content);
              if (aiContent.aiResponseId && aiContent.content) {
                // This is our new format with the unique AI response ID
                const aiResponseId = aiContent.aiResponseId;
                
                // Skip if we've already processed this exact AI response ID
                if (processedAIMessages.has(aiResponseId)) {
                  continue;
                }
                
                // Mark this response as processed
                processedAIMessages.add(aiResponseId);
                
                // AI message with the actual content
                content += `[${timestamp}] [AI回應]\n${aiContent.content}\n\n`;
                continue;
              }
            } catch (e) {
              // Not our JSON format, continue with regular handling
            }
            
            // Skip if we've already processed an identical AI message content
            const key = `${message.content}`;
            if (processedAIMessages.has(key)) {
              continue;
            }
            processedAIMessages.add(key);
            
            // Regular AI message
            content += `[${timestamp}] [AI回應]\n${message.content}\n\n`;
          } else {
            // Regular user message - try to get username
            let userDisplay = message.userId;
            let actualContent = message.content;
            
            // Try to extract username from content if it exists
            if (parsedContent && parsedContent.username) {
              if (parsedContent.text) {
                // This is our special format with username and content
                actualContent = parsedContent.text;
              }
              userDisplay = `${parsedContent.username} (${message.userId})`;
            } else {
              // Check if we have a cached username
              if (!userCache.has(message.userId)) {
                userCache.set(message.userId, `未知用戶 (${message.userId})`);
              }
              userDisplay = userCache.get(message.userId);
            }
            
            content += `[${timestamp}] [${userDisplay}]\n${actualContent}\n\n`;
          }
        } catch (e) {
          // If any error in parsing this message, add it as simple text
          content += `[${message.timestamp.toISOString()}] [訊息處理錯誤]\n${message.content}\n\n`;
        }
      }
      
      // Write the content to the file
      fs.writeFileSync(filePath, content, 'utf8');
      
      logger.info(`Exported ticket ${ticketId} to ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`Error exporting ticket messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a ticket by ID
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Object>} The ticket object
   */
  async getTicket(ticketId) {
    try {
      const ticket = await database.get(
        'SELECT * FROM tickets WHERE id = ?',
        [ticketId]
      );
      
      if (!ticket) return null;
      
      return {
        id: ticket.id,
        channelId: ticket.channel_id,
        userId: ticket.user_id,
        departmentId: ticket.department_id,
        status: ticket.status,
        aiHandled: Boolean(ticket.ai_handled),
        humanHandled: Boolean(ticket.human_handled),
        staffId: ticket.staff_id,
        createdAt: new Date(ticket.created_at),
        closedAt: ticket.closed_at ? new Date(ticket.closed_at) : null
      };
    } catch (error) {
      logger.error(`Database error getting ticket by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a user's ticket by user ID and department
   * @param {String} userId - The user ID
   * @param {String} departmentId - The department ID
   * @return {Promise<Object>} The ticket object
   */
  async getTicketByUserId(userId, departmentId) {
    try {
      const ticket = await database.get(
        'SELECT * FROM tickets WHERE user_id = ? AND department_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId, departmentId]
      );
      
      if (!ticket) return null;
      
      return {
        id: ticket.id,
        channelId: ticket.channel_id,
        userId: ticket.user_id,
        departmentId: ticket.department_id,
        status: ticket.status,
        aiHandled: Boolean(ticket.ai_handled),
        humanHandled: Boolean(ticket.human_handled),
        staffId: ticket.staff_id,
        createdAt: new Date(ticket.created_at),
        closedAt: ticket.closed_at ? new Date(ticket.closed_at) : null
      };
    } catch (error) {
      logger.error(`Database error getting ticket by user ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update ticket department
   * @param {String} ticketId - The ticket ID
   * @param {String} newDepartmentId - The new department ID
   * @return {Promise<Boolean>} Success status
   */
  async updateTicketDepartment(ticketId, newDepartmentId) {
    try {
      await database.run(
        'UPDATE tickets SET department_id = ?, updated_at = ? WHERE id = ?',
        [newDepartmentId, moment().tz(config.timezone || 'UTC').toISOString(), ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error updating ticket department: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TicketRepository;