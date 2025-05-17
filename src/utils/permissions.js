const { PermissionsBitField } = require('discord.js');

/**
 * Utility class for handling Discord permissions
 */
class Permissions {
  /**
   * Check if a member has the required permissions for a guild
   * @param {GuildMember} member - The guild member to check permissions for
   * @param {Array<String>} permissions - Array of permission strings to check
   * @returns {Boolean} Whether the member has all the permissions
   */
  static hasGuildPermission(member, permissions) {
    if (!member) return false;
    if (member.id === member.guild.ownerId) return true;

    const permissionBits = permissions.map(perm => PermissionsBitField.Flags[perm]);
    return member.permissions.has(permissionBits, true);
  }

  /**
   * Check if the bot has the required permissions for a channel
   * @param {TextChannel} channel - The channel to check permissions for
   * @param {Array<String>} permissions - Array of permission strings to check
   * @returns {Boolean} Whether the bot has all the permissions
   */
  static botHasChannelPermission(channel, permissions) {
    if (!channel) return false;
    
    const botMember = channel.guild.members.me;
    if (!botMember) return false;
    
    const permissionBits = permissions.map(perm => PermissionsBitField.Flags[perm]);
    return channel.permissionsFor(botMember).has(permissionBits, true);
  }

  /**
   * Get missing permissions for a member in a channel
   * @param {TextChannel} channel - The channel to check permissions for
   * @param {GuildMember} member - The guild member to check
   * @param {Array<String>} requiredPermissions - Required permissions
   * @returns {Array<String>} Array of missing permission names
   */
  static getMissingPermissions(channel, member, requiredPermissions) {
    if (!channel || !member) return requiredPermissions;
    
    const memberPermissions = channel.permissionsFor(member);
    if (!memberPermissions) return requiredPermissions;
    
    return requiredPermissions.filter(permission => {
      const permBit = PermissionsBitField.Flags[permission];
      return !memberPermissions.has(permBit, true);
    });
  }

  /**
   * Required permissions for ticket management
   * @returns {Array<String>} Array of required permission names
   */
  static ticketManagementPermissions() {
    return [
      'ManageChannels',
      'ViewChannel',
      'SendMessages',
      'ManageMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'UseExternalEmojis',
      'ManageRoles'
    ];
  }

  /**
   * Required permissions for the bot to set up tickets
   * @returns {Array<String>} Array of required permission names
   */
  static setupPermissions() {
    return [
      'ManageChannels',
      'ViewChannel',
      'SendMessages',
      'ManageMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'UseExternalEmojis',
      'ManageRoles',
      'CreatePublicThreads',
      'ManageThreads'
    ];
  }
}

module.exports = Permissions;