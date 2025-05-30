const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('邀請用戶加入當前客服單')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('要邀請的用戶')
        .setRequired(true)),
  
  module: null,
  
  setModule(module) {
    this.module = module;
  },
  
  async execute(interaction) {
    try {
      // 檢查是否在票單頻道
      const ticket = await this.module.service.getTicketByChannelId(interaction.channel.id);
      
      if (!ticket) {
        await interaction.reply({
          content: '❌ 這不是一個客服單頻道。',
          ephemeral: true
        });
        return;
      }
      
      // 檢查權限（票單創建者或部門角色成員）
      const isTicketCreator = interaction.user.id === ticket.userId;
      const departmentRoles = await this.module.service.getDepartmentRoles(ticket.departmentId);
      const isStaff = interaction.member.roles.cache.some(role => 
        departmentRoles.includes(role.id)
      );
      
      if (!isTicketCreator && !isStaff) {
        await interaction.reply({
          content: '❌ 您沒有邀請用戶到這個客服單的權限。',
          ephemeral: true
        });
        return;
      }
      
      const invitee = interaction.options.getUser('user');
      
      // 檢查是否邀請自己
      if (invitee.id === interaction.user.id) {
        await interaction.reply({
          content: '❌ 您不能邀請自己。',
          ephemeral: true
        });
        return;
      }
      
      // 檢查是否邀請 bot
      if (invitee.bot) {
        await interaction.reply({
          content: '❌ 您不能邀請機器人。',
          ephemeral: true
        });
        return;
      }
      
      // 調用 controller 處理邀請
      await this.module.controller.inviteUserToTicket(interaction, ticket, invitee);
      
    } catch (error) {
      logger.error(`Error executing invite command: ${error.message}`);
      await interaction.reply({
        content: `❌ 邀請用戶時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};