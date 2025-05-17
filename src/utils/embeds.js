const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const config = require('../core/config');

/**
 * Utility class for creating Discord embeds and components
 */
class Embeds {
  /**
   * Create the ticket panel embed
   * @param {String} title - The embed title
   * @param {String} description - The embed description
   * @returns {EmbedBuilder} The created embed
   */
  static ticketPanelEmbed(title = '客服單系統', description = '請選擇下方按鈕以創建客服單') {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#5865F2')
      .addFields(
        ...config.departments.map(dept => ({
          name: `${dept.emoji} ${dept.name}`,
          value: dept.description,
          inline: true
        }))
      )
      .setFooter({ text: '點擊下方按鈕創建對應部門的客服單' })
      .setTimestamp();
  }

  /**
   * Create the buttons for ticket panel
   * @returns {ActionRowBuilder} Row with department buttons
   */
  static ticketPanelButtons() {
    const buttons = config.departments.map(dept => {
      // Map department IDs to specific button styles
      let buttonStyle = ButtonStyle.Primary; // Default is blue

      if (dept.id === 'billing') {
        buttonStyle = ButtonStyle.Success; // Green
      } else if (dept.id === 'tech') {
        buttonStyle = ButtonStyle.Danger; // Red
      }

      return new ButtonBuilder()
        .setCustomId(`create_ticket:${dept.id}`)
        .setLabel(dept.name)
        .setEmoji(dept.emoji)
        .setStyle(buttonStyle);
    });

    return new ActionRowBuilder().addComponents(...buttons);
  }

  /**
   * Create the ticket information embed
   * @param {Object} ticket - The ticket information
   * @param {String} userTag - The user's tag
   * @returns {EmbedBuilder} The created embed
   */
  static ticketInfoEmbed(ticket, userTag) {
    const department = config.departments.find(d => d.id === ticket.departmentId);
    if (!department) return null;

    return new EmbedBuilder()
      .setTitle(`🎫 客服單 #${ticket.id}`)
      .setDescription(`感謝您創建客服單，我們的團隊會儘快處理您的請求。`)
      .setColor(department.color)
      .addFields(
        { name: '用戶', value: userTag, inline: true },
        { name: '部門', value: `${department.emoji} ${department.name}`, inline: true },
        { name: '創建時間', value: new Date(ticket.createdAt).toLocaleString(), inline: true },
        { name: '問題描述', value: ticket.description || '無描述' }
      )
      .setFooter({ text: '請在此頻道中描述您的問題，我們會盡快回覆' })
      .setTimestamp();
  }

  /**
   * Create the buttons for ticket controls
   * @returns {ActionRowBuilder} Row with ticket management buttons
   */
  static ticketControlButtons() {
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('關閉客服單')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder().addComponents(closeButton);
  }

  /**
   * Create a confirmation message embed
   * @param {String} title - The title of the confirmation
   * @param {String} description - The description text
   * @returns {EmbedBuilder} The created embed
   */
  static confirmationEmbed(title, description) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#FEE75C')
      .setFooter({ text: '請點擊下方按鈕確認或取消' })
      .setTimestamp();
  }

  /**
   * Create confirmation buttons
   * @param {String} customIdPrefix - Prefix for the button custom IDs
   * @returns {ActionRowBuilder} Row with confirm/cancel buttons
   */
  static confirmationButtons(customIdPrefix = 'confirm') {
    const confirmButton = new ButtonBuilder()
      .setCustomId(`${customIdPrefix}:yes`)
      .setLabel('確認')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`${customIdPrefix}:no`)
      .setLabel('取消')
      .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
  }

  /**
   * Create an error embed
   * @param {String} title - The error title
   * @param {String} description - The error description
   * @returns {EmbedBuilder} The created embed
   */
  static errorEmbed(title = '發生錯誤', description = '處理您的請求時出現問題。') {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#ED4245')
      .setTimestamp();
  }

  /**
   * Create a success embed
   * @param {String} title - The success title
   * @param {String} description - The success description
   * @returns {EmbedBuilder} The created embed
   */
  static successEmbed(title = '操作成功', description = '您的請求已成功處理。') {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#57F287')
      .setTimestamp();
  }
}

module.exports = Embeds;