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

  // Holiday Management Methods

  /**
   * Get all holidays for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Array>} Array of holiday objects
   */
  async getAllHolidays(guildId) {
    try {
      const holidays = await database.all(
        'SELECT * FROM holidays WHERE guild_id = ? ORDER BY created_at DESC',
        [guildId]
      );
      return holidays;
    } catch (error) {
      logger.error(`Database error getting holidays: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active holidays for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Array>} Array of active holiday objects
   */
  async getActiveHolidays(guildId) {
    try {
      const holidays = await database.all(
        'SELECT * FROM holidays WHERE guild_id = ? AND enabled = 1 ORDER BY created_at DESC',
        [guildId]
      );
      return holidays;
    } catch (error) {
      logger.error(`Database error getting active holidays: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a new holiday
   * @param {Object} holidayData - Holiday data
   * @returns {Promise<Object>} The created holiday
   */
  async addHoliday(holidayData) {
    try {
      const {
        guildId,
        name,
        reason,
        cronExpression,
        startDate,
        endDate,
        isRecurring,
        createdBy
      } = holidayData;

      const result = await database.run(
        `INSERT INTO holidays (guild_id, name, reason, cron_expression, start_date, end_date, is_recurring, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, name, reason, cronExpression, startDate, endDate, isRecurring ? 1 : 0, createdBy]
      );

      return {
        id: result.lastID,
        ...holidayData,
        enabled: true
      };
    } catch (error) {
      logger.error(`Database error adding holiday: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a holiday
   * @param {number} id - Holiday ID
   * @param {string} guildId - Guild ID
   * @param {Object} updateData - Update data
   * @returns {Promise<boolean>} Success status
   */
  async updateHoliday(id, guildId, updateData) {
    try {
      const { name, reason, cronExpression, startDate, endDate, isRecurring } = updateData;
      
      const result = await database.run(
        `UPDATE holidays 
         SET name = ?, reason = ?, cron_expression = ?, start_date = ?, end_date = ?, is_recurring = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND guild_id = ?`,
        [name, reason, cronExpression, startDate, endDate, isRecurring ? 1 : 0, id, guildId]
      );

      return result.changes > 0;
    } catch (error) {
      logger.error(`Database error updating holiday: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a holiday
   * @param {number} id - Holiday ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteHoliday(id, guildId) {
    try {
      const result = await database.run(
        'DELETE FROM holidays WHERE id = ? AND guild_id = ?',
        [id, guildId]
      );

      return result.changes > 0;
    } catch (error) {
      logger.error(`Database error deleting holiday: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toggle holiday enabled status
   * @param {number} id - Holiday ID
   * @param {string} guildId - Guild ID
   * @param {boolean} enabled - Enable status
   * @returns {Promise<boolean>} Success status
   */
  async toggleHoliday(id, guildId, enabled) {
    try {
      const result = await database.run(
        'UPDATE holidays SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND guild_id = ?',
        [enabled ? 1 : 0, id, guildId]
      );

      return result.changes > 0;
    } catch (error) {
      logger.error(`Database error toggling holiday: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get holiday settings for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Object>} Holiday settings
   */
  async getHolidaySettings(guildId) {
    try {
      const settings = await database.get(
        'SELECT * FROM holiday_settings WHERE guild_id = ?',
        [guildId]
      );

      if (!settings) {
        // Return default settings
        return { enabled: true };
      }

      return settings;
    } catch (error) {
      logger.error(`Database error getting holiday settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toggle holiday system for a guild
   * @param {string} guildId - The guild ID
   * @param {boolean} enabled - Enable status
   * @returns {Promise<boolean>} Success status
   */
  async toggleHolidaySystem(guildId, enabled) {
    try {
      const settings = await database.get(
        'SELECT * FROM holiday_settings WHERE guild_id = ?',
        [guildId]
      );

      if (settings) {
        await database.run(
          'UPDATE holiday_settings SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?',
          [enabled ? 1 : 0, guildId]
        );
      } else {
        await database.run(
          'INSERT INTO holiday_settings (guild_id, enabled) VALUES (?, ?)',
          [guildId, enabled ? 1 : 0]
        );
      }

      return true;
    } catch (error) {
      logger.error(`Database error toggling holiday system: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ServiceHoursRepository;