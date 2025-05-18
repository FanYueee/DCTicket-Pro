const database = require('../../core/database');
const logger = require('../../core/logger');

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
        [new Date().toISOString(), new Date().toISOString(), ticketId]
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
        [status, new Date().toISOString(), ticketId]
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
        [aiHandled ? 1 : 0, new Date().toISOString(), ticketId]
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
        [1, staffId, new Date().toISOString(), ticketId]
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
      await database.run(
        `INSERT OR REPLACE INTO messages (
          id, ticket_id, user_id, content, is_ai, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.ticketId,
          message.userId,
          message.content,
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
        timestamp: new Date(message.timestamp)
      }));
    } catch (error) {
      logger.error(`Database error getting ticket messages: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TicketRepository;