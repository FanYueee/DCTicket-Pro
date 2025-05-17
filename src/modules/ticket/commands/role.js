const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../core/logger');
const Permissions = require('../../../utils/permissions');
const config = require('../../../core/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('設置部門角色權限')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('為部門設置可以查看客服單的角色')
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
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('選擇角色')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('列出部門的角色權限')
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
      const departmentId = interaction.options.getString('department');
      
      // Get department details
      const department = await this.module.service.getDepartment(departmentId);
      if (!department) {
        await interaction.reply({
          content: '無效的部門ID。',
          ephemeral: true
        });
        return;
      }
      
      if (subcommand === 'set') {
        // Add a role to the department
        const role = interaction.options.getRole('role');
        
        // Get current roles
        const currentRoles = await this.module.service.getDepartmentRoles(departmentId);
        
        // Check if role already exists
        if (currentRoles.includes(role.id)) {
          await interaction.reply({
            content: `角色 ${role.name} 已經指派給 ${department.name} 部門。`,
            ephemeral: true
          });
          return;
        }
        
        // Add the new role
        currentRoles.push(role.id);
        await this.module.service.setDepartmentRoles(departmentId, currentRoles);
        
        await interaction.reply({
          content: `已將角色 ${role.name} 指派給 ${department.name} 部門。`,
          ephemeral: true
        });
      } 
      else if (subcommand === 'list') {
        // List roles for the department
        const roles = await this.module.service.getDepartmentRoles(departmentId);
        
        if (roles.length === 0) {
          await interaction.reply({
            content: `${department.name} 部門沒有指派任何角色。`,
            ephemeral: true
          });
          return;
        }
        
        // Fetch role names
        const roleNames = roles.map(roleId => {
          const role = interaction.guild.roles.cache.get(roleId);
          return role ? role.name : `<未知角色: ${roleId}>`;
        });
        
        await interaction.reply({
          content: `${department.name} 部門的角色:\n${roleNames.map(name => `- ${name}`).join('\n')}`,
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error(`Error executing role command: ${error.message}`);
      await interaction.reply({
        content: `設置角色時出錯: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};