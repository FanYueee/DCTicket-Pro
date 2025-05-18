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
}

module.exports = TicketService;