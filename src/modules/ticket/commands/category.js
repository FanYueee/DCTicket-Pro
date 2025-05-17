const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../../core/logger');
const config = require('../../../core/config');
const Permissions = require('../../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('category')
    .setDescription('設置或刷新部門客服單分類頻道')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('為部門設置分類頻道')
        .addStringOption(option =>
          option
            .setName('department')
            .setDescription('選擇部門')
            .setRequired(true)
            .addChoices(
              ...config.departments.map(dept => ({
                name: dept.name,
                value: dept.id
              }))
            )
        )
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('選擇分類頻道')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('refresh')
        .setDescription('刷新所有部門的分類頻道（如果頻道被刪除會重新創建）')
    ),
  
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
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'set') {
        await this.handleSetCategory(interaction);
      } else if (subcommand === 'refresh') {
        await this.handleRefreshCategories(interaction);
      }
    } catch (error) {
      logger.error(`Error executing category command: ${error.message}`);
      await interaction.reply({
        content: `設置分類頻道時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  },
  
  async handleSetCategory(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const departmentId = interaction.options.getString('department');
      const category = interaction.options.getChannel('category');
      
      // Get department details
      const department = await this.module.service.getDepartment(departmentId);
      if (!department) {
        await interaction.editReply({
          content: '無效的部門ID。'
        });
        return;
      }
      
      // Check if the channel is a category
      if (category.type !== ChannelType.GuildCategory) {
        await interaction.editReply({
          content: '選擇的頻道不是一個分類頻道。'
        });
        return;
      }
      
      // Update the department category ID
      await this.module.service.updateDepartmentCategory(departmentId, category.id);
      
      await interaction.editReply({
        content: `已成功將 ${department.name} 部門的分類頻道設置為 ${category.name}。`
      });
    } catch (error) {
      logger.error(`Error setting category: ${error.message}`);
      await interaction.editReply({
        content: `設置分類頻道時出錯: ${error.message}`
      });
    }
  },
  
  async handleRefreshCategories(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const guild = interaction.guild;
      let report = [];
      
      for (const dept of config.departments) {
        // Get the current department with category ID
        const department = await this.module.service.getDepartment(dept.id);
        if (!department) {
          report.push(`- ${dept.name}: 部門不存在於資料庫中`);
          continue;
        }
        
        const categoryId = department.categoryId;
        
        // Skip if no category is set yet
        if (!categoryId) {
          report.push(`- ${department.name}: 未設置分類頻道`);
          continue;
        }
        
        // Try to fetch the category channel
        try {
          const categoryChannel = await guild.channels.fetch(categoryId);
          report.push(`- ${department.name}: 分類頻道 "${categoryChannel.name}" 已存在 (ID: ${categoryId})`);
        } catch (error) {
          // Category doesn't exist or was deleted, create a new one
          try {
            const permissionOverwrites = [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: guild.members.me.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }
            ];
            
            // Add staff roles permissions
            const staffRoles = await this.module.service.getDepartmentRoles(department.id);
            for (const roleId of staffRoles) {
              permissionOverwrites.push({
                id: roleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              });
            }
            
            // Create a new category channel
            const newCategory = await guild.channels.create({
              name: `${department.name} 客服單`,
              type: ChannelType.GuildCategory,
              permissionOverwrites: permissionOverwrites
            });
            
            // Update category ID in database
            await this.module.service.updateDepartmentCategory(department.id, newCategory.id);
            
            report.push(`- ${department.name}: 創建了新的分類頻道 "${newCategory.name}" (ID: ${newCategory.id})`);
          } catch (createError) {
            report.push(`- ${department.name}: 創建分類頻道時出錯: ${createError.message}`);
          }
        }
      }
      
      await interaction.editReply({
        content: `分類頻道刷新報告:\n\n${report.join('\n')}`
      });
    } catch (error) {
      logger.error(`Error refreshing categories: ${error.message}`);
      await interaction.editReply({
        content: `刷新分類頻道時出錯: ${error.message}`
      });
    }
  }
};