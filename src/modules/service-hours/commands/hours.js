const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../../core/logger');
const config = require('../../../core/config');
const nodeCron = require('node-cron');
const moment = require('moment-timezone');

// Get the repository and service from the parent module
let repository;
let service;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hours')
    .setDescription('管理客服時間設定')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('查看當前的客服時間設定')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('新增客服時間')
        .addStringOption(option =>
          option
            .setName('cron')
            .setDescription('Cron 表達式 (例如: 0 9-17 * * 1-5 代表週一至週五 9:00-18:00)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('時間描述 (例如: 週一至週五 9:00-18:00)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('del')
        .setDescription('刪除客服時間')
        .addStringOption(option =>
          option
            .setName('ids')
            .setDescription('要刪除的時段 ID (多個 ID 請用逗號分隔, 例如: 1,2,3)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('啟用或停用客服時間限制')
        .addStringOption(option =>
          option
            .setName('target')
            .setDescription('要切換的目標')
            .setRequired(true)
            .addChoices(
              { name: '全部時段', value: 'all' },
              { name: '特定時段', value: 'specific' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('是否啟用')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('要切換的時段 ID (僅當目標為特定時段時使用)')
            .setRequired(false)
        )
    ),
  
  // Set module references
  setModule(serviceHoursModule) {
    repository = serviceHoursModule.repository;
    service = serviceHoursModule.service;
    return this;
  },
    
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'view') {
      await handleViewHours(interaction, repository);
    } else if (subcommand === 'add') {
      await handleAddHours(interaction, repository);
    } else if (subcommand === 'del') {
      await handleDeleteHours(interaction, repository);
    } else if (subcommand === 'toggle') {
      await handleToggleHours(interaction, repository);
    }
  }
};

/**
 * Handle view hours subcommand
 * @param {Interaction} interaction - The command interaction
 * @param {Object} repository - The repository instance
 */
async function handleViewHours(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const guildId = interaction.guild.id;
    
    // Get the settings from the database
    const settings = await repository.getSettings(guildId);
    
    // Get the service hours
    const serviceHours = await repository.getAllHours(guildId);
    
    // Create an embed to display the settings
    const embed = new EmbedBuilder()
      .setTitle('客服時間設定')
      .setColor(settings.enabled ? '#57F287' : '#ED4245')
      .setDescription(`狀態: ${settings.enabled ? '已啟用 ✅' : '已停用 ❌'}\n\n${settings.enabled ? '在工作時間外，AI 將回應用戶並通知用戶下個工作日會有人工回應' : '時間限制已停用，可隨時請求人工客服'}`)
      .setFooter({ text: '使用 /hours add 新增時段，/hours del <ID> 刪除時段' })
      .setTimestamp(moment().tz(config.timezone || 'UTC').toDate());
    
    if (serviceHours.length === 0) {
      embed.addFields({ name: '工作時間', value: '尚未設定工作時間' });
    } else {
      // Build table-like view for hours
      let hoursText = '';
      for (const hour of serviceHours) {
        hoursText += `ID ${hour.id}: ${hour.enabled ? '✅' : '❌'} | \`${hour.cron_expression}\` | ${hour.description}\n`;
      }
      
      // Add the hours to the embed
      embed.addFields(
        { name: 'ID | 狀態 | Cron 表達式 | 描述', value: hoursText }
      );
      
      // Add example explanations
      embed.addFields(
        { name: 'Cron 表達式說明', value: '```\n秒 分 時 日 月 週\n\n* = 全部\n*/2 = 每隔2個單位\n1-5 = 1到5\n1,3,5 = 1,3,5\n```' },
        { name: '常用範例', value: '```\n0 9-17 * * 1-5 = 週一到週五 9點到18點\n0 9-12,13-17 * * 1-5 = 週一到週五 9點到13點，14點到18點\n```' }
      );
    }
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    logger.error(`Error viewing service hours: ${error.message}`);
    await interaction.editReply({
      content: `查看客服時間設定時發生錯誤：${error.message}`
    });
  }
}

/**
 * Handle add hours subcommand
 * @param {Interaction} interaction - The command interaction
 * @param {Object} repository - The repository instance
 */
async function handleAddHours(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const guildId = interaction.guild.id;
    const cronExpression = interaction.options.getString('cron');
    const description = interaction.options.getString('description');
    
    // Validate cron expression
    if (!nodeCron.validate(cronExpression)) {
      await interaction.editReply({
        content: 'Cron 表達式格式不正確。請確保格式為 "秒 分 時 日 月 週"。'
      });
      return;
    }
    
    // Ensure settings exist and are enabled
    await repository.toggleGlobalSetting(guildId, true);
    
    // Insert the new service hours
    const result = await repository.addHours(guildId, cronExpression, description);
    
    await interaction.editReply({
      content: `成功新增工作時間：\n時段 ID：${result.id}\nCron 表達式：\`${cronExpression}\`\n描述：${description}`
    });
  } catch (error) {
    logger.error(`Error adding service hours: ${error.message}`);
    await interaction.editReply({
      content: `新增客服時間時發生錯誤：${error.message}`
    });
  }
}

/**
 * Handle delete hours subcommand
 * @param {Interaction} interaction - The command interaction
 * @param {Object} repository - The repository instance
 */
async function handleDeleteHours(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const guildId = interaction.guild.id;
    const idsString = interaction.options.getString('ids');
    
    // Parse the IDs
    const ids = idsString.split(',')
      .map(id => id.trim())
      .filter(id => /^\d+$/.test(id))
      .map(id => parseInt(id));
    
    if (ids.length === 0) {
      await interaction.editReply({
        content: '沒有有效的 ID。請提供有效的 ID (例如: 1,2,3)。'
      });
      return;
    }
    
    // Get the hours to be deleted for confirmation message
    const hoursToDelete = await repository.getAllHours(guildId);
    const filteredHours = hoursToDelete.filter(hour => ids.includes(hour.id));
    
    if (filteredHours.length === 0) {
      await interaction.editReply({
        content: '找不到要刪除的時段。請使用 /hours view 查看可用的時段 ID。'
      });
      return;
    }
    
    // Delete the hours
    const result = await repository.deleteHours(guildId, ids);
    
    // Build confirmation message
    let deletedInfo = filteredHours.map(hour => 
      `ID ${hour.id}: \`${hour.cron_expression}\` | ${hour.description}`
    ).join('\n');
    
    await interaction.editReply({
      content: `成功刪除 ${result} 個時段：\n${deletedInfo}`
    });
  } catch (error) {
    logger.error(`Error deleting service hours: ${error.message}`);
    await interaction.editReply({
      content: `刪除客服時間時發生錯誤：${error.message}`
    });
  }
}

/**
 * Handle toggle hours subcommand
 * @param {Interaction} interaction - The command interaction
 * @param {Object} repository - The repository instance
 */
async function handleToggleHours(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const guildId = interaction.guild.id;
    const target = interaction.options.getString('target');
    const enabled = interaction.options.getBoolean('enabled');
    
    if (target === 'all') {
      // Toggle the global setting
      await repository.toggleGlobalSetting(guildId, enabled);
      
      await interaction.editReply({
        content: `已${enabled ? '啟用' : '停用'}所有客服時間限制`
      });
    } else {
      // Toggle a specific schedule
      const id = interaction.options.getInteger('id');
      
      if (!id) {
        await interaction.editReply({
          content: '請提供要切換的時段 ID。'
        });
        return;
      }
      
      // Check if the schedule exists
      const allHours = await repository.getAllHours(guildId);
      const schedule = allHours.find(hour => hour.id === id);
      
      if (!schedule) {
        await interaction.editReply({
          content: `找不到 ID 為 ${id} 的時段。請使用 /hours view 查看可用的時段 ID。`
        });
        return;
      }
      
      // Update the schedule
      await repository.toggleHoursById(guildId, id, enabled);
      
      await interaction.editReply({
        content: `已${enabled ? '啟用' : '停用'}時段 ID ${id}（${schedule.description}）`
      });
    }
  } catch (error) {
    logger.error(`Error toggling service hours: ${error.message}`);
    await interaction.editReply({
      content: `切換客服時間設定時發生錯誤：${error.message}`
    });
  }
}