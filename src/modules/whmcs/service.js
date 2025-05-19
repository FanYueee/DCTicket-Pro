const logger = require('../../core/logger');
const whmcsLogger = require('./whmcs-logger');
const config = require('../../core/config');
const { EmbedBuilder } = require('discord.js');

class WHMCSService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Get a client's service information for Discord display
   * @param {string} discordId - The Discord user ID
   * @returns {Promise<Object>} Object containing services and error information
   */
  async getClientServices(discordId) {
    try {
      // Check if WHMCS integration is enabled
      if (!this.repository.isConfigured()) {
        return { 
          success: false, 
          error: 'WHMCS integration is not configured',
          services: [],
          useEmbed: false
        };
      }

      // Get client ID from Discord ID
      const clientIdResponse = await this.repository.getClientIdByDiscordId(discordId);
      
      if (clientIdResponse.result !== 'success' || !clientIdResponse.clientid) {
        // Return with error embed for no linked account
        const errorEmbed = new EmbedBuilder()
          .setTitle('未綁定 WHMCS 帳號')
          .setDescription('您的 Discord 帳號尚未與 WHMCS 客戶中心帳號綁定。')
          .addFields({
            name: '如何綁定帳號',
            value: '請登入[客戶中心](https://client.vproxy.cloud/clientarea.php)，進入客戶中心首頁右下進行綁定。'
          })
          .setColor('#ED4245')
          .setFooter({ text: '綁定帳號後，客服人員才能識別與確認用戶資訊。' });
        
        return {
          success: false,
          error: 'No WHMCS account found linked to your Discord account',
          services: [],
          useEmbed: true,
          embed: errorEmbed
        };
      }

      // Get client's products/services
      const productsResponse = await this.repository.getClientsProducts(clientIdResponse.clientid);
      
      if (productsResponse.result !== 'success' || !productsResponse.products || productsResponse.products.product.length === 0) {
        return {
          success: false,
          error: 'No services found for your account',
          services: [],
          useEmbed: false
        };
      }

      // Process services
      const services = this.processServices(productsResponse.products.product);

      return {
        success: true,
        clientId: clientIdResponse.clientid,
        services: services,
        useEmbed: false
      };
    } catch (error) {
      whmcsLogger.error(`Error getting client services: ${error.message}`);
      logger.error(`Error getting client services: ${error.message}`);
      return {
        success: false,
        error: `Error retrieving service information: ${error.message}`,
        services: [],
        useEmbed: false
      };
    }
  }

  /**
   * Process raw services data into a more usable format
   * @param {Array} rawServices - Raw services data from WHMCS API
   * @returns {Array} Processed services
   */
  processServices(rawServices) {
    // Ensure rawServices is an array
    const services = Array.isArray(rawServices) ? rawServices : [rawServices];
    
    return services.map(service => {
      // Find server UUID in custom fields (if any)
      let uuid = '';
      if (service.customfields && service.customfields.customfield) {
        const customFields = Array.isArray(service.customfields.customfield) 
          ? service.customfields.customfield 
          : [service.customfields.customfield];
        
        // Look for uuid field
        const uuidField = customFields.find(field => 
          field.name.toLowerCase().includes('uuid') || 
          field.name.toLowerCase().includes('server id'));
        
        if (uuidField) {
          uuid = uuidField.value;
        }
      }

      // Generate panel URL if UUID exists
      const panelUrl = uuid ? this.repository.generatePanelUrl(uuid) : '';

      // Determine if service is active
      const isActive = service.status.toLowerCase() === 'active';

      return {
        id: service.id,
        name: service.name,
        domain: service.domain || '',
        status: service.status,
        isActive: isActive,
        groupName: service.groupname || '',
        billingCycle: service.billingcycle || '',
        nextDueDate: service.nextduedate || '',
        uuid: uuid,
        panelUrl: panelUrl
      };
    });
  }

  /**
   * Create Discord embeds for services
   * @param {Array} services - Processed services
   * @returns {Array} Array of Discord embeds
   */
  createServiceEmbeds(services) {
    const activeServices = services.filter(service => service.isActive);
    const inactiveServices = services.filter(service => !service.isActive);
    
    const embeds = [];

    // Create embeds for active services (green)
    if (activeServices.length > 0) {
      const activeEmbed = new EmbedBuilder()
        .setTitle('啟用中的服務')
        .setColor('#00b259')
        .setDescription('以下是您目前啟用中的服務：');
      
      activeServices.forEach(service => {
        activeEmbed.addFields({
          name: `${service.name} (${service.status})`,
          value: this.formatServiceDetails(service),
          inline: false
        });
      });
      
      embeds.push(activeEmbed);
    }
    
    // Create embeds for inactive services (gray)
    if (inactiveServices.length > 0) {
      const inactiveEmbed = new EmbedBuilder()
        .setTitle('非啟用中的服務')
        .setColor('#808080')
        .setDescription('以下是您目前非啟用中的服務：');
      
      inactiveServices.forEach(service => {
        inactiveEmbed.addFields({
          name: `${service.name} (${service.status})`,
          value: this.formatServiceDetails(service),
          inline: false
        });
      });
      
      embeds.push(inactiveEmbed);
    }
    
    return embeds;
  }

  /**
   * Format service details for embed display
   * @param {Object} service - Processed service object
   * @returns {string} Formatted details
   */
  formatServiceDetails(service) {
    let details = [];
    
    if (service.groupName) details.push(`**類別:** ${service.groupName}`);
    if (service.billingCycle) details.push(`**付款週期:** ${service.billingCycle}`);
    if (service.nextDueDate) details.push(`**到期日:** ${service.nextDueDate}`);
    if (service.domain) details.push(`**連線位置:** ${service.domain}`);
    if (service.panelUrl) details.push(`**控制面板:** [點擊前往](${service.panelUrl})`);
    
    return details.join('\n');
  }
}

module.exports = WHMCSService;