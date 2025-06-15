const ReminderRepository = require('./repository');
const logger = require('../../../core/logger');
const moment = require('moment-timezone');
const config = require('../../../core/config');

class ReminderService {
  constructor() {
    this.reminderRepository = new ReminderRepository();
    this.checkInterval = null;
    this.client = null;
  }

  /**
   * Initialize the reminder service
   * @param {Client} client - The Discord client
   */
  initialize(client) {
    this.client = client;
    logger.info('Reminder service initialized');
    
    // Start the reminder check interval
    this.startReminderChecks();
  }

  /**
   * Start periodic reminder checks
   */
  startReminderChecks() {
    // Check every 20 seconds to ensure we don't miss minute boundaries
    this.checkInterval = setInterval(() => {
      this.checkAllGuildsForReminders();
    }, 20000); // 20 seconds
    
    logger.info('Started reminder check interval - checking every 20 seconds');
    
    // Run initial check immediately
    setTimeout(() => {
      logger.info('Running initial reminder check...');
      this.checkAllGuildsForReminders();
    }, 5000); // Wait 5 seconds for bot to be ready
  }

  /**
   * Stop periodic reminder checks
   */
  stopReminderChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped reminder check interval');
    }
  }

  /**
   * Check all guilds for tickets needing reminders
   */
  async checkAllGuildsForReminders() {
    try {
      logger.debug(`Checking ${this.client.guilds.cache.size} guilds for reminder needs`);
      
      for (const guild of this.client.guilds.cache.values()) {
        logger.debug(`Checking guild: ${guild.name} (${guild.id})`);
        await this.checkGuildForReminders(guild);
      }
    } catch (error) {
      logger.error(`Error checking guilds for reminders: ${error.message}`);
    }
  }

  /**
   * Check a specific guild for tickets needing reminders
   * @param {Guild} guild - The Discord guild
   */
  async checkGuildForReminders(guild) {
    try {
      // Get reminder settings for this guild
      const settings = await this.reminderRepository.getReminderSettings(guild.id);
      
      logger.debug(`Guild ${guild.name} reminder settings:`, {
        enabled: settings.enabled,
        reminderRoleId: settings.reminderRoleId,
        reminderTimeout: settings.reminderTimeout
      });
      
      if (!settings.enabled) {
        logger.debug(`Reminders disabled for guild ${guild.name}`);
        return;
      }
      
      if (!settings.reminderRoleId) {
        logger.debug(`No reminder role set for guild ${guild.name}`);
        return;
      }
      
      // Check if we're in working hours using AI service method (which includes service hours check)
      let isInServiceHours = true;
      try {
        const { service: aiService } = require('../../ai');
        isInServiceHours = await aiService.isWithinServiceHours(guild.id);
        logger.debug(`Guild ${guild.name} service hours status: ${isInServiceHours ? 'IN' : 'OUT'} of hours`);
        if (!isInServiceHours) {
          return; // Don't send reminders outside of service hours
        }
      } catch (error) {
        // If service hours check fails, continue with reminders
        logger.warn(`Service hours check failed for guild ${guild.id}: ${error.message}`);
      }
      
      // Get tickets that need reminders
      const tickets = await this.reminderRepository.getTicketsNeedingReminders(
        guild.id,
        settings.reminderTimeout
      );
      
      logger.debug(`Found ${tickets.length} tickets needing reminders in guild ${guild.name}`);
      
      for (const ticket of tickets) {
        logger.debug(`Processing reminder for ticket ${ticket.id} in channel ${ticket.channelId}`);
        await this.sendReminder(guild, ticket, settings);
      }
    } catch (error) {
      logger.error(`Error checking guild ${guild.id} for reminders: ${error.message}`);
    }
  }

  /**
   * Send a reminder for a ticket
   * @param {Guild} guild - The Discord guild
   * @param {Object} ticket - The ticket data
   * @param {Object} settings - The reminder settings
   */
  async sendReminder(guild, ticket, settings) {
    try {
      const ticketChannel = await guild.channels.fetch(ticket.channelId);
      if (!ticketChannel) {
        logger.warn(`Could not find channel ${ticket.channelId} for reminder`);
        return;
      }
      
      // Get current tracking to get reminder count
      const currentTracking = await this.reminderRepository.getResponseTracking(ticket.id);
      const reminderCount = (currentTracking.reminderCount || 0) + 1;
      
      // Calculate time since last customer message
      const timeSinceMessage = moment().diff(moment(ticket.lastCustomerMessageAt), 'minutes');
      
      // Determine where to send the reminder
      let targetChannel = ticketChannel;
      let reminderText;
      
      if (config.reminder.notificationChannelId) {
        // Send to notification channel with channel tag
        try {
          targetChannel = await guild.channels.fetch(config.reminder.notificationChannelId);
          reminderText = `<@&${settings.reminderRoleId}> ⏰ ${ticketChannel} 已經 **${timeSinceMessage} 分鐘**沒有工作人員回應，請盡快處理。`;
        } catch (error) {
          logger.warn(`Could not find notification channel ${config.reminder.notificationChannelId}, falling back to ticket channel`);
          targetChannel = ticketChannel;
          reminderText = `<@&${settings.reminderRoleId}> ⏰ 此客服單已經 **${timeSinceMessage} 分鐘**沒有工作人員回應，請盡快處理。`;
        }
      } else {
        // Send to ticket channel (original behavior)
        reminderText = `<@&${settings.reminderRoleId}> ⏰ 此客服單已經 **${timeSinceMessage} 分鐘**沒有工作人員回應，請盡快處理。`;
      }
      
      if (settings.reminderMode === 'limited' || settings.reminderMode === 'continuous') {
        reminderText += ` (第 ${reminderCount} 次提醒`;
        if (settings.reminderMode === 'limited') {
          reminderText += `，最多 ${settings.reminderMaxCount} 次`;
        }
        reminderText += ')';
      }
      
      // Create action row with button
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`no_response_needed_${ticket.id}`)
            .setLabel('無須回應')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✅')
        );
      
      // Remove old reminder message button if exists
      const existingTracking = await this.reminderRepository.getResponseTracking(ticket.id);
      if (existingTracking.lastReminderMessageId && config.reminder.notificationChannelId) {
        try {
          const oldMessage = await targetChannel.messages.fetch(existingTracking.lastReminderMessageId);
          if (oldMessage && oldMessage.components.length > 0) {
            // Remove the button completely, keep only the text
            await oldMessage.edit({ components: [] });
          }
        } catch (error) {
          logger.warn(`Could not update old reminder message: ${error.message}`);
        }
      }
      
      const reminderMessage = await targetChannel.send({
        content: reminderText,
        components: [actionRow]
      });
      
      // Update tracking to mark reminder as sent
      await this.reminderRepository.updateResponseTracking(ticket.id, {
        reminderSent: true,
        reminderSentAt: moment().tz(config.timezone || 'UTC').toISOString(),
        reminderCount: reminderCount,
        lastReminderAt: moment().tz(config.timezone || 'UTC').toISOString(),
        lastReminderMessageId: reminderMessage.id
      });
      
      const channelInfo = config.reminder.notificationChannelId ? 
        `notification channel (${targetChannel.name})` : 
        `ticket channel (${ticketChannel.name})`;
      logger.info(`Sent reminder #${reminderCount} for ticket ${ticket.id} to ${channelInfo}`);
    } catch (error) {
      logger.error(`Error sending reminder for ticket ${ticket.id}: ${error.message}`);
    }
  }

  /**
   * Get staff members who should be reminded
   * @param {Guild} guild - The Discord guild
   * @param {Object} ticket - The ticket data
   * @param {Object} settings - The reminder settings
   * @return {Promise<Array>} Array of staff members to remind
   */
  async getStaffToRemind(guild, ticket, settings) {
    const staffToRemind = [];
    
    try {
      // Get the reminder role
      const reminderRole = await guild.roles.fetch(settings.reminderRoleId);
      if (!reminderRole) {
        logger.warn(`Reminder role ${settings.reminderRoleId} not found`);
        return staffToRemind;
      }
      
      // Get all members with the reminder role
      const membersWithRole = reminderRole.members;
      
      // Filter based on individual preferences
      for (const [memberId, member] of membersWithRole) {
        const wantsReminders = await this.reminderRepository.getStaffReminderPreference(memberId);
        if (wantsReminders) {
          staffToRemind.push(member);
        }
      }
      
      // If a specific staff is assigned to the ticket, always include them if they have the role
      if (ticket.staffId && membersWithRole.has(ticket.staffId)) {
        const assignedStaff = membersWithRole.get(ticket.staffId);
        if (!staffToRemind.find(s => s.id === ticket.staffId)) {
          const wantsReminders = await this.reminderRepository.getStaffReminderPreference(ticket.staffId);
          if (wantsReminders) {
            staffToRemind.push(assignedStaff);
          }
        }
      }
    } catch (error) {
      logger.error(`Error getting staff to remind: ${error.message}`);
    }
    
    return staffToRemind;
  }

  /**
   * Handle a new message in a ticket
   * @param {Message} message - The Discord message
   * @param {Object} ticket - The ticket data
   * @param {Boolean} isStaff - Whether the message is from staff
   * @param {Date} [customTimestamp] - Optional custom timestamp (used for initial handoff)
   */
  async handleTicketMessage(message, ticket, isStaff, customTimestamp = null) {
    try {
      const timestamp = customTimestamp 
        ? moment(customTimestamp).tz(config.timezone || 'UTC').toISOString()
        : moment().tz(config.timezone || 'UTC').toISOString();
      
      if (isStaff) {
        // Staff response - update last staff response time and clear reminder
        logger.debug(`Staff message from ${message.author.tag} in ticket ${ticket.id} - clearing reminder status`);
        await this.reminderRepository.updateResponseTracking(ticket.id, {
          lastStaffResponseAt: timestamp,
          reminderSent: false,
          reminderSentAt: null,
          reminderCount: 0,
          lastReminderAt: null
        });
      } else {
        // Customer message - update last customer message time and reset no response needed status
        const messageType = customTimestamp ? 'initial customer issue' : 'customer message';
        logger.debug(`${messageType} from ${message.author.tag} in ticket ${ticket.id} - updating last customer message time to ${timestamp} and resetting no response needed status`);
        await this.reminderRepository.updateResponseTracking(ticket.id, {
          lastCustomerMessageAt: timestamp,
          noResponseNeeded: false  // Reset no response needed when customer sends new message
        });
      }
    } catch (error) {
      logger.error(`Error handling ticket message for reminder tracking: ${error.message}`);
    }
  }

  /**
   * Handle "no response needed" button click
   * @param {ButtonInteraction} interaction - The button interaction
   */
  async handleNoResponseNeeded(interaction) {
    try {
      const ticketId = interaction.customId.replace('no_response_needed_', '');
      
      // Check if user has permission (has reminder role or is admin)
      const settings = await this.reminderRepository.getReminderSettings(interaction.guild.id);
      const hasReminderRole = settings.reminderRoleId && interaction.member.roles.cache.has(settings.reminderRoleId);
      const isAdmin = interaction.member.permissions.has('Administrator');
      
      if (!hasReminderRole && !isAdmin) {
        return await interaction.reply({
          content: '❌ 您沒有權限執行此操作。',
          ephemeral: true
        });
      }
      
      // Update tracking to mark as no response needed
      await this.reminderRepository.updateResponseTracking(ticketId, {
        noResponseNeeded: true,
        reminderSent: false,
        reminderSentAt: null
      });
      
      // Disable the button
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const disabledActionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('no_response_disabled')
            .setLabel(`已標記為無須回應 - ${interaction.user.displayName}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true)
        );
      
      await interaction.update({
        components: [disabledActionRow]
      });
      
      logger.info(`Ticket ${ticketId} marked as no response needed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error handling no response needed: ${error.message}`);
      try {
        await interaction.reply({
          content: '❌ 處理請求時發生錯誤',
          ephemeral: true
        });
      } catch (replyError) {
        logger.error(`Error sending error reply: ${replyError.message}`);
      }
    }
  }

  /**
   * Handle ticket closure
   * @param {String} ticketId - The ticket ID
   */
  async handleTicketClosure(ticketId) {
    try {
      await this.reminderRepository.clearReminderTracking(ticketId);
    } catch (error) {
      logger.error(`Error clearing reminder tracking for closed ticket: ${error.message}`);
    }
  }

  /**
   * Get reminder settings for a guild
   * @param {String} guildId - The guild ID
   * @return {Promise<Object>} The reminder settings
   */
  async getReminderSettings(guildId) {
    return await this.reminderRepository.getReminderSettings(guildId);
  }

  /**
   * Update reminder settings for a guild
   * @param {String} guildId - The guild ID
   * @param {Object} settings - The settings to update
   * @return {Promise<Boolean>} Success status
   */
  async updateReminderSettings(guildId, settings) {
    return await this.reminderRepository.saveReminderSettings(guildId, settings);
  }

  /**
   * Get staff reminder preference
   * @param {String} userId - The user ID
   * @return {Promise<Boolean>} Whether the user wants to receive reminders
   */
  async getStaffPreference(userId) {
    return await this.reminderRepository.getStaffReminderPreference(userId);
  }

  /**
   * Update staff reminder preference
   * @param {String} userId - The user ID
   * @param {Boolean} receiveReminders - Whether to receive reminders
   * @return {Promise<Boolean>} Success status
   */
  async updateStaffPreference(userId, receiveReminders) {
    return await this.reminderRepository.setStaffReminderPreference(userId, receiveReminders);
  }
}

module.exports = new ReminderService();