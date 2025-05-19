const logger = require('../../core/logger');
const whmcsLogger = require('./whmcs-logger');
const config = require('../../core/config');
const { EmbedBuilder } = require('discord.js');

/**
 * Ticket integration utility for WHMCS services
 */
class TicketIntegration {
  constructor(whmcsService) {
    this.whmcsService = whmcsService;
  }

  /**
   * Get services for a Discord user and create embeds
   * @param {string} discordUserId - The Discord user ID
   * @returns {Promise<Object>} Object containing embeds and error information
   */
  async getServicesForTicket(discordUserId) {
    try {
      // Skip if WHMCS integration is disabled
      if (!config.whmcs || !config.whmcs.enabled) {
        return { success: false, error: 'WHMCS integration is disabled', embeds: [] };
      }

      // Get client services
      const servicesResult = await this.whmcsService.getClientServices(discordUserId);
      
      if (!servicesResult.success || servicesResult.services.length === 0) {
        return { 
          success: false, 
          error: servicesResult.error || 'No services found', 
          embeds: []
        };
      }

      // Create embeds for services
      const embeds = this.whmcsService.createServiceEmbeds(servicesResult.services);
      
      return {
        success: true,
        embeds: embeds,
        services: servicesResult.services
      };
    } catch (error) {
      whmcsLogger.error(`Error getting services for ticket: ${error.message}`);
      logger.error(`Error getting services for ticket: ${error.message}`);
      return {
        success: false,
        error: `Error retrieving services: ${error.message}`,
        embeds: []
      };
    }
  }

  /**
   * Add WHMCS services to a ticket channel
   * @param {Object} channel - The Discord ticket channel
   * @param {string} userId - The Discord user ID
   * @returns {Promise<boolean>} Success status
   */
  async addServicesToTicket(channel, userId) {
    try {
      whmcsLogger.debug(`Adding services to ticket for user ${userId} in channel ${channel.id}`);
      const servicesResult = await this.getServicesForTicket(userId);
      
      if (!servicesResult.success || !servicesResult.embeds || servicesResult.embeds.length === 0) {
        // Always send a message, even if no services found
        whmcsLogger.info(`No services found for user ${userId}: ${servicesResult.error}`);
        
        // Check if we should use an embed or if the error is about no linked account
        if (servicesResult.useEmbed && servicesResult.embed) {
          // Send the error embed
          await channel.send({ embeds: [servicesResult.embed] });
        } else if (servicesResult.error && servicesResult.error.includes('No WHMCS account found')) {
          // Create an embed specifically for the unlinked account case
          const unlinkEmbed = new EmbedBuilder()
            .setTitle('Discord 帳號未綁定')
            .setDescription('您的 Discord 帳號尚未與客戶中心帳號綁定，因此無法顯示您的服務資訊。')
            .addFields({
              name: '如何綁定帳號',
              value: '請登入[客戶中心](https://client.vproxy.cloud/clientarea.php)，進入客戶中心首頁右下進行綁定。'
            })
            .setColor('#f5a742')
            .setFooter({ text: '綁定帳號後，客服人員才能識別與確認用戶資訊。' });
          
          await channel.send({ embeds: [unlinkEmbed] });
        } else {
          // Send generic "no services found" message for other errors
          await channel.send({ 
            content: `我們無法找到與您Discord帳號關聯的WHMCS服務。\n原因: ${servicesResult.error || '未知錯誤'}`
          });
        }
        
        return false;
      }

      // Send embeds to the channel
      whmcsLogger.debug(`Found ${servicesResult.embeds.length} embeds to send`);
      await channel.send({ 
        content: '以下是您的服務資訊：',
        embeds: servicesResult.embeds 
      });
      
      whmcsLogger.debug('Services added successfully');
      return true;
    } catch (error) {
      whmcsLogger.error(`Error adding services to ticket: ${error.message}`);
      whmcsLogger.error(error.stack);
      logger.error(`Error adding services to ticket: ${error.message}`);
      
      // Try to send an error message to the channel
      try {
        await channel.send({ 
          content: '在獲取您的服務資訊時發生錯誤，請稍後再試。'
        });
      } catch (e) {
        whmcsLogger.error(`Could not send error message to channel: ${e.message}`);
      }
      
      return false;
    }
  }
}

module.exports = TicketIntegration;