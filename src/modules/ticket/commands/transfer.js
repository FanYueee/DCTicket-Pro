const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');
const Permissions = require('../../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('轉移客服單到其他部門')
    .addStringOption(option =>
      option.setName('department')
        .setDescription('目標部門')
        .setRequired(true)
        .addChoices(
          { name: '一般問題', value: 'general' },
          { name: '帳務問題', value: 'billing' },
          { name: '技術問題', value: 'tech' }
        )),
  
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
      
      // Check if user has permission to transfer
      const isAdmin = Permissions.hasGuildPermission(interaction.member, ['Administrator']);
      
      // Get department roles
      const departmentRoles = await this.module.service.getDepartmentRoles(ticket.departmentId);
      const isSupportStaff = interaction.member.roles.cache.some(role => 
        departmentRoles.includes(role.id)
      );
      
      if (!isAdmin && !isSupportStaff) {
        await interaction.reply({
          content: '您沒有轉移這個客服單的權限。只有管理員或該部門的客服人員可以轉移客服單。',
          ephemeral: true
        });
        return;
      }
      
      // Get target department
      const targetDepartmentId = interaction.options.getString('department');
      
      // Check if trying to transfer to the same department
      if (ticket.departmentId === targetDepartmentId) {
        await interaction.reply({
          content: '客服單已經在這個部門了。',
          ephemeral: true
        });
        return;
      }
      
      // Transfer the ticket
      await this.module.controller.transferTicket(interaction, ticket, targetDepartmentId);
      
    } catch (error) {
      logger.error(`Error executing transfer command: ${error.message}`);
      await interaction.reply({
        content: `轉移客服單時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};