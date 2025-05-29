const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../../core/logger');
const config = require('../../../core/config');
const Permissions = require('../../../utils/permissions');
const cronParser = require('cron-parser');
const moment = require('moment-timezone');

// Holiday management command
const command = {
  data: new SlashCommandBuilder()
    .setName('holiday')
    .setDescription('管理休假時間設定')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('新增休假時間'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('查看所有休假時間'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('刪除休假時間')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('休假記錄 ID')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('啟用/停用休假時間')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('休假記錄 ID')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('啟用或停用')
            .setRequired(true))),

  async execute(interaction, { repository, service }) {
    try {
      // Check if service hours module is loaded
      if (!service) {
        await interaction.reply({
          content: '❌ 服務時間模組未載入',
          ephemeral: true
        });
        return;
      }

      // Check permissions
      if (!Permissions.hasGuildPermission(interaction.member, ['Administrator'])) {
        await interaction.reply({
          content: '❌ 您沒有權限使用此指令',
          ephemeral: true
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add':
          await handleAddHoliday(interaction, repository);
          break;
        case 'list':
          await handleListHolidays(interaction, repository);
          break;
        case 'delete':
          await handleDeleteHoliday(interaction, repository);
          break;
        case 'toggle':
          await handleToggleHoliday(interaction, repository);
          break;
      }
    } catch (error) {
      logger.error(`Error executing holiday command: ${error.message}`);
      
      const errorMessage = {
        content: '❌ 執行指令時發生錯誤',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};

async function handleAddHoliday(interaction, repository) {
  // Create modal for holiday input
  const modal = new ModalBuilder()
    .setCustomId('holiday-add-modal')
    .setTitle('新增休假時間');

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('休假名稱')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例如：春節連假')
    .setRequired(true)
    .setMaxLength(100);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('休假原因')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('例如：春節假期，客服人員放假')
    .setRequired(true)
    .setMaxLength(500);

  const typeInput = new TextInputBuilder()
    .setCustomId('type')
    .setLabel('休假類型 (O/R)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('O = 一次性, R = 重複性')
    .setRequired(true)
    .setValue('O')
    .setMaxLength(1);

  const scheduleInput = new TextInputBuilder()
    .setCustomId('schedule')
    .setLabel('時間設定')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('一次性: YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm\n重複性: cron 格式 (例如: * 13-14 * * 6 表示每週六 13-14 點)')
    .setRequired(true);

  // Add inputs to modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(reasonInput),
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(scheduleInput)
  );

  await interaction.showModal(modal);

  // Wait for modal submission
  try {
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 300000, // 5 minutes
      filter: i => i.customId === 'holiday-add-modal' && i.user.id === interaction.user.id
    });

    await modalSubmit.deferReply({ ephemeral: true });

    const name = modalSubmit.fields.getTextInputValue('name');
    const reason = modalSubmit.fields.getTextInputValue('reason');
    const typeInput = modalSubmit.fields.getTextInputValue('type').toUpperCase();
    const schedule = modalSubmit.fields.getTextInputValue('schedule');
    
    // Convert O/R to once/recurring
    let type;
    if (typeInput === 'O') {
      type = 'once';
    } else if (typeInput === 'R') {
      type = 'recurring';
    } else {
      await modalSubmit.editReply({
        content: '❌ 休假類型必須是 O (一次性) 或 R (重複性)'
      });
      return;
    }

    const timezone = config.timezone || 'Asia/Taipei';
    let holidayData = {
      guildId: interaction.guild.id,
      name,
      reason,
      createdBy: interaction.user.id
    };

    // Parse schedule based on type
    if (type === 'once') {
      // Parse date range
      const dateMatch = schedule.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
      if (!dateMatch) {
        await modalSubmit.editReply({
          content: '❌ 日期格式錯誤！請使用 YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm 格式'
        });
        return;
      }

      const startDate = moment.tz(dateMatch[1], 'YYYY-MM-DD HH:mm', timezone).toDate();
      const endDate = moment.tz(dateMatch[2], 'YYYY-MM-DD HH:mm', timezone).toDate();

      if (endDate <= startDate) {
        await modalSubmit.editReply({
          content: '❌ 結束時間必須晚於開始時間'
        });
        return;
      }

      holidayData.startDate = startDate;
      holidayData.endDate = endDate;
      holidayData.isRecurring = false;
    } else if (type === 'recurring') {
      // Validate cron expression
      try {
        cronParser.parseExpression(schedule, { tz: timezone });
        holidayData.cronExpression = schedule;
        holidayData.isRecurring = true;
      } catch (error) {
        await modalSubmit.editReply({
          content: `❌ Cron 表達式格式錯誤：${error.message}`
        });
        return;
      }
    }

    // Add holiday to database
    const holiday = await repository.addHoliday(holidayData);

    // Create preview embed
    const embed = new EmbedBuilder()
      .setTitle('✅ 休假時間已新增')
      .setColor('#00FF00')
      .addFields([
        { name: '名稱', value: name, inline: true },
        { name: '類型', value: type === 'once' ? '一次性' : '重複性', inline: true },
        { name: 'ID', value: holiday.id.toString(), inline: true },
        { name: '原因', value: reason }
      ])
      .setTimestamp();

    if (type === 'once') {
      embed.addFields({
        name: '休假時間',
        value: `${moment(holidayData.startDate).tz(timezone).format('YYYY-MM-DD HH:mm')} ~ ${moment(holidayData.endDate).tz(timezone).format('YYYY-MM-DD HH:mm')}`
      });
    } else {
      // Show next occurrences
      try {
        const interval = cronParser.parseExpression(schedule, {
          currentDate: new Date(),
          tz: timezone
        });
        
        let nextTimes = [];
        for (let i = 0; i < 3; i++) {
          const next = interval.next();
          nextTimes.push(moment(next).tz(timezone).format('YYYY-MM-DD HH:mm'));
        }
        
        embed.addFields(
          { name: 'Cron 表達式', value: `\`${schedule}\`` },
          { name: '接下來的休假時間', value: nextTimes.join('\n') }
        );
      } catch (error) {
        embed.addFields({ name: 'Cron 表達式', value: `\`${schedule}\`` });
      }
    }

    await modalSubmit.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Modal submission error: ${error.message}`);
  }
}

async function handleListHolidays(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });

  const holidays = await repository.getAllHolidays(interaction.guild.id);
  
  if (holidays.length === 0) {
    await interaction.editReply({
      content: '📅 目前沒有設定任何休假時間'
    });
    return;
  }

  const timezone = config.timezone || 'Asia/Taipei';
  const embed = new EmbedBuilder()
    .setTitle('📅 休假時間列表')
    .setColor('#0099ff')
    .setTimestamp();

  for (const holiday of holidays.slice(0, 25)) { // Discord embed field limit
    const status = holiday.enabled ? '✅ 啟用' : '❌ 停用';
    let timeInfo = '';

    if (holiday.is_recurring) {
      timeInfo = `Cron: \`${holiday.cron_expression}\``;
      
      // Show next occurrence
      try {
        const interval = cronParser.parseExpression(holiday.cron_expression, {
          currentDate: new Date(),
          tz: timezone
        });
        const next = interval.next();
        timeInfo += `\n下次: ${moment(next).tz(timezone).format('MM/DD HH:mm')}`;
      } catch (error) {
        // Ignore parse errors
      }
    } else {
      const start = moment(holiday.start_date).tz(timezone).format('MM/DD HH:mm');
      const end = moment(holiday.end_date).tz(timezone).format('MM/DD HH:mm');
      timeInfo = `${start} ~ ${end}`;
    }

    embed.addFields({
      name: `ID: ${holiday.id} | ${holiday.name} | ${status}`,
      value: `${holiday.reason}\n${timeInfo}`,
      inline: false
    });
  }

  if (holidays.length > 25) {
    embed.setFooter({ text: `只顯示前 25 筆，共 ${holidays.length} 筆休假記錄` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDeleteHoliday(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.options.getInteger('id');
  const success = await repository.deleteHoliday(id, interaction.guild.id);

  if (success) {
    await interaction.editReply({
      content: `✅ 已刪除休假記錄 ID: ${id}`
    });
  } else {
    await interaction.editReply({
      content: `❌ 找不到休假記錄 ID: ${id}`
    });
  }
}

async function handleToggleHoliday(interaction, repository) {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.options.getInteger('id');
  const enabled = interaction.options.getBoolean('enabled');
  
  const success = await repository.toggleHoliday(id, interaction.guild.id, enabled);

  if (success) {
    await interaction.editReply({
      content: `✅ 已${enabled ? '啟用' : '停用'}休假記錄 ID: ${id}`
    });
  } else {
    await interaction.editReply({
      content: `❌ 找不到休假記錄 ID: ${id}`
    });
  }
}

module.exports = command;