const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');
const Permissions = require('../../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('在目前頻道中設置客服單面板')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  // This will be set by the module loader
  module: null,
  
  setModule(module) {
    this.module = module;
  },
  
  async execute(interaction) {
    try {
      // Check if user has permission
      if (!Permissions.hasGuildPermission(interaction.member, ['Administrator'])) {
        await interaction.reply({
          content: '您沒有使用此命令的權限。',
          ephemeral: true
        });
        return;
      }
      
      // Call the controller to set up the panel
      await this.module.controller.setupPanel(interaction);
      
    } catch (error) {
      logger.error(`Error executing setup command: ${error.message}`);
      await interaction.reply({
        content: `設置面板時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};