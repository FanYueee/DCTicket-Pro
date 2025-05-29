const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../core/logger');
const config = require('../../core/config');
const Embeds = require('../../utils/embeds');
const Permissions = require('../../utils/permissions');
const { service: aiService } = require('../ai');
const reminderService = require('./reminder/service');
const moment = require('moment-timezone');

class TicketController {
  constructor(ticketService) {
    this.ticketService = ticketService;
    
    // Create a set to track AI responses that have been sent
    this.sentAIResponses = new Set();
    
    // Create a set to track processed user messages to prevent duplicate AI processing
    this.processedUserMessages = new Set();
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
      
      // Check if we can respond to this interaction
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '創建客服單時出錯。請稍後再試。',
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply to interaction: ${replyError.message}`);
      }
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
      
      // Early response to user for better UX
      await interaction.editReply({
        content: '正在創建您的客服單，請稍候...'
      });

      // Generate a unique UUID
      const ticketUuid = uuidv4();
      // Get the first section of the UUID (before the first dash)
      const uuidFirstSection = ticketUuid.split('-')[0];

      // Create a channel for the ticket
      const guild = interaction.guild;
      const user = interaction.user;

      // Check for department roles
      const departmentRoles = await this.ticketService.getDepartmentRoles(departmentId);

      // Create the channel name with department name and UUID first section
      const channelName = `${department.name}-${uuidFirstSection}`;

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

      // Determine initial status (check if within service hours)
      const initialStatus = 'open';

      // Store the ticket in the database
      const ticket = {
        id: ticketUuid,
        channelId: channel.id,
        userId: user.id,
        departmentId: departmentId,
        status: initialStatus,
        createdAt: moment().tz(config.timezone || 'Asia/Taipei').toDate()
      };

      await this.ticketService.createTicket(ticket);

      // Save the description as a special message
      await this.ticketService.saveMessage({
        id: uuidv4(),
        ticketId: ticketUuid,
        userId: user.id,
        username: user.tag,
        content: JSON.stringify({isDescription: true, text: description}),
        timestamp: new Date()
      });

      // Send initial messages in the ticket channel
      const ticketEmbed = Embeds.ticketInfoEmbed({
        id: uuidFirstSection,
        departmentId: departmentId,
        description: description, // Use the original description value
        status: initialStatus,
        createdAt: moment().tz(config.timezone || 'Asia/Taipei').toDate()
      }, user.tag);

      // Check if AI is enabled to determine whether to show handoff button
      const showHandoffButton = config.ai && config.ai.enabled;
      const buttonsRow = Embeds.ticketControlButtons(showHandoffButton);

      await channel.send({ content: `<@${user.id}> 歡迎來到您的客服單。` });
      await channel.send({ embeds: [ticketEmbed], components: [buttonsRow] });

      // Save the initial message in the database
      await this.ticketService.saveMessage({
        id: uuidv4(),
        ticketId: ticketUuid,
        userId: guild.members.me.id,
        username: guild.members.me.user.tag,
        content: JSON.stringify({
          embeds: [ticketEmbed],
          components: [buttonsRow]
        }),
        timestamp: new Date()
      });

      // Initialize AI conversation if AI is enabled
      if (config.ai && config.ai.enabled) {
        try {
          // Initialize AI conversation context with the initial description and department ID
          await aiService.context.initializeContext(ticketUuid, description, ticket.departmentId);

          // Check if we're within service hours when creating ticket
          const isWithinHours = await aiService.isWithinServiceHours(guild.id);
          logger.debug(`Service hours check for ticket creation: within hours=${isWithinHours}, timezone=${config.timezone}`);

          // If outside service hours, send the new ticket off-hours message
          if (!isWithinHours) {
            // Check if it's a holiday
            const serviceHoursModule = require('../service-hours');
            const holiday = await serviceHoursModule.service.checkHoliday(guild.id);
            
            if (holiday) {
              // Send holiday embed
              const timezone = config.timezone || 'Asia/Taipei';
              let nextServiceTime = null;
              
              if (!holiday.is_recurring && holiday.end_date) {
                nextServiceTime = moment(holiday.end_date).tz(timezone).format('YYYY-MM-DD HH:mm');
              } else {
                const next = await serviceHoursModule.service.getNextServiceTime(guild.id);
                nextServiceTime = moment(next).tz(timezone).format('YYYY-MM-DD HH:mm');
              }
              
              const holidayEmbed = Embeds.holidayEmbed(holiday, nextServiceTime);
              await channel.send({ embeds: [holidayEmbed] });
              
              // Save the holiday message to database
              await this.ticketService.saveMessage({
                id: uuidv4(),
                ticketId: ticketUuid,
                userId: guild.members.me.id,
                username: guild.members.me.user.tag,
                content: JSON.stringify({
                  isHolidayNotice: true,
                  holidayId: holiday.id,
                  timestamp: moment().tz(timezone).toISOString(),
                  message: `Holiday: ${holiday.name}`
                }),
                timestamp: moment().tz(timezone).toDate()
              });
            } else {
              // Regular off-hours message
              const newTicketOffHoursMessage = await aiService.getNewTicketOffHoursMessage(guild.id);
              await channel.send(newTicketOffHoursMessage);

              // Save the message to the database with a special tag
              await this.ticketService.saveMessage({
                id: uuidv4(),
                ticketId: ticketUuid,
                userId: guild.members.me.id,
                username: guild.members.me.user.tag,
                content: JSON.stringify({
                  isNewTicketOffHoursNotice: true,
                  timestamp: moment().tz(config.timezone || 'Asia/Taipei').toISOString(),
                  message: newTicketOffHoursMessage
                }),
                timestamp: moment().tz(config.timezone || 'Asia/Taipei').toDate()
              });
            }
          }

          // Process the initial description with AI
          logger.info(`Processing initial ticket message with department ID: ${ticket.departmentId}`);
          const aiResponse = await aiService.processMessage(ticket, description);

          if (aiResponse) {
            // Keep the ticket in 'open' status when AI is handling it
            // (Simplified status system: open → waitingStaff → closed)

            // Generate a new message ID for the Discord message
            const discordMessageId = uuidv4();
            
            // Send AI response
            const sentMessage = await channel.send({ content: aiResponse });
            
            // Track that we've already sent this response
            this.sentAIResponses.add(sentMessage.id);
            
            // Save the AI response in our special format
            await this.ticketService.saveMessage({
              id: discordMessageId,
              ticketId: ticketUuid,
              userId: guild.members.me.id,
              username: guild.members.me.user.tag,
              content: aiResponse,
              isAI: true,
              timestamp: new Date()
            });
          }
        } catch (error) {
          logger.error(`Error initializing AI for ticket: ${error.message}`);
        }
      }

      // Update reply to the user with a link to the channel
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
      
      // Check if we can respond to this interaction
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '關閉客服單時出錯。請稍後再試。',
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply to interaction: ${replyError.message}`);
      }
    }
  }

  /**
   * Handle the resolve ticket button click
   * @param {Interaction} interaction - The button interaction
   * @return {Promise<void>}
   */
  async resolveTicket(interaction) {
    try {
      // Get the ticket from the database
      const ticket = await this.ticketService.getTicketByChannelId(interaction.channel.id);

      if (!ticket) {
        await interaction.reply({
          content: '找不到與此頻道相關的客服單。',
          ephemeral: true
        });
        return;
      }

      // Update ticket status to closed directly
      await this.ticketService.updateTicketStatus(ticket.id, 'closed');

      // Get department details for the embed
      const department = await this.ticketService.getDepartment(ticket.departmentId);

      // Get user details
      const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
      const userTag = user ? user.tag : 'Unknown User';

      // Get the ticket description from messages
      const messages = await this.ticketService.getTicketMessages(ticket.id);
      let description = '無描述';

      // Find the description message
      for (const message of messages) {
        try {
          const content = JSON.parse(message.content);
          if (content.isDescription) {
            description = content.text;
            break;
          }
        } catch (e) {
          // Not a JSON message, skip
        }
      }

      // Create updated ticket info embed
      const ticketEmbed = Embeds.ticketInfoEmbed({
        id: ticket.id.split('-')[0],
        departmentId: ticket.departmentId,
        description: description,
        status: 'closed',
        createdAt: ticket.createdAt
      }, userTag);

      // Create control buttons
      const buttonsRow = Embeds.ticketControlButtons(false);

      // Send notification message
      await interaction.reply({
        content: `✅ 此客服單已被 ${interaction.user.tag} 標記為已解決。`,
      });

      // Update the ticket embed with new status
      await interaction.channel.send({
        embeds: [ticketEmbed],
        components: [buttonsRow]
      });

    } catch (error) {
      logger.error(`Error resolving ticket: ${error.message}`);
      await interaction.reply({
        content: '標記客服單為已解決時出錯。請稍後再試。',
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

      // First update ticket status to closed then close the ticket
      await this.ticketService.updateTicketStatus(ticket.id, 'closed');
      await this.ticketService.closeTicket(ticket.id);

      // Clear reminder tracking for closed ticket
      await reminderService.handleTicketClosure(ticket.id);
      
      // Remove send message permissions for all users to prevent further messages
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });
      
      // For the ticket creator
      if (ticket.userId) {
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
          SendMessages: false
        }).catch(() => {}); // Ignore errors if user left server
      }
      
      // For department roles
      const departmentRoles = await this.ticketService.getDepartmentRoles(ticket.departmentId);
      for (const roleId of departmentRoles) {
        await interaction.channel.permissionOverwrites.edit(roleId, {
          SendMessages: false
        }).catch(() => {}); // Ignore errors if role was deleted
      }
      
      // Archive all messages to the database
      await this.archiveTicketMessages(interaction.channel, ticket.id);
      
      // Send final message before deleting
      await interaction.channel.send({
        content: `此客服單已被 ${interaction.user.tag} 關閉。頻道將在 5 秒後刪除...`
      });
      
      // Send ticket transcript to user
      try {
        // Export the ticket and send it to the user
        const success = await this.ticketService.sendTicketTranscriptToUser(ticket.id, interaction.client);
        if (!success) {
          logger.warn(`Failed to send ticket transcript to user ${ticket.userId} for ticket ${ticket.id}`);
        }
      } catch (transcriptError) {
        logger.error(`Error sending ticket transcript: ${transcriptError.message}`);
        // Don't stop the ticket closing process if sending transcript fails
      }

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
   * Handle human handoff button click
   * @param {Interaction} interaction - The button interaction
   * @return {Promise<void>}
   */
  async handleHumanHandoff(interaction) {
    try {
      // Get the ticket from the database
      const ticket = await this.ticketService.getTicketByChannelId(interaction.channel.id);

      if (!ticket) {
        await interaction.reply({
          content: '找不到與此頻道相關的客服單。',
          ephemeral: true
        });
        return;
      }

      // Allow human handoff at any time, but include a note if it's outside service hours
      const isWithinHours = await aiService.isWithinServiceHours(interaction.guild.id);

      // Save the off-hours notice information if outside service hours
      // But we'll send it AFTER the embed message
      let offHoursMessage = null;
      if (!isWithinHours) {
        offHoursMessage = await aiService.getOffHoursMessage(interaction.guild.id);

        // Save the off-hours message to the database with a special tag
        await this.ticketService.saveMessage({
          id: uuidv4(),
          ticketId: ticket.id,
          userId: interaction.client.user.id,
          username: interaction.client.user.tag,
          content: JSON.stringify({
            isOffHoursNotice: true,
            timestamp: moment().tz(config.timezone || 'Asia/Taipei').toISOString(),
            message: offHoursMessage
          }),
          timestamp: moment().tz(config.timezone || 'Asia/Taipei').toDate()
        });
      }

      logger.debug(`Handling human handoff for ticket ${ticket.id}`);
      
      // Update the ticket status to waiting for staff and mark as human handled
      await this.ticketService.updateTicketStatus(ticket.id, 'waitingStaff');
      logger.debug(`Updated ticket status to waitingStaff`);
      
      await this.ticketService.updateTicketAIHandled(ticket.id, false);
      logger.debug(`Updated AI handled to false`);
      
      // Mark ticket as requiring human handling (this sets human_handled = 1)
      await this.ticketService.assignTicketToStaff(ticket.id, null); // null staff ID means any staff can handle
      logger.debug(`Assigned ticket to staff (human_handled should now be 1)`);
      
      // Initialize reminder tracking with the ticket creation time as the "last customer message"
      // This way, the countdown starts from when the ticket was created
      const mockMessage = { author: { tag: 'System', id: ticket.userId } };
      await reminderService.handleTicketMessage(mockMessage, ticket, false, ticket.createdAt);

      // Get department details for mention
      const department = await this.ticketService.getDepartment(ticket.departmentId);
      const departmentRoles = await this.ticketService.getDepartmentRoles(ticket.departmentId);

      // Create role mentions for notification
      const roleMentions = departmentRoles.map(roleId => `<@&${roleId}>`).join(' ');

      // Update the ticket embed to show new status
      const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
      const userTag = user ? user.tag : 'Unknown User';

      // Get the ticket description from messages
      const messages = await this.ticketService.getTicketMessages(ticket.id);
      let description = '無描述';

      // Find the description message
      for (const message of messages) {
        try {
          const content = JSON.parse(message.content);
          if (content.isDescription) {
            description = content.text;
            break;
          }
        } catch (e) {
          // Not a JSON message, skip
        }
      }

      // Create new ticket info embed with updated status
      const ticketEmbed = Embeds.ticketInfoEmbed({
        id: ticket.id.split('-')[0],
        departmentId: ticket.departmentId,
        description: description,
        status: 'waitingStaff',
        createdAt: ticket.createdAt
      }, userTag);

      // Send notification and update ticket status
      await interaction.update({
        content: '正在轉接至人工客服...',
        components: []
      });

      // Send notification to department roles
      await interaction.channel.send({
        content: `${roleMentions}\n\n此客服單已請求人工協助，請盡快回應。`,
        embeds: [ticketEmbed],
        components: [Embeds.ticketControlButtons(false)] // No handoff button needed anymore
      });

      // Send confirmation to the user
      await interaction.followUp({
        content: '已通知客服人員，請稍候片刻。',
        ephemeral: true
      });

      // Now send the off-hours message if needed (after the embed and confirmation)
      if (offHoursMessage) {
        await interaction.channel.send(offHoursMessage);
      }
    } catch (error) {
      logger.error(`Error handling human handoff: ${error.message}`);
      
      // Check if we can respond to this interaction
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '轉接人工客服時出錯。請稍後再試。',
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply to interaction: ${replyError.message}`);
      }
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
        
        // Skip messages we've already saved as AI responses
        if (this.sentAIResponses.has(message.id)) {
          continue;
        }

        // Process message content
        let content = message.content;

        // Handle attachments by adding their URLs to the content
        if (message.attachments.size > 0) {
          content += '\n\nAttachments:\n' +
            [...message.attachments.values()].map(att => att.url).join('\n');
        }

        // Save the message with author username
        await this.ticketService.saveMessage({
          id: message.id,
          ticketId: ticketId,
          userId: message.author.id,
          username: message.author.tag || message.author.username || 'Unknown User',
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

  /**
   * Handle user messages in ticket channels for AI processing
   * @param {Message} message - The Discord message
   * @return {Promise<void>}
   */
  async handleTicketMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore messages not in guild channels
    if (!message.guild || !message.channel) return;
    
    // Prevent duplicate processing of the same message
    if (this.processedUserMessages.has(message.id)) {
      logger.info(`Skipping already processed message ${message.id}`);
      return;
    }
    
    // Mark this message as being processed
    this.processedUserMessages.add(message.id);

    try {
      // Check if this is a ticket channel
      const ticket = await this.ticketService.getTicketByChannelId(message.channel.id);
      if (!ticket) return; // Not a ticket channel

      // Check if message is from staff or customer
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      let isStaff = false;
      if (member) {
        const departmentRoles = await this.ticketService.getDepartmentRoles(ticket.departmentId);
        isStaff = departmentRoles.some(roleId => member.roles.cache.has(roleId));
      }

      logger.debug(`Processing message in ticket ${ticket.id}: ` +
        `status=${ticket.status}, human_handled=${ticket.human_handled}, ` +
        `isStaff=${isStaff}, authorId=${message.author.id}, ticketUserId=${ticket.userId}`);

      // Handle reminder tracking first (for both staff and customer messages)
      if (ticket.status === 'waitingStaff' || ticket.human_handled) {
        if (isStaff) {
          // Staff response
          await reminderService.handleTicketMessage(message, ticket, true);
        } else if (message.author.id === ticket.userId) {
          // Customer message
          await reminderService.handleTicketMessage(message, ticket, false);
        }
      }

      // Skip AI processing if AI is disabled or ticket is waiting for staff
      if (!config.ai || !config.ai.enabled || ticket.status === 'waitingStaff') return;

      // Skip AI processing if the message author isn't the ticket creator
      if (message.author.id !== ticket.userId) {
        if (isStaff) {
          // Update ticket to waiting for staff status
          await this.ticketService.updateTicketStatus(ticket.id, 'waitingStaff');
          await this.ticketService.assignTicketToStaff(ticket.id, message.author.id);

          // Update the ticket embed with new status
          const user = await message.client.users.fetch(ticket.userId).catch(() => null);
          const userTag = user ? user.tag : 'Unknown User';

          // Get the ticket description from messages
          const messages = await this.ticketService.getTicketMessages(ticket.id);
          let description = '無描述';

          // Find the description message
          for (const message of messages) {
            try {
              const content = JSON.parse(message.content);
              if (content.isDescription) {
                description = content.text;
                break;
              }
            } catch (e) {
              // Not a JSON message, skip
            }
          }

          // Create updated ticket info embed
          const ticketEmbed = Embeds.ticketInfoEmbed({
            id: ticket.id.split('-')[0],
            departmentId: ticket.departmentId,
            description: description,
            status: 'waitingStaff',
            createdAt: ticket.createdAt
          }, userTag);

          // Send updated status message
          await message.channel.send({
            content: `<@${message.author.id}> 已接手處理此客服單。`,
            embeds: [ticketEmbed],
            components: [Embeds.ticketControlButtons(false)]
          });
        }
        return;
      }

      // Check if we're within service hours before processing
      const isWithinHours = await aiService.isWithinServiceHours(message.guild.id);

      // Check if we should send an off-hours notice to the user
      if (!isWithinHours) {
        // Check if we've sent an off-hours notice in the last hour
        const messages = await this.ticketService.getTicketMessages(ticket.id);
        let shouldSendOffHoursMessage = true;
        
        // Use timezone-aware date calculation for the cooldown
        const timezone = config.timezone || 'Asia/Taipei';
        const now = moment().tz(timezone);
        const oneHourAgo = now.clone().subtract(1, 'hour').toDate(); // 1 hour cooldown
        
        logger.debug(`Checking off-hours message cooldown. Current time: ${now.format('YYYY-MM-DD HH:mm:ss')} (${timezone}), Cooldown from: ${moment(oneHourAgo).format('YYYY-MM-DD HH:mm:ss')}`);

        // Check recent messages for off-hours notices
        for (const msg of messages) {
          try {
            const content = JSON.parse(msg.content);
            if (content.isOffHoursNotice) {
              // Parse timestamp with timezone awareness
              const noticeTime = moment.tz(content.timestamp, config.timezone || 'Asia/Taipei').toDate();
              // If we sent a notice less than an hour ago, don't send another
              if (noticeTime > oneHourAgo) {
                shouldSendOffHoursMessage = false;
                break;
              }
            }
          } catch (e) {
            // Not a JSON message or not our off-hours notice, skip
          }
        }

        // If we should send the off-hours notice
        if (shouldSendOffHoursMessage) {
          const offHoursMessage = await aiService.getOffHoursMessage(message.guild.id);

          // Save the off-hours message with a timestamp
          await this.ticketService.saveMessage({
            id: uuidv4(),
            ticketId: ticket.id,
            userId: message.client.user.id,
            username: message.client.user.tag,
            content: JSON.stringify({
              isOffHoursNotice: true,
              timestamp: moment().tz(config.timezone || 'Asia/Taipei').toISOString(),
              message: offHoursMessage
            }),
            timestamp: moment().tz(config.timezone || 'Asia/Taipei').toDate()
          });

          // Send the message
          await message.channel.send(offHoursMessage);
        }
      }

      // Save user message to database to ensure it's captured in our records
      await this.ticketService.saveMessage({
        id: message.id,
        ticketId: ticket.id,
        userId: message.author.id,
        username: message.author.tag || message.author.username || "Unknown User",
        content: message.content,
        timestamp: message.createdAt
      });

      // Process the message with AI and get a response
      const aiResponse = await aiService.processMessage(ticket, message.content);

      if (aiResponse) {
        // Generate a new message ID for the Discord message
        const discordMessageId = uuidv4();
        
        // Send the AI response
        const sentMessage = await message.channel.send(aiResponse);
        
        // Track that we've already sent this response to avoid duplicate saving
        this.sentAIResponses.add(sentMessage.id);
        
        // Save AI response as a regular message in DB - using the same ID as the discord message
        await this.ticketService.saveMessage({
          id: discordMessageId,
          ticketId: ticket.id,
          userId: message.client.user.id,
          username: message.client.user.tag,
          content: aiResponse,
          isAI: true,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Error handling ticket message: ${error.message}`);
    }
  }

  /**
   * Transfer a ticket to another department
   * @param {Interaction} interaction - The command interaction
   * @param {Object} ticket - The ticket object
   * @param {String} targetDepartmentId - The target department ID
   * @return {Promise<void>}
   */
  async transferTicket(interaction, ticket, targetDepartmentId) {
    try {
      await interaction.deferReply();

      // Get department information
      const currentDepartment = await this.ticketService.getDepartment(ticket.departmentId);
      const targetDepartment = await this.ticketService.getDepartment(targetDepartmentId);
      
      if (!targetDepartment) {
        await interaction.editReply({
          content: '找不到目標部門。'
        });
        return;
      }

      // Get the guild and user
      const guild = interaction.guild;
      const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
      
      if (!user) {
        await interaction.editReply({
          content: '無法找到客服單的原始用戶。'
        });
        return;
      }

      // Get the current channel
      const currentChannel = interaction.channel;
      
      // Verify channel still exists
      if (!currentChannel || currentChannel.deleted) {
        await interaction.editReply({
          content: '頻道已被刪除，無法完成轉移。'
        });
        return;
      }
      
      // Extract the ticket ID from current channel name (the UUID first section)
      const currentChannelName = currentChannel.name;
      const ticketIdMatch = currentChannelName.match(/([a-f0-9]{8})$/);
      const ticketIdSection = ticketIdMatch ? ticketIdMatch[1] : ticket.id.split('-')[0];
      
      // Update channel name with new department name
      const channelName = `${targetDepartment.name}-${ticketIdSection}`;
      try {
        await currentChannel.setName(channelName);
      } catch (error) {
        logger.warn(`Could not rename channel: ${error.message}`);
      }

      // Update channel category if different
      if (targetDepartment.categoryId && targetDepartment.categoryId !== currentDepartment.categoryId) {
        try {
          await currentChannel.setParent(targetDepartment.categoryId);
        } catch (error) {
          logger.warn(`Could not move channel to new category: ${error.message}`);
        }
      }

      // Update channel permissions - add new roles before removing old ones to maintain access
      // First, add permissions for new department roles
      const newDepartmentRoles = await this.ticketService.getDepartmentRoles(targetDepartmentId);
      for (const roleId of newDepartmentRoles) {
        try {
          await currentChannel.permissionOverwrites.create(roleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
          });
        } catch (error) {
          logger.warn(`Could not add role ${roleId} permissions: ${error.message}`);
        }
      }

      // Small delay to ensure permissions are applied
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then remove permissions for old department roles
      const oldDepartmentRoles = await this.ticketService.getDepartmentRoles(ticket.departmentId);
      for (const roleId of oldDepartmentRoles) {
        try {
          // Only delete if it's not in the new department roles (to handle cases where a role is in both departments)
          if (!newDepartmentRoles.includes(roleId)) {
            await currentChannel.permissionOverwrites.delete(roleId);
          }
        } catch (error) {
          logger.warn(`Could not remove role ${roleId} permissions: ${error.message}`);
        }
      }

      // Update the ticket in database only after all channel operations succeed
      await this.ticketService.transferTicketDepartment(ticket.id, targetDepartmentId);

      // Send notification message
      const transferEmbed = new EmbedBuilder()
        .setTitle('🔄 客服單已轉移')
        .setDescription(`此客服單已從 **${currentDepartment.name}** 部門轉移至 **${targetDepartment.name}** 部門。`)
        .setColor(0x0099FF)
        .addFields(
          {
            name: '轉移者',
            value: interaction.user.tag,
            inline: true
          },
          {
            name: '轉移時間',
            value: moment().tz(config.timezone || 'Asia/Taipei').format('YYYY/MM/DD HH:mm:ss'),
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [transferEmbed]
      });

      // Log the transfer
      logger.info(`Ticket ${ticket.id} transferred from ${ticket.departmentId} to ${targetDepartmentId} by ${interaction.user.tag}`);

    } catch (error) {
      logger.error(`Error transferring ticket: ${error.message}`);
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '轉移客服單時出錯。請稍後再試。',
            ephemeral: true
          });
        } else {
          await interaction.editReply({
            content: '轉移客服單時出錯。請稍後再試。'
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply to interaction: ${replyError.message}`);
      }
    }
  }
}

module.exports = TicketController;