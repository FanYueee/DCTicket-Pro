const logger = require('../../core/logger');
const config = require('../../core/config');

class TicketService {
  constructor(ticketRepository) {
    this.repository = ticketRepository;
  }

  /**
   * Update department category ID
   * @param {String} departmentId - The department ID
   * @param {String} categoryId - The category channel ID
   * @return {Promise<Boolean>} Success status
   */
  async updateDepartmentCategory(departmentId, categoryId) {
    try {
      return await this.repository.updateDepartmentCategory(departmentId, categoryId);
    } catch (error) {
      logger.error(`Error updating department category: ${error.message}`);
      throw error;
    }
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
      return await this.repository.savePanel(guildId, channelId, messageId);
    } catch (error) {
      logger.error(`Error saving panel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all panels from the database
   * @return {Promise<Array>} Array of panel objects
   */
  async getPanels() {
    try {
      return await this.repository.getPanels();
    } catch (error) {
      logger.error(`Error getting panels: ${error.message}`);
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
      return await this.repository.getDepartment(departmentId);
    } catch (error) {
      logger.error(`Error getting department: ${error.message}`);
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
      return await this.repository.getDepartmentRoles(departmentId);
    } catch (error) {
      logger.error(`Error getting department roles: ${error.message}`);
      return [];
    }
  }

  /**
   * Set roles for a department
   * @param {String} departmentId - The department ID
   * @param {Array} roleIds - Array of role IDs
   * @return {Promise<Boolean>} Success status
   */
  async setDepartmentRoles(departmentId, roleIds) {
    try {
      // First clear existing roles
      await this.repository.clearDepartmentRoles(departmentId);
      
      // Then add the new roles
      for (const roleId of roleIds) {
        await this.repository.addDepartmentRole(departmentId, roleId);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error setting department roles: ${error.message}`);
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
      return await this.repository.createTicket(ticket);
    } catch (error) {
      logger.error(`Error creating ticket: ${error.message}`);
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
      return await this.repository.getTicketByChannelId(channelId);
    } catch (error) {
      logger.error(`Error getting ticket by channel ID: ${error.message}`);
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
      return await this.repository.getUserTicketByDepartment(userId, departmentId);
    } catch (error) {
      logger.error(`Error getting user ticket by department: ${error.message}`);
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
      return await this.repository.closeTicket(ticketId);
    } catch (error) {
      logger.error(`Error closing ticket: ${error.message}`);
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
      return await this.repository.updateTicketStatus(ticketId, status);
    } catch (error) {
      logger.error(`Error updating ticket status: ${error.message}`);
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
      return await this.repository.assignTicketToStaff(ticketId, staffId);
    } catch (error) {
      logger.error(`Error assigning ticket to staff: ${error.message}`);
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
      return await this.repository.updateTicketAIHandled(ticketId, aiHandled);
    } catch (error) {
      logger.error(`Error updating ticket AI handled status: ${error.message}`);
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
      return await this.repository.saveMessage(message);
    } catch (error) {
      logger.error(`Error saving message: ${error.message}`);
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
      return await this.repository.getTicketMessages(ticketId);
    } catch (error) {
      logger.error(`Error getting ticket messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Export ticket messages to a file
   * @param {String} ticketId - The ticket ID
   * @return {Promise<String|null>} The path to the exported file or null if ticket logging is disabled
   */
  async exportTicket(ticketId) {
    try {
      // Check if ticket logging is enabled
      if (!config.enableTicketLogs) {
        logger.info(`Ticket logging is disabled in config, skipping export of ticket ${ticketId}`);
        return null;
      }
      
      // Get the ticket data
      const ticket = await this.repository.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }
      
      // Get the department data
      const department = await this.getDepartment(ticket.departmentId);
      
      // Export the ticket messages to a file
      const filePath = await this.repository.exportTicketMessages(ticketId, ticket, department);
      
      return filePath;
    } catch (error) {
      logger.error(`Error exporting ticket: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send ticket transcript to user
   * @param {String} ticketId - The ticket ID
   * @param {Client} client - The Discord client
   * @return {Promise<Boolean>} Success status
   */
  async sendTicketTranscriptToUser(ticketId, client) {
    try {
      // Check if ticket logging is enabled
      if (!config.enableTicketLogs) {
        logger.info(`Ticket logging is disabled in config, skipping transcript for ticket ${ticketId}`);
        return true; // Return success without sending transcript
      }
      
      // Get the ticket data
      const ticket = await this.repository.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }
      
      // Get the user
      const user = await client.users.fetch(ticket.userId).catch(() => null);
      if (!user) {
        logger.warn(`Could not find user ${ticket.userId} for ticket ${ticketId}`);
        return false;
      }
      
      // Get the department
      const department = await this.getDepartment(ticket.departmentId);
      
      // Export the ticket
      const filePath = await this.exportTicket(ticketId);
      
      // If filePath is null, it means ticket logging is disabled
      if (!filePath) {
        logger.info(`No transcript file generated for ticket ${ticketId}, skipping sending to user`);
        return true;
      }
      
      // Try to send the file to the user
      try {
        const dmChannel = await user.createDM();
        await dmChannel.send({
          content: `您好！以下是您的客服單記錄 (ID: ${ticket.id.split('-')[0]})`,
          files: [filePath]
        });
        logger.info(`Successfully sent ticket transcript for ${ticketId} to user ${user.tag}`);
        return true;
      } catch (dmError) {
        // Log the failure but don't throw an error
        logger.error(`Failed to send ticket transcript to user ${user.tag}: ${dmError.message}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error sending ticket transcript: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get a ticket by ID
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Object>} The ticket object
   */
  async getTicket(ticketId) {
    try {
      return await this.repository.getTicket(ticketId);
    } catch (error) {
      logger.error(`Error getting ticket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer a ticket to another department
   * @param {String} ticketId - The ticket ID
   * @param {String} newDepartmentId - The new department ID
   * @return {Promise<Boolean>} Success status
   */
  async transferTicketDepartment(ticketId, newDepartmentId) {
    try {
      return await this.repository.updateTicketDepartment(ticketId, newDepartmentId);
    } catch (error) {
      logger.error(`Error transferring ticket department: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record a ticket invite
   * @param {String} ticketId - The ticket ID
   * @param {String} inviterId - The inviter user ID
   * @param {String} inviteeId - The invitee user ID
   * @return {Promise<Boolean>} Success status
   */
  async recordInvite(ticketId, inviterId, inviteeId) {
    try {
      return await this.repository.recordInvite(ticketId, inviterId, inviteeId);
    } catch (error) {
      logger.error(`Error recording invite: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all invites for a ticket
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Array>} Array of invite objects
   */
  async getTicketInvites(ticketId) {
    try {
      return await this.repository.getTicketInvites(ticketId);
    } catch (error) {
      logger.error(`Error getting ticket invites: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TicketService;