const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../core/logger');
const config = require('../../core/config');
const Embeds = require('../../utils/embeds');
const Permissions = require('../../utils/permissions');

class TicketController {
  constructor(ticketService) {
    this.ticketService = ticketService;
  }

  /**
   * Set up a ticket panel in a channel
   * @param {Interaction} interaction - The command interaction
   * @return {Promise<void>}
   */
  async setupPanel(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const channel = interaction.channel;
      
      // Check if the bot has the required permissions in this channel
      const requiredPermissions = Permissions.setupPermissions();
      if (!Permissions.botHasChannelPermission(channel, requiredPermissions)) {
        const missingPermissions = Permissions.getMissingPermissions(
          channel, 
          interaction.guild.members.me, 
          requiredPermissions
        );
        await interaction.editReply({
          content: `我沒有在此頻道設置客服單面板的權限。缺少權限: ${missingPermissions.join(', ')}`
        });
        return;
      }
      
      // Create and send the panel message
      const embed = Embeds.ticketPanelEmbed();
      const buttons = Embeds.ticketPanelButtons();
      
      const message = await channel.send({
        embeds: [embed],
        components: [buttons]
      });
      
      // Save the panel info in the database
      await this.ticketService.savePanel(interaction.guild.id, channel.id, message.id);
      
      await interaction.editReply({
        content: '客服單面板已成功設置！'
      });
    } catch (error) {
      logger.error(`Error setting up panel: ${error.message}`);
      await interaction.editReply({
        content: `設置面板時出錯: ${error.message}`
      });
    }
  }

  /**
   * Restore panels when the bot starts up
   * @param {Client} client - The Discord.js client
   * @return {Promise<void>}
   */
  async restorePanels(client) {
    try {
      const panels = await this.ticketService.getPanels();
      if (!panels || panels.length === 0) {
        logger.info('No panels to restore');
        return;
      }
      
      logger.info(`Restoring ${panels.length} ticket panels...`);
      
      for (const panel of panels) {
        try {
          const guild = await client.guilds.fetch(panel.guildId);
          if (!guild) continue;
          
          const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
          if (!channel) continue;
          
          // Try to fetch the existing message
          try {
            await channel.messages.fetch(panel.messageId);
            logger.info(`Panel already exists in channel ${channel.name} in guild ${guild.name}`);
          } catch (error) {
            // Message was deleted, create a new one
            logger.info(`Recreating panel in channel ${channel.name} in guild ${guild.name}`);
            const embed = Embeds.ticketPanelEmbed();
            const buttons = Embeds.ticketPanelButtons();
            
            const message = await channel.send({
              embeds: [embed],
              components: [buttons]
            });
            
            // Update the panel info in the database
            await this.ticketService.savePanel(guild.id, channel.id, message.id);
          }
        } catch (error) {
          logger.error(`Error restoring panel in guild ${panel.guildId}: ${error.message}`);
          continue;
        }
      }
      
      logger.info('Panel restoration completed');
    } catch (error) {
      logger.error(`Error restoring panels: ${error.message}`);
    }
  }

  /**
   * Start the ticket creation process
   * @param {Interaction} interaction - The button interaction
   * @param {String} departmentId - The department ID
   * @return {Promise<void>}
   */
  async startTicketCreation(interaction, departmentId) {
    try {
      // Check if the user already has an open ticket for this department
      const existingTicket = await this.ticketService.getUserTicketByDepartment(
        interaction.user.id,
        departmentId
      );
      
      if (existingTicket) {
        await interaction.reply({
          content: `您已經有一個開放的客服單 (頻道: <#${existingTicket.channelId}>)。請先關閉它再創建新的。`,
          ephemeral: true
        });
        return;
      }
      
      // Create a modal for the user to describe their issue
      const modal = new ModalBuilder()
        .setCustomId(`ticket_create_modal:${departmentId}`)
        .setTitle('創建客服單');
      
      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticketDescription')
        .setLabel('請簡要描述您的問題')
        .setPlaceholder('請提供足夠的細節，以幫助我們更快地解決您的問題')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);
      
      const firstActionRow = new ActionRowBuilder().addComponents(descriptionInput);
      modal.addComponents(firstActionRow);
      
      await interaction.showModal(modal);
    } catch (error) {
      logger.error(`Error starting ticket creation: ${error.message}`);
      await interaction.reply({
        content: '創建客服單時出錯。請稍後再試。',
        ephemeral: true
      });
    }
  }

  /**
   * Create a new ticket
   * @param {Interaction} interaction - The modal submit interaction
   * @param {String} departmentId - The department ID
   * @param {String} description - The ticket description
   * @return {Promise<void>}
   */
  async createTicket(interaction, departmentId, description) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get department details
      const department = await this.ticketService.getDepartment(departmentId);
      if (!department) {
        await interaction.editReply({
          content: '無效的部門ID。請聯繫管理員。'
        });
        return;
      }
      
      // Generate a unique ticket ID
      const ticketId = Math.floor(100000 + Math.random() * 900000).toString();
      const ticketUuid = uuidv4();
      
      // Create a channel for the ticket
      const guild = interaction.guild;
      const user = interaction.user;
      
      // Check for department roles
      const departmentRoles = await this.ticketService.getDepartmentRoles(departmentId);
      
      // Create the channel name
      const channelName = `ticket-${department.id}-${ticketId}`;
      
      // Create permission overwrites for the channel
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ];
      
      // Add permissions for department roles
      for (const roleId of departmentRoles) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }
      
      // Handle category channel
      let categoryId = department.categoryId;
      let categoryChannel = null;

      // Check if we should use category channels and if there's a saved category
      if (config.useCategoryChannels) {
        if (categoryId) {
          try {
            // Try to get existing category
            categoryChannel = await guild.channels.fetch(categoryId).catch(() => null);
          } catch (error) {
            logger.warn(`Could not fetch category channel: ${error.message}`);
          }
        }

        // If no category exists, create one
        if (!categoryChannel) {
          try {
            categoryChannel = await guild.channels.create({
              name: `${department.name} 客服單`,
              type: ChannelType.GuildCategory,
              permissionOverwrites: permissionOverwrites
            });

            // Save the category ID
            categoryId = categoryChannel.id;
            await this.ticketService.updateDepartmentCategory(departmentId, categoryId);
            logger.info(`Created new category channel for department ${department.name}: ${categoryId}`);
          } catch (error) {
            logger.error(`Failed to create category channel: ${error.message}`);
          }
        }
      }

      // Create the ticket channel
      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: permissionOverwrites
      };

      // If we have a category, set it
      if (categoryChannel) {
        channelOptions.parent = categoryChannel.id;
      }

      const channel = await guild.channels.create(channelOptions);
      
      // Store the ticket in the database
      const ticket = {
        id: ticketUuid,
        channelId: channel.id,
        userId: user.id,
        departmentId: departmentId,
        status: 'open',
        description: description,
        createdAt: new Date()
      };
      
      await this.ticketService.createTicket(ticket);
      
      // Send initial messages in the ticket channel
      const ticketEmbed = Embeds.ticketInfoEmbed({
        id: ticketId,
        departmentId: departmentId,
        description: description,
        createdAt: new Date()
      }, user.tag);
      
      const buttonsRow = Embeds.ticketControlButtons();
      
      await channel.send({ content: `<@${user.id}> 歡迎來到您的客服單。` });
      await channel.send({ embeds: [ticketEmbed], components: [buttonsRow] });
      
      // Save the initial message in the database
      await this.ticketService.saveMessage({
        id: uuidv4(),
        ticketId: ticketUuid,
        userId: guild.members.me.id,
        content: JSON.stringify({ embeds: [ticketEmbed], components: [buttonsRow] }),
        timestamp: new Date()
      });
      
      // Reply to the user with a link to the channel
      await interaction.editReply({
        content: `您的客服單已創建成功！請前往 <#${channel.id}> 繼續。`
      });
    } catch (error) {
      logger.error(`Error creating ticket: ${error.message}`);
      await interaction.editReply({
        content: `創建客服單時出錯: ${error.message}`
      });
    }
  }

  /**
   * Handle the close ticket button click
   * @param {Interaction} interaction - The button interaction
   * @return {Promise<void>}
   */
  async closeTicket(interaction) {
    try {
      const embed = Embeds.confirmationEmbed(
        '關閉客服單',
        '您確定要關閉這個客服單嗎？所有對話記錄將被保存，但頻道會被刪除。'
      );
      
      const buttons = Embeds.confirmationButtons('confirm_close');
      
      await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: true
      });
    } catch (error) {
      logger.error(`Error closing ticket: ${error.message}`);
      await interaction.reply({
        content: '關閉客服單時出錯。請稍後再試。',
        ephemeral: true
      });
    }
  }

  /**
   * Handle the confirmation of closing a ticket
   * @param {Interaction} interaction - The button interaction
   * @return {Promise<void>}
   */
  async confirmCloseTicket(interaction) {
    await interaction.update({ content: '正在關閉客服單...', components: [], embeds: [] });
    
    try {
      // Get the ticket from the database
      const ticket = await this.ticketService.getTicketByChannelId(interaction.channel.id);
      
      if (!ticket) {
        await interaction.editReply({
          content: '找不到與此頻道相關的客服單。'
        });
        return;
      }
      
      // Update the ticket status in the database
      await this.ticketService.closeTicket(ticket.id);
      
      // Send final message before deleting
      await interaction.channel.send({
        content: `此客服單已被 ${interaction.user.tag} 關閉。頻道將在 5 秒後刪除...`
      });
      
      // Archive all messages to the database
      await this.archiveTicketMessages(interaction.channel, ticket.id);
      
      // Wait 5 seconds then delete the channel
      setTimeout(async () => {
        try {
          await interaction.channel.delete('客服單已關閉');
        } catch (error) {
          logger.error(`Error deleting ticket channel: ${error.message}`);
        }
      }, 5000);
    } catch (error) {
      logger.error(`Error confirming ticket close: ${error.message}`);
      await interaction.editReply({
        content: `關閉客服單時出錯: ${error.message}`
      });
    }
  }

  /**
   * Archive all messages from a ticket channel
   * @param {TextChannel} channel - The ticket channel
   * @param {String} ticketId - The ticket ID
   * @return {Promise<void>}
   */
  async archiveTicketMessages(channel, ticketId) {
    try {
      let lastId = null;
      let allMessages = [];
      let fetchedMessages;
      
      // Fetch all messages in batches of 100
      do {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        
        fetchedMessages = await channel.messages.fetch(options);
        allMessages.push(...fetchedMessages.values());
        
        if (fetchedMessages.size > 0) {
          lastId = fetchedMessages.last().id;
        }
      } while (fetchedMessages.size === 100);
      
      // Sort messages by timestamp (oldest first)
      allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      // Save each message to the database
      for (const message of allMessages) {
        // Skip bot's own messages that have already been saved
        if (message.author.bot && message.embeds.length > 0) continue;
        
        // Process message content
        let content = message.content;
        
        // Handle attachments by adding their URLs to the content
        if (message.attachments.size > 0) {
          content += '\n\nAttachments:\n' + 
            [...message.attachments.values()].map(att => att.url).join('\n');
        }
        
        // Save the message
        await this.ticketService.saveMessage({
          id: message.id,
          ticketId: ticketId,
          userId: message.author.id,
          content: content,
          timestamp: message.createdAt
        });
      }
      
      logger.info(`Archived ${allMessages.length} messages for ticket ${ticketId}`);
    } catch (error) {
      logger.error(`Error archiving ticket messages: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TicketController;