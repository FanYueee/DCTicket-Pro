const logger = require('../../core/logger');
const config = require('../../core/config');
const cronParser = require('cron-parser');
const nodeCron = require('node-cron');

class ServiceHoursService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Check if it's currently within service hours
   * @param {string} guildId - The guild ID
   * @returns {Promise<boolean>} Whether it's within service hours
   */
  async isWithinServiceHours(guildId) {
    try {
      // If module is disabled in config, always return true
      if (config.serviceHours && config.serviceHours.enabled === false) {
        return true;
      }

      // First check if service hours are enabled for this guild
      const settings = await this.repository.getSettings(guildId);

      // If no settings found or service hours are disabled, always return true
      if (!settings || !settings.enabled) {
        return true;
      }

      // Get all active service hours
      const serviceHours = await this.repository.getActiveHours(guildId);

      // If no service hours defined, it's outside of service hours
      if (!serviceHours || serviceHours.length === 0) {
        return false;
      }

      const now = new Date();

      // Check if current time matches any of the cron expressions
      for (const schedule of serviceHours) {
        try {
          // Validate cron expression
          if (!nodeCron.validate(schedule.cron_expression)) {
            logger.warn(`Invalid cron expression: ${schedule.cron_expression}`);
            continue;
          }

          // Check if the current time matches the cron pattern
          try {
            const interval = cronParser.parseExpression(schedule.cron_expression);
            const prev = interval.prev();
            const next = interval.next();

            // If the next execution time is less than 1 minute away or
            // the previous execution was less than 1 minute ago, we're within service hours
            if (next.getTime() - now.getTime() < 60000 || now.getTime() - prev.getTime() < 60000) {
              return true;
            }
          } catch (parseError) {
            logger.warn(`Error parsing cron expression using parser: ${parseError.message}`);
            continue;
          }
        } catch (cronError) {
          logger.warn(`Error parsing cron expression (${schedule.cron_expression}): ${cronError.message}`);
          continue;
        }
      }

      // If we get here, we're outside of service hours
      return false;
    } catch (error) {
      logger.error(`Error checking service hours: ${error.message}`);
      // Default to true in case of error
      return true;
    }
  }

  /**
   * Get the off-hours message
   * @returns {string} The off-hours message
   */
  getOffHoursMessage() {
    return config.serviceHours?.offHoursMessage ||
      '感謝您的來訊，我們目前非客服營業時間。您可以留下相關訊息，我們將會在下一個工作日盡速回覆您。';
  }

  /**
   * Get the new ticket off-hours message
   * @returns {string} The new ticket off-hours message
   */
  getNewTicketOffHoursMessage() {
    return config.serviceHours?.newTicketOffHoursMessage ||
      '目前非客服處理時間，您可以先善用 AI 客服協助處理您的問題，如果無法解決再請轉為專人客服，我們會在下一個工作日盡速為您服務。';
  }

  /**
   * Initialize service hours from config if needed
   * @param {string} guildId - The guild ID
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initializeFromConfig(guildId) {
    try {
      // Check if we have any hours for this guild
      const hours = await this.repository.getAllHours(guildId);
      
      // If we already have hours, skip initialization
      if (hours && hours.length > 0) {
        return true;
      }
      
      // If no configuration exists, skip
      if (!config.serviceHours || !config.serviceHours.defaultHours || !Array.isArray(config.serviceHours.defaultHours)) {
        return false;
      }
      
      // Add default hours from config
      for (const hour of config.serviceHours.defaultHours) {
        if (hour.cron && hour.description) {
          await this.repository.addHours(guildId, hour.cron, hour.description);
          logger.info(`Added default service hours: ${hour.description}`);
        }
      }
      
      // Set global setting
      await this.repository.toggleGlobalSetting(guildId, config.serviceHours.enabled !== false);
      
      return true;
    } catch (error) {
      logger.error(`Error initializing service hours from config: ${error.message}`);
      return false;
    }
  }
}

module.exports = ServiceHoursService;