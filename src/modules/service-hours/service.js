const logger = require('../../core/logger');
const config = require('../../core/config');
const cronParser = require('cron-parser');
const nodeCron = require('node-cron');
const moment = require('moment-timezone');

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

      // Use global configured timezone
      const timezone = config.timezone || 'UTC';
      
      // Get current time in the configured timezone using moment-timezone
      const momentNow = moment().tz(timezone);
      const now = momentNow.toDate();
      
      // For hardcoded workdays/hours check
      const currentDay = momentNow.day(); // 0 = Sunday, 1 = Monday, etc.
      const currentHour = momentNow.hour();
      
      // Log the time being used for debugging
      logger.debug(`Checking service hours using time: ${momentNow.format('YYYY-MM-DD HH:mm:ss')} (${timezone})`);
      logger.debug(`Current day: ${currentDay}, Current hour: ${currentHour}`);

      // First check using config values directly (more reliable)
      if (config.serviceHours && config.serviceHours.workdays && config.serviceHours.workHoursStart && config.serviceHours.workHoursEnd) {
        const workdays = config.serviceHours.workdays;
        const startHour = config.serviceHours.workHoursStart;
        const endHour = config.serviceHours.workHoursEnd;
        
        logger.debug(`Using config workdays=${workdays.join(',')}, startHour=${startHour}, endHour=${endHour}`);
        
        // Check if today is a workday and we're within working hours
        if (workdays.includes(currentDay) && currentHour >= startHour && currentHour < endHour) {
          logger.debug(`Within service hours using direct config check (${timezone}): day=${currentDay}, hour=${currentHour}`);
          return true;
        }
      }
      
      // Fallback to cron expressions from database
      logger.debug(`Direct config check failed, trying cron expressions (found ${serviceHours.length})`);
      
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
            // Create cron parser with timezone option
            const interval = cronParser.parseExpression(schedule.cron_expression, {
              currentDate: now,
              tz: timezone
            });
            const prev = interval.prev();
            const next = interval.next();
            
            logger.debug(`Cron check: now=${momentNow.format('YYYY-MM-DD HH:mm:ss')}, prev=${moment(prev).format('YYYY-MM-DD HH:mm:ss')}, next=${moment(next).format('YYYY-MM-DD HH:mm:ss')}`);
            logger.debug(`Time differences: next-now=${(next.getTime() - now.getTime())/1000}s, now-prev=${(now.getTime() - prev.getTime())/1000}s`);

            // Check if we're within service hours using time comparison
            // Uses a 1-minute window to check if we're close to a service hour match
            if (next.getTime() - now.getTime() < 60000 || now.getTime() - prev.getTime() < 60000) {
              logger.debug(`Service hour match found for pattern: ${schedule.cron_expression}, is within working hours`);
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
   * Get the off-hours message with timezone information
   * @returns {string} The off-hours message
   */
  getOffHoursMessage() {
    // Ensure we're using the configured timezone
    const timezone = config.timezone || 'Asia/Taipei';
    
    // Create a current time in the configured timezone
    const now = moment.tz(timezone);
    logger.debug(`Current time in ${timezone}: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // Get working days and hours from config
    const workdays = config.serviceHours?.workdays || [1, 2, 3, 4, 5]; // Monday-Friday by default
    const startHour = config.serviceHours?.workHoursStart || 9;
    
    // Find the next working day
    let nextWorkDay = now.clone();
    let daysChecked = 0;
    
    // Add at least one day since we're looking for the next working day
    nextWorkDay.add(1, 'days');
    
    while (daysChecked < 7) { // Check up to 7 days ahead to find the next working day
      if (workdays.includes(nextWorkDay.day())) {
        break; // Found a working day
      }
      // If not a working day, move to the next day
      nextWorkDay.add(1, 'days');
      daysChecked++;
    }
    
    // Set the time to the start hour
    nextWorkDay.hour(startHour).minute(0).second(0);
    
    // Format the next working day
    const nextWorkDayFormatted = nextWorkDay.format('YYYY-MM-DD HH:mm');
    logger.debug(`Next working day in ${timezone}: ${nextWorkDayFormatted}`);
    
    // Get the base message
    const message = config.serviceHours?.offHoursMessage ||
      '感謝您的來訊，我們目前非客服營業時間。您可以留下相關訊息，我們將會在下一個工作日盡速回覆您。';
    
    // Return the message with the next working day information
    return `${message}\n\n下一個工作時間: ${nextWorkDayFormatted} (${timezone})`;
  }

  /**
   * Get the new ticket off-hours message with timezone information
   * @returns {string} The new ticket off-hours message
   */
  getNewTicketOffHoursMessage() {
    // Ensure we're using the configured timezone
    const timezone = config.timezone || 'Asia/Taipei';
    
    // Create a current time in the configured timezone
    const now = moment.tz(timezone);
    logger.debug(`Current time for ticket in ${timezone}: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // Get working days and hours from config
    const workdays = config.serviceHours?.workdays || [1, 2, 3, 4, 5]; // Monday-Friday by default
    const startHour = config.serviceHours?.workHoursStart || 9;
    
    // Find the next working day
    let nextWorkDay = now.clone();
    let daysChecked = 0;
    
    // Add at least one day since we're looking for the next working day
    nextWorkDay.add(1, 'days');
    
    while (daysChecked < 7) { // Check up to 7 days ahead to find the next working day
      if (workdays.includes(nextWorkDay.day())) {
        break; // Found a working day
      }
      // If not a working day, move to the next day
      nextWorkDay.add(1, 'days');
      daysChecked++;
    }
    
    // Set the time to the start hour
    nextWorkDay.hour(startHour).minute(0).second(0);
    
    // Format the next working day
    const nextWorkDayFormatted = nextWorkDay.format('YYYY-MM-DD HH:mm');
    logger.debug(`Next working day for ticket in ${timezone}: ${nextWorkDayFormatted}`);
    
    // Get the base message
    const message = config.serviceHours?.newTicketOffHoursMessage ||
      '目前非客服處理時間，您可以先善用 AI 客服協助處理您的問題，如果無法解決再請轉為專人客服，我們會在下一個工作日盡速為您服務。';
    
    // Return the message with the next working day information
    return `${message}\n\n下一個工作時間: ${nextWorkDayFormatted} (${timezone})`;
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