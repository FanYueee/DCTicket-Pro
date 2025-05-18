const database = require('../../core/database');
const logger = require('../../core/logger');
const config = require('../../core/config');

class ServiceHoursRepository {
  /**
   * Get service hours settings for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Object>} Settings object with enabled flag
   */
  async getSettings(guildId) {
    try {
      const settings = await database.get(
        'SELECT service_hours_enabled FROM settings WHERE guild_id = ?',
        [guildId]
      );

      if (!settings) {
        return { enabled: config.serviceHours?.enabled || false };
      }

      return { enabled: Boolean(settings.service_hours_enabled) };
    } catch (error) {
      logger.error(`Database error getting service hours settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active service hours for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Array>} Array of service hour objects
   */
  async getActiveHours(guildId) {
    try {
      const hours = await database.all(
        'SELECT * FROM service_hours WHERE guild_id = ? AND enabled = 1 ORDER BY id',
        [guildId]
      );

      return hours;
    } catch (error) {
      logger.error(`Database error getting active service hours: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all service hours for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Array>} Array of service hour objects
   */
  async getAllHours(guildId) {
    try {
      const hours = await database.all(
        'SELECT * FROM service_hours WHERE guild_id = ? ORDER BY id',
        [guildId]
      );

      return hours;
    } catch (error) {
      logger.error(`Database error getting all service hours: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add new service hours
   * @param {string} guildId - The guild ID
   * @param {string} cronExpression - The cron expression
   * @param {string} description - The description
   * @returns {Promise<Object>} The created service hours
   */
  async addHours(guildId, cronExpression, description) {
    try {
      const result = await database.run(
        'INSERT INTO service_hours (guild_id, cron_expression, description, enabled) VALUES (?, ?, ?, 1)',
        [guildId, cronExpression, description]
      );

      return {
        id: result.lastID,
        guildId,
        cronExpression,
        description,
        enabled: true
      };
    } catch (error) {
      logger.error(`Database error adding service hours: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete service hours by IDs
   * @param {string} guildId - The guild ID
   * @param {Array<number>} ids - Array of service hour IDs to delete
   * @returns {Promise<number>} Number of deleted rows
   */
  async deleteHours(guildId, ids) {
    try {
      // Create placeholders for the SQL query
      const placeholders = ids.map(() => '?').join(',');

      const result = await database.run(
        `DELETE FROM service_hours WHERE guild_id = ? AND id IN (${placeholders})`,
        [guildId, ...ids]
      );

      return result.changes;
    } catch (error) {
      logger.error(`Database error deleting service hours: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toggle service hours by ID
   * @param {string} guildId - The guild ID
   * @param {number} id - Service hour ID
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Promise<boolean>} Success status
   */
  async toggleHoursById(guildId, id, enabled) {
    try {
      const result = await database.run(
        'UPDATE service_hours SET enabled = ? WHERE guild_id = ? AND id = ?',
        [enabled ? 1 : 0, guildId, id]
      );

      return result.changes > 0;
    } catch (error) {
      logger.error(`Database error toggling service hours: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toggle global service hours setting
   * @param {string} guildId - The guild ID
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Promise<boolean>} Success status
   */
  async toggleGlobalSetting(guildId, enabled) {
    try {
      // Check if settings exist
      const settings = await database.get(
        'SELECT * FROM settings WHERE guild_id = ?',
        [guildId]
      );
      
      if (settings) {
        // Update existing settings
        await database.run(
          'UPDATE settings SET service_hours_enabled = ? WHERE guild_id = ?',
          [enabled ? 1 : 0, guildId]
        );
      } else {
        // Insert new settings
        await database.run(
          'INSERT INTO settings (guild_id, service_hours_enabled) VALUES (?, ?)',
          [guildId, enabled ? 1 : 0]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error toggling global service hours setting: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ServiceHoursRepository;