const database = require('../../../core/database');
const logger = require('../../../core/logger');
const moment = require('moment-timezone');
const config = require('../../../core/config');

class ReminderRepository {
  /**
   * Get reminder settings for a guild
   * @param {String} guildId - The guild ID
   * @return {Promise<Object>} The reminder settings
   */
  async getReminderSettings(guildId) {
    try {
      const settings = await database.get(
        'SELECT * FROM ticket_reminder_settings WHERE guild_id = ?',
        [guildId]
      );
      
      if (!settings) {
        // Return default settings if none exist
        return {
          guildId,
          enabled: false,
          reminderTimeout: 600, // 10 minutes in seconds
          reminderRoleId: null,
          reminderMode: 'once',
          reminderInterval: 60,
          reminderMaxCount: 3
        };
      }
      
      return {
        guildId: settings.guild_id,
        enabled: Boolean(settings.enabled),
        reminderTimeout: settings.reminder_timeout,
        reminderRoleId: settings.reminder_role_id,
        reminderMode: settings.reminder_mode || 'once',
        reminderInterval: settings.reminder_interval || 60,
        reminderMaxCount: settings.reminder_max_count || 3
      };
    } catch (error) {
      logger.error(`Database error getting reminder settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save reminder settings for a guild
   * @param {String} guildId - The guild ID
   * @param {Object} settings - The settings to save
   * @return {Promise<Boolean>} Success status
   */
  async saveReminderSettings(guildId, settings) {
    try {
      const existingSettings = await database.get(
        'SELECT * FROM ticket_reminder_settings WHERE guild_id = ?',
        [guildId]
      );
      
      if (existingSettings) {
        await database.run(
          `UPDATE ticket_reminder_settings 
           SET enabled = ?, reminder_timeout = ?, reminder_role_id = ?, 
               reminder_mode = ?, reminder_interval = ?, reminder_max_count = ?, updated_at = ?
           WHERE guild_id = ?`,
          [
            settings.enabled ? 1 : 0,
            settings.reminderTimeout || 600,
            settings.reminderRoleId,
            settings.reminderMode || 'once',
            settings.reminderInterval || 60,
            settings.reminderMaxCount || 3,
            moment().tz(config.timezone || 'UTC').toISOString(),
            guildId
          ]
        );
      } else {
        await database.run(
          `INSERT INTO ticket_reminder_settings 
           (guild_id, enabled, reminder_timeout, reminder_role_id, 
            reminder_mode, reminder_interval, reminder_max_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guildId,
            settings.enabled ? 1 : 0,
            settings.reminderTimeout || 600,
            settings.reminderRoleId,
            settings.reminderMode || 'once',
            settings.reminderInterval || 60,
            settings.reminderMaxCount || 3,
            moment().tz(config.timezone || 'UTC').toISOString(),
            moment().tz(config.timezone || 'UTC').toISOString()
          ]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error saving reminder settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get staff reminder preference
   * @param {String} userId - The user ID
   * @return {Promise<Boolean>} Whether the user wants to receive reminders
   */
  async getStaffReminderPreference(userId) {
    try {
      const preference = await database.get(
        'SELECT receive_reminders FROM staff_reminder_preferences WHERE user_id = ?',
        [userId]
      );
      
      // Default to true if no preference is set
      return preference ? Boolean(preference.receive_reminders) : true;
    } catch (error) {
      logger.error(`Database error getting staff reminder preference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set staff reminder preference
   * @param {String} userId - The user ID
   * @param {Boolean} receiveReminders - Whether to receive reminders
   * @return {Promise<Boolean>} Success status
   */
  async setStaffReminderPreference(userId, receiveReminders) {
    try {
      const existingPreference = await database.get(
        'SELECT * FROM staff_reminder_preferences WHERE user_id = ?',
        [userId]
      );
      
      if (existingPreference) {
        await database.run(
          `UPDATE staff_reminder_preferences 
           SET receive_reminders = ?, updated_at = ?
           WHERE user_id = ?`,
          [
            receiveReminders ? 1 : 0,
            moment().tz(config.timezone || 'UTC').toISOString(),
            userId
          ]
        );
      } else {
        await database.run(
          `INSERT INTO staff_reminder_preferences 
           (user_id, receive_reminders, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [
            userId,
            receiveReminders ? 1 : 0,
            moment().tz(config.timezone || 'UTC').toISOString(),
            moment().tz(config.timezone || 'UTC').toISOString()
          ]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error setting staff reminder preference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update ticket response tracking
   * @param {String} ticketId - The ticket ID
   * @param {Object} tracking - Tracking data
   * @return {Promise<Boolean>} Success status
   */
  async updateResponseTracking(ticketId, tracking) {
    try {
      logger.debug(`Updating response tracking for ticket ${ticketId}:`, tracking);
      
      const existingTracking = await database.get(
        'SELECT * FROM ticket_response_tracking WHERE ticket_id = ?',
        [ticketId]
      );
      
      if (existingTracking) {
        const updateFields = [];
        const updateValues = [];
        
        if (tracking.lastCustomerMessageAt !== undefined) {
          updateFields.push('last_customer_message_at = ?');
          updateValues.push(tracking.lastCustomerMessageAt);
        }
        
        if (tracking.lastStaffResponseAt !== undefined) {
          updateFields.push('last_staff_response_at = ?');
          updateValues.push(tracking.lastStaffResponseAt);
        }
        
        if (tracking.reminderSent !== undefined) {
          updateFields.push('reminder_sent = ?');
          updateValues.push(tracking.reminderSent ? 1 : 0);
        }
        
        if (tracking.reminderSentAt !== undefined) {
          updateFields.push('reminder_sent_at = ?');
          updateValues.push(tracking.reminderSentAt);
        }
        
        if (tracking.reminderCount !== undefined) {
          updateFields.push('reminder_count = ?');
          updateValues.push(tracking.reminderCount);
        }
        
        if (tracking.lastReminderAt !== undefined) {
          updateFields.push('last_reminder_at = ?');
          updateValues.push(tracking.lastReminderAt);
        }
        
        if (tracking.noResponseNeeded !== undefined) {
          updateFields.push('no_response_needed = ?');
          updateValues.push(tracking.noResponseNeeded ? 1 : 0);
        }
        
        if (tracking.lastReminderMessageId !== undefined) {
          updateFields.push('last_reminder_message_id = ?');
          updateValues.push(tracking.lastReminderMessageId);
        }
        
        updateValues.push(ticketId);
        
        await database.run(
          `UPDATE ticket_response_tracking SET ${updateFields.join(', ')} WHERE ticket_id = ?`,
          updateValues
        );
      } else {
        await database.run(
          `INSERT INTO ticket_response_tracking 
           (ticket_id, last_customer_message_at, last_staff_response_at, 
            reminder_sent, reminder_sent_at, reminder_count, last_reminder_at,
            no_response_needed, last_reminder_message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ticketId,
            tracking.lastCustomerMessageAt || null,
            tracking.lastStaffResponseAt || null,
            tracking.reminderSent ? 1 : 0,
            tracking.reminderSentAt || null,
            tracking.reminderCount || 0,
            tracking.lastReminderAt || null,
            tracking.noResponseNeeded ? 1 : 0,
            tracking.lastReminderMessageId || null
          ]
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Database error updating response tracking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get response tracking for a ticket
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Object>} The tracking data
   */
  async getResponseTracking(ticketId) {
    try {
      const tracking = await database.get(
        'SELECT * FROM ticket_response_tracking WHERE ticket_id = ?',
        [ticketId]
      );
      
      if (!tracking) {
        return {
          ticketId,
          lastCustomerMessageAt: null,
          lastStaffResponseAt: null,
          reminderSent: false,
          reminderSentAt: null,
          reminderCount: 0,
          lastReminderAt: null,
          noResponseNeeded: false,
          lastReminderMessageId: null
        };
      }
      
      return {
        ticketId: tracking.ticket_id,
        lastCustomerMessageAt: tracking.last_customer_message_at ? new Date(tracking.last_customer_message_at) : null,
        lastStaffResponseAt: tracking.last_staff_response_at ? new Date(tracking.last_staff_response_at) : null,
        reminderSent: Boolean(tracking.reminder_sent),
        reminderSentAt: tracking.reminder_sent_at ? new Date(tracking.reminder_sent_at) : null,
        reminderCount: tracking.reminder_count || 0,
        lastReminderAt: tracking.last_reminder_at ? new Date(tracking.last_reminder_at) : null,
        noResponseNeeded: Boolean(tracking.no_response_needed),
        lastReminderMessageId: tracking.last_reminder_message_id
      };
    } catch (error) {
      logger.error(`Database error getting response tracking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get tickets that need reminders
   * @param {String} guildId - The guild ID
   * @param {Number} timeoutSeconds - The timeout in seconds
   * @return {Promise<Array>} Array of tickets needing reminders
   */
  async getTicketsNeedingReminders(guildId, timeoutSeconds) {
    try {
      const now = moment();
      const cutoffTime = now.clone().subtract(timeoutSeconds, 'seconds').toISOString();
      
      // Get reminder settings first
      const settings = await this.getReminderSettings(guildId);
      
      logger.debug(`Looking for tickets needing reminders in guild ${guildId}`);
      logger.debug(`Current time: ${now.toISOString()} (${now.tz(config.timezone || 'UTC').format('YYYY-MM-DD HH:mm:ss')} local)`);
      logger.debug(`Timeout: ${timeoutSeconds} seconds, cutoff time: ${cutoffTime} (${moment(cutoffTime).tz(config.timezone || 'UTC').format('YYYY-MM-DD HH:mm:ss')} local)`);
      
      // First, let's check what tickets exist
      const allTickets = await database.all(
        `SELECT t.id, t.status, t.human_handled, t.channel_id
         FROM tickets t
         WHERE t.status IN ('open', 'waitingStaff')`
      );
      logger.debug(`Total open/waiting tickets: ${allTickets.length}`);
      
      // Check all tickets (not just open) to debug
      const allTicketsDebug = await database.all(
        `SELECT t.id, t.status, t.human_handled 
         FROM tickets t 
         ORDER BY t.created_at DESC 
         LIMIT 10`
      );
      logger.debug('Recent tickets (all statuses):');
      for (const t of allTicketsDebug) {
        logger.debug(`  ${t.id}: status=${t.status}, human_handled=${t.human_handled}`);
      }
      
      // Check tracking data
      const trackingData = await database.all(
        `SELECT * FROM ticket_response_tracking`
      );
      logger.debug(`Total tracking records: ${trackingData.length}`);
      
      // Log details of tracking records for debugging
      for (const tracking of trackingData) {
        const customerTime = tracking.last_customer_message_at ? moment(tracking.last_customer_message_at) : null;
        const timeSinceCustomerMessage = customerTime ? now.diff(customerTime, 'seconds') : null;
        
        logger.debug(`Tracking for ticket ${tracking.ticket_id}: ` +
          `lastCustomerMessage=${tracking.last_customer_message_at}, ` +
          `lastStaffResponse=${tracking.last_staff_response_at}, ` +
          `reminderSent=${tracking.reminder_sent}, ` +
          `reminderCount=${tracking.reminder_count}, ` +
          `lastReminderAt=${tracking.last_reminder_at}, ` +
          `timeSinceCustomerMessage=${timeSinceCustomerMessage}s`
        );
        
        if (customerTime && timeSinceCustomerMessage !== null) {
          logger.debug(`  -> Customer message was ${timeSinceCustomerMessage} seconds ago, needs reminder after ${timeoutSeconds} seconds`);
          logger.debug(`  -> Should send reminder: ${timeSinceCustomerMessage >= timeoutSeconds ? 'YES' : 'NO'}`);
          
          // Additional debug for continuous/limited mode
          if (tracking.last_reminder_at) {
            const lastReminderTime = moment(tracking.last_reminder_at);
            const timeSinceLastReminder = now.diff(lastReminderTime, 'seconds');
            logger.debug(`  -> Last reminder was ${timeSinceLastReminder} seconds ago, interval is ${settings.reminderInterval} seconds`);
            logger.debug(`  -> Ready for next reminder: ${timeSinceLastReminder >= settings.reminderInterval ? 'YES' : 'NO'}`);
          }
        }
      }
      
      // Check mode and prepare query
      let tickets;
      if (settings.reminderMode === 'continuous' || settings.reminderMode === 'limited') {
        // For continuous or limited mode, check if enough time has passed since last reminder
        const reminderCutoffTime = moment().subtract(settings.reminderInterval, 'seconds').toISOString();
        
        logger.debug(`Reminder mode: ${settings.reminderMode}, interval: ${settings.reminderInterval}s`);
        logger.debug(`Reminder cutoff time: ${reminderCutoffTime} (${moment(reminderCutoffTime).tz(config.timezone || 'UTC').format('YYYY-MM-DD HH:mm:ss')} local)`);
        
        // Add 5 second buffer to avoid missing reminders due to timing
        const reminderCutoffTimeWithBuffer = moment().subtract(settings.reminderInterval - 5, 'seconds').toISOString();
        
        tickets = await database.all(
          `SELECT t.*, trt.*, d.name as department_name
           FROM tickets t
           JOIN ticket_response_tracking trt ON t.id = trt.ticket_id
           JOIN departments d ON t.department_id = d.id
           WHERE t.status IN ('open', 'waitingStaff')
           AND t.human_handled = 1
           AND trt.last_customer_message_at IS NOT NULL
           AND (trt.last_staff_response_at IS NULL OR trt.last_customer_message_at > trt.last_staff_response_at)
           AND (trt.no_response_needed IS NULL OR trt.no_response_needed = 0)
           AND (
             (trt.reminder_sent = 0 AND trt.last_customer_message_at < ?)
             OR (trt.reminder_sent = 1 AND trt.last_reminder_at < ? AND (
               '${settings.reminderMode}' = 'continuous' 
               OR (trt.reminder_count < ${settings.reminderMaxCount})
             ))
           )
           AND EXISTS (
             SELECT 1 FROM settings s 
             WHERE s.guild_id = ?
           )`,
          [cutoffTime, reminderCutoffTimeWithBuffer, guildId]
        );
      } else {
        // Original query for 'once' mode
        tickets = await database.all(
          `SELECT t.*, trt.*, d.name as department_name
           FROM tickets t
           JOIN ticket_response_tracking trt ON t.id = trt.ticket_id
           JOIN departments d ON t.department_id = d.id
           WHERE t.status IN ('open', 'waitingStaff')
           AND t.human_handled = 1
           AND trt.reminder_sent = 0
           AND trt.last_customer_message_at IS NOT NULL
           AND (trt.last_staff_response_at IS NULL OR trt.last_customer_message_at > trt.last_staff_response_at)
           AND (trt.no_response_needed IS NULL OR trt.no_response_needed = 0)
           AND trt.last_customer_message_at < ?
           AND EXISTS (
             SELECT 1 FROM settings s 
             WHERE s.guild_id = ?
           )`,
          [cutoffTime, guildId]
        );
      }
      
      logger.debug(`Found ${tickets.length} tickets matching reminder criteria`);
      
      // Debug: Let's check the specific ticket that should have reminder
      if (trackingData.length > 0) {
        const ticketId = trackingData[0].ticket_id;
        const debugTicket = await database.get(
          `SELECT t.*, trt.*, d.name as department_name, s.guild_id
           FROM tickets t
           LEFT JOIN ticket_response_tracking trt ON t.id = trt.ticket_id
           LEFT JOIN departments d ON t.department_id = d.id
           LEFT JOIN settings s ON s.guild_id = ?
           WHERE t.id = ?`,
          [guildId, ticketId]
        );
        if (debugTicket) {
          logger.debug(`Debug ticket ${ticketId}:`, {
            status: debugTicket.status,
            human_handled: debugTicket.human_handled,
            guild_id: debugTicket.guild_id,
            department_name: debugTicket.department_name
          });
        }
      }
      
      // If no tickets found, let's check why
      if (tickets.length === 0 && allTickets.length > 0) {
        logger.debug('Checking why no tickets matched criteria:');
        for (const ticket of allTickets) {
          logger.debug(`  Ticket ${ticket.id}: status=${ticket.status}, human_handled=${ticket.human_handled}`);
        }
      }
      
      return tickets.map(ticket => ({
        id: ticket.id,
        channelId: ticket.channel_id,
        userId: ticket.user_id,
        departmentId: ticket.department_id,
        departmentName: ticket.department_name,
        staffId: ticket.staff_id,
        lastCustomerMessageAt: new Date(ticket.last_customer_message_at),
        lastStaffResponseAt: ticket.last_staff_response_at ? new Date(ticket.last_staff_response_at) : null
      }));
    } catch (error) {
      logger.error(`Database error getting tickets needing reminders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear reminder tracking for a ticket
   * @param {String} ticketId - The ticket ID
   * @return {Promise<Boolean>} Success status
   */
  async clearReminderTracking(ticketId) {
    try {
      await database.run(
        'DELETE FROM ticket_response_tracking WHERE ticket_id = ?',
        [ticketId]
      );
      return true;
    } catch (error) {
      logger.error(`Database error clearing reminder tracking: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ReminderRepository;