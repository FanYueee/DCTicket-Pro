const axios = require('axios');
const logger = require('../../core/logger');
const whmcsLogger = require('./whmcs-logger');
const config = require('../../core/config');
const crypto = require('crypto');

class WHMCSRepository {
  constructor() {
    // Initialize with configuration
    this.apiUrl = config.whmcs?.apiUrl || '';
    this.apiIdentifier = config.whmcs?.apiIdentifier || '';
    this.apiSecret = config.whmcs?.apiSecret || '';
    this.panelUrl = config.whmcs?.panelUrl || '';
    
    // Log configuration status
    whmcsLogger.debug(`WHMCS Repository Configuration:
      API URL: ${this.apiUrl ? 'Set' : 'Not set'}
      API Identifier: ${this.apiIdentifier ? 'Set' : 'Not set'}
      API Secret: ${this.apiSecret ? 'Set' : 'Not set'}
      Panel URL: ${this.panelUrl ? 'Set' : 'Not set'}
    `);
  }

  async initialize() {
    // Check if WHMCS integration is enabled
    if (!this.isConfigured()) {
      whmcsLogger.warn('WHMCS integration is not fully configured. Some features will be disabled.');
      logger.warn('WHMCS integration is not fully configured. Some features will be disabled.');
      return false;
    }

    whmcsLogger.info('WHMCS repository initialized');
      logger.info('WHMCS repository initialized');
    return true;
  }

  /**
   * Check if the WHMCS integration is properly configured
   * @returns {boolean} Whether the integration is configured
   */
  isConfigured() {
    return Boolean(this.apiUrl && this.apiIdentifier && this.apiSecret);
  }

  /**
   * Make a request to the WHMCS API
   * @param {string} action - The API action to perform
   * @param {Object} params - Additional parameters for the API call
   * @returns {Promise<Object>} The API response
   */
  async makeApiRequest(action, params = {}) {
    try {
      if (!this.isConfigured()) {
        throw new Error('WHMCS API is not fully configured');
      }

      // Prepare request parameters
      const requestParams = new URLSearchParams();
      requestParams.append('identifier', this.apiIdentifier);
      requestParams.append('secret', this.apiSecret);
      requestParams.append('action', action);
      requestParams.append('responsetype', 'json');

      // Add additional parameters
      for (const [key, value] of Object.entries(params)) {
        requestParams.append(key, value);
      }

      // Make the API request
      const response = await axios.post(this.apiUrl, requestParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Check for API errors
      if (response.data.result === 'error') {
        throw new Error(`WHMCS API Error: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      whmcsLogger.error(`WHMCS API request failed: ${error.message}`);
      logger.error(`WHMCS API request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get client ID by Discord ID using custom API endpoint
   * @param {string} discordId - The Discord user ID
   * @returns {Promise<Object>} The client ID response
   */
  async getClientIdByDiscordId(discordId) {
    try {
      // First check if we're configured
      if (!this.isConfigured()) {
        whmcsLogger.error('Cannot get client ID: WHMCS API is not fully configured');
        return { result: 'error', message: 'WHMCS API is not fully configured' };
      }
    
      // Make a "fake" response for testing if needed
      if (config.whmcs?.mockApi) {
        whmcsLogger.info(`Using mock API response for GetClientID with discordId: ${discordId}`);
        return { result: 'success', clientid: '12345' };
      }
      
      // This uses a custom API endpoint (GetClientID) that you mentioned is available
      whmcsLogger.debug(`Getting client ID for Discord ID: ${discordId}`);
      
      // Actual API call
      return await this.makeApiRequest('GetClientID', {
        discordid: discordId
      });
    } catch (error) {
      whmcsLogger.error(`Error getting client ID by Discord ID: ${error.message}`);
      logger.error(`Error getting client ID by Discord ID: ${error.message}`);
      
      // Return error object instead of throwing
      return { 
        result: 'error', 
        message: `API Error: ${error.message}` 
      };
    }
  }

  /**
   * Get client's products/services
   * @param {string} clientId - The WHMCS client ID
   * @returns {Promise<Object>} The client's products
   */
  async getClientsProducts(clientId) {
    try {
      // First check if we're configured
      if (!this.isConfigured()) {
        whmcsLogger.error('Cannot get client products: WHMCS API is not fully configured');
        return { result: 'error', message: 'WHMCS API is not fully configured' };
      }
      
      // Make a "fake" response for testing if needed
      if (config.whmcs?.mockApi) {
        whmcsLogger.info(`Using mock API response for GetClientsProducts with clientId: ${clientId}`);
        // Return a mock product list
        return { 
          result: 'success', 
          products: {
            product: [
              {
                id: '12345',
                name: 'Mock VPS Server',
                domain: 'mockserver.example.com',
                status: 'Active',
                groupname: 'Virtual Servers',
                billingcycle: 'Monthly',
                nextduedate: '2025-06-19',
                customfields: {
                  customfield: [
                    { 
                      name: 'Server UUID', 
                      value: 'abc12345-1234-1234-1234-123456789abc'
                    }
                  ]
                }
              }
            ]
          }
        };
      }
      
      whmcsLogger.debug(`Getting products for client ID: ${clientId}`);
      
      // Actual API call
      return await this.makeApiRequest('GetClientsProducts', {
        clientid: clientId,
        stats: true
      });
    } catch (error) {
      whmcsLogger.error(`Error getting client products: ${error.message}`);
      logger.error(`Error getting client products: ${error.message}`);
      
      // Return error object instead of throwing
      return { 
        result: 'error', 
        message: `API Error: ${error.message}` 
      };
    }
  }

  /**
   * Generate panel URL from UUID
   * @param {string} uuid - The server UUID
   * @returns {string} The panel URL
   */
  generatePanelUrl(uuid) {
    if (!uuid) return '';
    
    try {
      // Split UUID and use first section
      const uuidFirstSection = uuid.split('-')[0];
      return `${this.panelUrl}/server/${uuidFirstSection}`;
    } catch (error) {
      whmcsLogger.error(`Error generating panel URL: ${error.message}`);
      logger.error(`Error generating panel URL: ${error.message}`);
      return '';
    }
  }
}

module.exports = WHMCSRepository;