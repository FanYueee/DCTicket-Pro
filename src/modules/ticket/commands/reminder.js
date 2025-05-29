const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const reminderService = require('../reminder/service');
const logger = require('../../../core/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('管理客服單無回應提醒設定')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('啟用客服單無回應提醒功能'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('停用客服單無回應提醒功能'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setrole')
        .setDescription('設定接收提醒的身分組')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('要接收提醒的身分組')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('settimeout')
        .setDescription('設定無回應多久後發送提醒')
        .addIntegerOption(option =>
          option
            .setName('minutes')
            .setDescription('分鐘數 (1-60)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(60)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('preference')
        .setDescription('設定個人是否接收提醒')
        .addBooleanOption(option =>
          option
            .setName('receive')
            .setDescription('是否接收提醒')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setstaff')
        .setDescription('管理員設定特定人員是否接收提醒')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('要設定的使用者')
            .setRequired(true))
        .addBooleanOption(option =>
          option
            .setName('receive')
            .setDescription('是否接收提醒')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('查看目前的提醒設定'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('debug')
        .setDescription('調試提醒功能狀態'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setmode')
        .setDescription('設定提醒模式')
        .addStringOption(option =>
          option
            .setName('mode')
            .setDescription('提醒模式')
            .setRequired(true)
            .addChoices(
              { name: '只提醒一次', value: 'once' },
              { name: '持續提醒', value: 'continuous' },
              { name: '限制次數提醒', value: 'limited' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setinterval')
        .setDescription('設定重複提醒的間隔時間')
        .addIntegerOption(option =>
          option
            .setName('seconds')
            .setDescription('間隔秒數 (30-600)')
            .setRequired(true)
            .setMinValue(30)
            .setMaxValue(600)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setmaxcount')
        .setDescription('設定限制模式的最大提醒次數')
        .addIntegerOption(option =>
          option
            .setName('count')
            .setDescription('最大次數 (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'enable':
          await this.handleEnable(interaction);
          break;
        case 'disable':
          await this.handleDisable(interaction);
          break;
        case 'setrole':
          await this.handleSetRole(interaction);
          break;
        case 'settimeout':
          await this.handleSetTimeout(interaction);
          break;
        case 'preference':
          await this.handlePreference(interaction);
          break;
        case 'setstaff':
          await this.handleSetStaff(interaction);
          break;
        case 'status':
          await this.handleStatus(interaction);
          break;
        case 'debug':
          await this.handleDebug(interaction);
          break;
        case 'setmode':
          await this.handleSetMode(interaction);
          break;
        case 'setinterval':
          await this.handleSetInterval(interaction);
          break;
        case 'setmaxcount':
          await this.handleSetMaxCount(interaction);
          break;
      }
    } catch (error) {
      logger.error(`Error executing reminder command: ${error.message}`);
      await interaction.reply({
        content: '❌ 執行指令時發生錯誤。',
        ephemeral: true
      });
    }
  },

  async handleEnable(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以啟用提醒功能。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    if (!settings.reminderRoleId) {
      return await interaction.editReply({
        content: '❌ 請先使用 `/reminder setrole` 設定接收提醒的身分組。'
      });
    }

    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      enabled: true
    });

    await interaction.editReply({
      content: '✅ 已啟用客服單無回應提醒功能。'
    });
  },

  async handleDisable(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以停用提醒功能。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      enabled: false
    });

    await interaction.editReply({
      content: '✅ 已停用客服單無回應提醒功能。'
    });
  },

  async handleSetRole(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定提醒身分組。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('role');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      reminderRoleId: role.id
    });

    await interaction.editReply({
      content: `✅ 已設定提醒身分組為 ${role}。`
    });
  },

  async handleSetTimeout(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定提醒時間。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const minutes = interaction.options.getInteger('minutes');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      reminderTimeout: minutes * 60 // Convert to seconds
    });

    await interaction.editReply({
      content: `✅ 已設定無回應 ${minutes} 分鐘後發送提醒。`
    });
  },

  async handlePreference(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const receive = interaction.options.getBoolean('receive');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    if (!settings.reminderRoleId) {
      return await interaction.editReply({
        content: '❌ 尚未設定提醒身分組。請管理員先使用 `/reminder setrole` 設定。'
      });
    }

    // Update preference
    await reminderService.updateStaffPreference(interaction.user.id, receive);

    // Manage role based on preference
    try {
      const role = await interaction.guild.roles.fetch(settings.reminderRoleId);
      const member = interaction.member;
      
      if (receive) {
        // User wants reminders - add role if they don't have it
        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role);
          await interaction.editReply({
            content: '✅ 已開啟接收客服單提醒通知，並為您加上提醒身分組。'
          });
        } else {
          await interaction.editReply({
            content: '✅ 已開啟接收客服單提醒通知。'
          });
        }
      } else {
        // User doesn't want reminders - remove role if they have it
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          await interaction.editReply({
            content: '✅ 已關閉接收客服單提醒通知，並移除您的提醒身分組。\n' +
                    '💡 如果您想收到提醒但保持設定為關閉，可以在 Discord 中手動加回身分組。'
          });
        } else {
          await interaction.editReply({
            content: '✅ 已關閉接收客服單提醒通知。'
          });
        }
      }
    } catch (error) {
      logger.error(`Error managing reminder role: ${error.message}`);
      await interaction.editReply({
        content: receive 
          ? '✅ 已開啟接收客服單提醒通知（但無法自動管理身分組）。' 
          : '✅ 已關閉接收客服單提醒通知（但無法自動管理身分組）。'
      });
    }
  },

  async handleSetStaff(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定其他人員的提醒偏好。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const receive = interaction.options.getBoolean('receive');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    if (!settings.reminderRoleId) {
      return await interaction.editReply({
        content: '❌ 尚未設定提醒身分組。請先使用 `/reminder setrole` 設定。'
      });
    }
    
    // Update preference
    await reminderService.updateStaffPreference(user.id, receive);

    // Try to manage role
    try {
      const role = await interaction.guild.roles.fetch(settings.reminderRoleId);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      
      if (member) {
        if (receive) {
          // Add role if they don't have it
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            await interaction.editReply({
              content: `✅ 已為 ${user} 開啟接收客服單提醒通知，並加上提醒身分組。`
            });
          } else {
            await interaction.editReply({
              content: `✅ 已為 ${user} 開啟接收客服單提醒通知。`
            });
          }
        } else {
          // Remove role if they have it
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            await interaction.editReply({
              content: `✅ 已為 ${user} 關閉接收客服單提醒通知，並移除提醒身分組。`
            });
          } else {
            await interaction.editReply({
              content: `✅ 已為 ${user} 關閉接收客服單提醒通知。`
            });
          }
        }
      } else {
        await interaction.editReply({
          content: receive 
            ? `✅ 已為 ${user} 開啟接收客服單提醒通知（使用者不在伺服器中，無法管理身分組）。` 
            : `✅ 已為 ${user} 關閉接收客服單提醒通知（使用者不在伺服器中，無法管理身分組）。`
        });
      }
    } catch (error) {
      logger.error(`Error managing reminder role for user: ${error.message}`);
      await interaction.editReply({
        content: receive 
          ? `✅ 已為 ${user} 開啟接收客服單提醒通知（但無法自動管理身分組）。` 
          : `✅ 已為 ${user} 關閉接收客服單提醒通知（但無法自動管理身分組）。`
      });
    }
  },

  async handleStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    const userPreference = await reminderService.getStaffPreference(interaction.user.id);

    const modeNames = {
      'once': '只提醒一次',
      'continuous': '持續提醒',
      'limited': '限制次數提醒'
    };

    const embed = {
      title: '📋 客服單提醒設定狀態',
      color: 0x3498db,
      fields: [
        {
          name: '功能狀態',
          value: settings.enabled ? '✅ 已啟用' : '❌ 已停用',
          inline: true
        },
        {
          name: '首次提醒時間',
          value: `${settings.reminderTimeout / 60} 分鐘`,
          inline: true
        },
        {
          name: '提醒身分組',
          value: settings.reminderRoleId ? `<@&${settings.reminderRoleId}>` : '未設定',
          inline: true
        },
        {
          name: '提醒模式',
          value: modeNames[settings.reminderMode] || '只提醒一次',
          inline: true
        },
        {
          name: '重複間隔',
          value: settings.reminderMode !== 'once' ? `${settings.reminderInterval} 秒` : 'N/A',
          inline: true
        },
        {
          name: '最大次數',
          value: settings.reminderMode === 'limited' ? `${settings.reminderMaxCount} 次` : 'N/A',
          inline: true
        },
        {
          name: '您的接收設定',
          value: userPreference ? '✅ 接收提醒' : '❌ 不接收提醒',
          inline: false
        }
      ],
      footer: {
        text: '使用 /reminder 子指令來修改設定'
      },
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
  },

  async handleDebug(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以使用調試功能。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const settings = await reminderService.getReminderSettings(interaction.guild.id);
      
      // Get current open tickets with human handling
      const { service: ticketService } = this.module || {};
      let openTickets = [];
      let trackingInfo = [];
      
      if (ticketService) {
        // This would need a method to get open tickets, for now we'll show what we can
        // You might need to add this method to ticket service
      }

      const embed = {
        title: '🔧 提醒功能調試資訊',
        color: 0xFFB347,
        fields: [
          {
            name: '⚙️ 基本設定',
            value: `功能狀態: ${settings.enabled ? '✅ 啟用' : '❌ 停用'}\n` +
                   `提醒時間: ${settings.reminderTimeout / 60} 分鐘\n` +
                   `提醒身分組: ${settings.reminderRoleId ? `<@&${settings.reminderRoleId}>` : '❌ 未設定'}`,
            inline: false
          },
          {
            name: '🕐 檢查間隔',
            value: '每 60 秒檢查一次',
            inline: true
          },
          {
            name: '📊 伺服器狀態',
            value: `總伺服器數: ${interaction.client.guilds.cache.size}`,
            inline: true
          }
        ],
        footer: {
          text: '查看機器人日誌以獲得更詳細的調試資訊'
        },
        timestamp: new Date()
      };

      // Add role check if role is set
      if (settings.reminderRoleId) {
        try {
          const role = await interaction.guild.roles.fetch(settings.reminderRoleId);
          if (role) {
            embed.fields.push({
              name: '👥 提醒角色資訊',
              value: `角色名稱: ${role.name}\n成員數量: ${role.members.size}`,
              inline: false
            });
          }
        } catch (error) {
          embed.fields.push({
            name: '❌ 提醒角色錯誤',
            value: '無法獲取提醒角色資訊，角色可能已被刪除',
            inline: false
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Debug command error: ${error.message}`);
      await interaction.editReply({
        content: '❌ 執行調試時發生錯誤。'
      });
    }
  },

  async handleSetMode(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定提醒模式。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const mode = interaction.options.getString('mode');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      reminderMode: mode
    });

    const modeNames = {
      'once': '只提醒一次',
      'continuous': '持續提醒',
      'limited': '限制次數提醒'
    };

    await interaction.editReply({
      content: `✅ 已設定提醒模式為：**${modeNames[mode]}**`
    });
  },

  async handleSetInterval(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定提醒間隔。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const seconds = interaction.options.getInteger('seconds');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      reminderInterval: seconds
    });

    await interaction.editReply({
      content: `✅ 已設定重複提醒間隔為 ${seconds} 秒。`
    });
  },

  async handleSetMaxCount(interaction) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ 只有管理員可以設定最大提醒次數。',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const count = interaction.options.getInteger('count');
    const settings = await reminderService.getReminderSettings(interaction.guild.id);
    
    await reminderService.updateReminderSettings(interaction.guild.id, {
      ...settings,
      reminderMaxCount: count
    });

    await interaction.editReply({
      content: `✅ 已設定限制模式的最大提醒次數為 ${count} 次。`
    });
  },

  setModule(module) {
    this.module = module;
  }
};