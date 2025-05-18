const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');
const Permissions = require('../../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('關閉當前的客服單'),
  
  // This will be set by the module loader
  module: null,
  
  setModule(module) {
    this.module = module;
  },
  
  async execute(interaction) {
    try {
      // Check if this is a ticket channel
      const ticket = await this.module.service.getTicketByChannelId(interaction.channel.id);
      
      if (!ticket) {
        await interaction.reply({
          content: '這不是一個客服單頻道。',
          ephemeral: true
        });
        return;
      }
      
      // Check if user has permission to close
      const isAdmin = Permissions.hasGuildPermission(interaction.member, ['Administrator']);
      const isTicketCreator = interaction.user.id === ticket.userId;
      
      // Get department roles first (since it's an async function)
      const departmentRoles = await this.module.service.getDepartmentRoles(ticket.departmentId);
      const isSupportStaff = interaction.member.roles.cache.some(role => 
        departmentRoles.includes(role.id)
      );
      
      if (!isAdmin && !isTicketCreator && !isSupportStaff) {
        await interaction.reply({
          content: '您沒有關閉這個客服單的權限。',
          ephemeral: true
        });
        return;
      }
      
      // Redirect to close ticket controller
      await this.module.controller.closeTicket(interaction);
      
    } catch (error) {
      logger.error(`Error executing close command: ${error.message}`);
      await interaction.reply({
        content: `關閉客服單時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};