const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');
const whmcsLogger = require('../whmcs-logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('services')
    .setDescription('顯示WHMCS服務列表')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('要查詢的使用者 (預設為您自己)')
        .setRequired(false)
    )
    .setDMPermission(false),
  
  module: null,
  
  setModule(module) {
    this.module = module;
  },
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Check if WHMCS integration is enabled
      if (!this.module || !this.module.service) {
        await interaction.editReply({ content: 'WHMCS整合模組未正確初始化。' });
        return;
      }
      
      // Determine which user to look up
      const targetUser = interaction.options.getUser('user');
      let userId = null;
      let isQueryingOther = false;
      let isTicketCreator = false;
      
      // If a target user was specified, use that
      if (targetUser) {
        userId = targetUser.id;
        isQueryingOther = userId !== interaction.user.id;
        whmcsLogger.debug(`Getting services for specified user: ${userId}`);
      } else {
        // No user specified - check if we're in a ticket channel
        if (interaction.channel) {
          try {
            // Get ticket info if we're in a ticket channel
            const ticketModule = this.module.bot.modules.get('ticket');
            if (ticketModule) {
              const ticket = await ticketModule.repository.getTicketByChannelId(interaction.channel.id);
              if (ticket) {
                // Use the ticket creator's ID
                userId = ticket.userId;
                isTicketCreator = true;
                isQueryingOther = userId !== interaction.user.id;
                whmcsLogger.debug(`Getting services for ticket creator: ${userId}`);
              }
            }
          } catch (error) {
            whmcsLogger.error(`Error getting ticket info: ${error.message}`);
          }
        }
        
        // If we're not in a ticket channel or couldn't get ticket info, use the command invoker's ID
        if (!userId) {
          userId = interaction.user.id;
          whmcsLogger.debug(`Getting services for command invoker: ${userId}`);
        }
      }
      
      whmcsLogger.debug(`Getting services for user ID: ${userId}`);
      
      // Check if user has permission to query other users
      if (isQueryingOther) {
        // Staff can check other users
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const hasPermission = member.permissions.has(PermissionFlagsBits.ManageGuild) || 
                             interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
        
        if (!hasPermission) {
          await interaction.editReply({ content: '您沒有權限查詢其他使用者的服務資訊。' });
          return;
        }
      }
      
      // Get user's services
      const servicesResult = await this.module.service.getClientServices(userId);
      
      whmcsLogger.debug(`Service result: ${JSON.stringify({
        success: servicesResult.success, 
        error: servicesResult.error,
        serviceCount: servicesResult.services ? servicesResult.services.length : 0
      })}`);
      
      if (!servicesResult.success) {
        // Check if we should use an embed for the error
        if (servicesResult.useEmbed && servicesResult.embed) {
          // Use the error embed
          await interaction.editReply({ embeds: [servicesResult.embed] });
          return;
        } else if (servicesResult.error && servicesResult.error.includes('No WHMCS account found')) {
          // Create an embed specifically for the unlinked account case
          const targetDescription = isQueryingOther ? 
            `該用戶的 Discord 帳號尚未與客戶中心帳號綁定，因此無法顯示服務資訊。` : 
            `您的 Discord 帳號尚未與客戶中心帳號綁定，因此無法顯示您的服務資訊。`;
          
          const unlinkEmbed = new EmbedBuilder()
            .setTitle('Discord 帳號未綁定')
            .setDescription(targetDescription)
            .addFields({
              name: '如何綁定帳號',
              value: '請登入[客戶中心](https://client.vproxy.cloud/clientarea.php)，進入客戶中心首頁右下進行綁定。'
            })
            .setColor('#f5a742')
            .setFooter({ text: '綁定帳號後，客服人員才能識別與確認用戶資訊。' });
          
          await interaction.editReply({ embeds: [unlinkEmbed] });
          return;
        } else {
          // Different message based on whose services we're looking up
          let message = '';
          if (isTicketCreator) {
            message = `無法獲取此客服單開單者的服務資訊：${servicesResult.error}`;
          } else if (isQueryingOther) {
            message = `無法獲取該使用者的服務資訊：${servicesResult.error}`;
          } else {
            message = `無法獲取您的服務資訊：${servicesResult.error}`;
          }
          
          await interaction.editReply({ content: message });
          return;
        }
      }
      
      if (!servicesResult.services || servicesResult.services.length === 0) {
        // Different message based on whose services we're looking up
        let message = '';
        if (isTicketCreator) {
          message = `未找到與此客服單開單者 <@${userId}> Discord帳號關聯的任何服務。`;
        } else if (isQueryingOther) {
          message = `未找到與 <@${userId}> Discord帳號關聯的任何服務。`;
        } else {
          message = '未找到與您的Discord帳號關聯的任何服務。';
        }
        
        await interaction.editReply({ content: message });
        return;
      }
      
      // Create embeds for services
      const embeds = this.module.service.createServiceEmbeds(servicesResult.services);
      
      if (!embeds || embeds.length === 0) {
        await interaction.editReply({ content: '服務資訊處理出錯，無法顯示服務列表。' });
        return;
      }
      
      whmcsLogger.debug(`Created ${embeds.length} embeds`);
      
      // Send the response with appropriate message
      let content = '';
      if (isTicketCreator) {
        content = `以下是此客服單開單者 <@${userId}> 的服務資訊：`;
      } else if (isQueryingOther) {
        content = `以下是 <@${userId}> 的服務資訊：`;
      } else {
        content = '以下是您的服務資訊：';
      }
      
      await interaction.editReply({ 
        content: content,
        embeds: embeds
      });
    } catch (error) {
      whmcsLogger.error(`Error executing services command: ${error.message}`);
      logger.error(`Error executing services command: ${error.message}`);
      await interaction.editReply({ content: `執行命令時發生錯誤：${error.message}` });
    }
  }
};