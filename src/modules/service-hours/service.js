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
   * Check if it's currently a holiday
   * @param {string} guildId - The guild ID
   * @returns {Promise<Object|null>} Holiday object if on holiday, null otherwise
   */
  async checkHoliday(guildId) {
    try {
      const timezone = config.timezone || 'Asia/Taipei';
      const now = moment.tz(timezone);
      
      // Get holiday settings
      const holidaySettings = await this.repository.getHolidaySettings(guildId);
      if (!holidaySettings.enabled) {
        return null;
      }

      // Get active holidays
      const holidays = await this.repository.getActiveHolidays(guildId);
      
      for (const holiday of holidays) {
        // Check one-time holidays (date range)
        if (!holiday.is_recurring && holiday.start_date && holiday.end_date) {
          const startDate = moment(holiday.start_date).tz(timezone);
          const endDate = moment(holiday.end_date).tz(timezone);
          
          if (now.isBetween(startDate, endDate, null, '[]')) {
            logger.debug(`Currently in holiday period: ${holiday.name}`);
            return holiday;
          }
        }
        
        // Check recurring holidays (cron expression)
        if (holiday.is_recurring && holiday.cron_expression) {
          try {
            const cronParts = holiday.cron_expression.split(' ');
            
            // Special handling for hour range expressions
            if (cronParts.length >= 3 && cronParts[0] === '*' && cronParts[1] !== '*') {
              const hourPart = cronParts[1];
              const currentHour = now.hour();
              
              if (hourPart.includes('-')) {
                const [startHour, endHour] = hourPart.split('-').map(h => parseInt(h));
                if (currentHour >= startHour && currentHour <= endHour) {
                  logger.debug(`In recurring holiday hours: ${holiday.name}`);
                  return holiday;
                }
              } else {
                const targetHour = parseInt(hourPart);
                if (currentHour === targetHour) {
                  logger.debug(`In recurring holiday hour: ${holiday.name}`);
                  return holiday;
                }
              }
            } else {
              // Use cron parser for complex expressions
              const interval = cronParser.parseExpression(holiday.cron_expression, {
                currentDate: now.toDate(),
                tz: timezone
              });
              
              const prev = interval.prev();
              const next = interval.next();
              
              // Check if we're within a holiday period (within 1 minute of cron match)
              if (next.getTime() - now.toDate().getTime() < 60000 || now.toDate().getTime() - prev.getTime() < 60000) {
                logger.debug(`Matched recurring holiday cron: ${holiday.name}`);
                return holiday;
              }
            }
          } catch (error) {
            logger.error(`Error parsing holiday cron expression: ${error.message}`);
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error checking holidays: ${error.message}`);
      return null;
    }
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

      // Check if it's currently a holiday
      const holiday = await this.checkHoliday(guildId);
      if (holiday) {
        logger.debug(`Currently on holiday: ${holiday.name}`);
        return false;
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

      // First check cron expressions from database (higher priority)
      logger.debug(`Checking cron expressions (found ${serviceHours.length})`);
      
      let foundMatchingCron = false;
      
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
            // Parse the cron expression
            const cronParts = schedule.cron_expression.split(' ');
            
            // Check if this is a range-based expression (e.g., "10:05 * 8-9 * * *")
            if (cronParts.length >= 3 && cronParts[2].includes('-')) {
              // Extract hour range from the expression
              const hourRange = cronParts[2];
              const [startHour, endHour] = hourRange.split('-').map(h => parseInt(h));
              
              logger.debug(`Detected hour range: ${startHour}-${endHour}, current hour: ${currentHour}`);
              
              // Check if current hour is within the range
              if (currentHour >= startHour && currentHour <= endHour) {
                logger.debug(`Within service hours based on hour range: ${hourRange}`);
                foundMatchingCron = true;
                return true;
              }
            } else {
              // For non-range expressions, use the original logic
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
                foundMatchingCron = true;
                return true;
              }
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

      // If we have cron expressions but none matched, we're outside service hours
      if (serviceHours.length > 0 && !foundMatchingCron) {
        logger.debug(`No matching cron expressions found, outside service hours`);
        return false;
      }

      // If no cron expressions defined, fallback to config
      if (serviceHours.length === 0 && config.serviceHours && config.serviceHours.workdays && config.serviceHours.workHoursStart && config.serviceHours.workHoursEnd) {
        const workdays = config.serviceHours.workdays;
        const startHour = config.serviceHours.workHoursStart;
        const endHour = config.serviceHours.workHoursEnd;
        
        logger.debug(`No cron expressions, using config: workdays=${workdays.join(',')}, startHour=${startHour}, endHour=${endHour}`);
        
        // Check if today is a workday and we're within working hours
        if (workdays.includes(currentDay) && currentHour >= startHour && currentHour < endHour) {
          logger.debug(`Within service hours using config check (${timezone}): day=${currentDay}, hour=${currentHour}`);
          return true;
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
   * Get the next service time based on cronjobs and config
   * @param {string} guildId - The guild ID
   * @returns {Promise<Date>} The next service time
   */
  async getNextServiceTime(guildId) {
    const timezone = config.timezone || 'Asia/Taipei';
    const now = moment.tz(timezone);
    let nextServiceTime = null;
    
    try {
      // First check cronjobs from database - only ENABLED ones
      const hours = await this.repository.getActiveHours(guildId);
      
      if (hours && hours.length > 0) {
        logger.debug(`Checking ${hours.length} active cron expressions for next service time`);
        logger.debug(`Active hours: ${hours.map(h => `ID:${h.id} - ${h.cron_expression}`).join(', ')}`);
        
        // Find the nearest next service time from all cronjobs
        for (const hour of hours) {
          try {
            logger.debug(`Processing cron expression: ${hour.cron_expression} (ID: ${hour.id})`);
            const cronParts = hour.cron_expression.split(' ');
            
            // Special handling for hour range expressions (e.g., "* 8-9 * * *" or "* 11 * * *")
            if (cronParts.length >= 3 && cronParts[0] === '*' && cronParts[1] !== '*') {
              const hourPart = cronParts[1];
              
              if (hourPart.includes('-')) {
                // Handle range like "8-9"
                const [startHour, endHour] = hourPart.split('-').map(h => parseInt(h));
                
                // Check each hour in the range
                for (let h = startHour; h <= endHour; h++) {
                  const testTime = now.clone().hour(h).minute(0).second(0);
                  if (testTime.isAfter(now)) {
                    if (!nextServiceTime || testTime.toDate() < nextServiceTime) {
                      nextServiceTime = testTime.toDate();
                      logger.debug(`Found next service time from range ${hourPart}: ${testTime.format('YYYY-MM-DD HH:mm')}`);
                    }
                  }
                }
                
                // If no time today works, try tomorrow
                if (!nextServiceTime || nextServiceTime > now.clone().endOf('day').toDate()) {
                  const tomorrow = now.clone().add(1, 'day').hour(startHour).minute(0).second(0);
                  if (!nextServiceTime || tomorrow.toDate() < nextServiceTime) {
                    nextServiceTime = tomorrow.toDate();
                    logger.debug(`Found next service time from range ${hourPart} (tomorrow): ${tomorrow.format('YYYY-MM-DD HH:mm')}`);
                  }
                }
              } else {
                // Handle single hour like "11"
                const targetHour = parseInt(hourPart);
                const testTime = now.clone().hour(targetHour).minute(0).second(0);
                
                if (testTime.isAfter(now)) {
                  // Today at target hour
                  if (!nextServiceTime || testTime.toDate() < nextServiceTime) {
                    nextServiceTime = testTime.toDate();
                    logger.debug(`Found next service time at hour ${targetHour}: ${testTime.format('YYYY-MM-DD HH:mm')}`);
                  }
                } else {
                  // Tomorrow at target hour
                  const tomorrow = now.clone().add(1, 'day').hour(targetHour).minute(0).second(0);
                  if (!nextServiceTime || tomorrow.toDate() < nextServiceTime) {
                    nextServiceTime = tomorrow.toDate();
                    logger.debug(`Found next service time at hour ${targetHour} (tomorrow): ${tomorrow.format('YYYY-MM-DD HH:mm')}`);
                  }
                }
              }
            } else {
              // For other cron expressions, use the parser
              const interval = cronParser.parseExpression(hour.cron_expression, {
                currentDate: now.toDate(),
                tz: timezone
              });
              const next = interval.next().toDate();
              
              if (!nextServiceTime || next < nextServiceTime) {
                nextServiceTime = next;
                logger.debug(`Found next service time from cron ${hour.cron_expression}: ${moment(next).format('YYYY-MM-DD HH:mm')}`);
              }
            }
          } catch (error) {
            logger.error(`Error parsing cron expression ${hour.cron_expression}: ${error.message}`);
          }
        }
      }
      
      logger.debug(`Final next service time: ${nextServiceTime ? moment(nextServiceTime).tz(timezone).format('YYYY-MM-DD HH:mm') : 'none found from cron'}`);
      
      // If no cronjobs or all failed, fallback to config
      if (!nextServiceTime) {
        const workdays = config.serviceHours?.workdays || [1, 2, 3, 4, 5];
        const startHour = config.serviceHours?.workHoursStart || 9;
        const endHour = config.serviceHours?.workHoursEnd || 18;
        
        let checkDate = now.clone();
        
        // Check if today is a workday and we haven't passed the end time
        if (workdays.includes(checkDate.day()) && checkDate.hour() < endHour) {
          // If before start time, next service time is today at start time
          if (checkDate.hour() < startHour) {
            checkDate.hour(startHour).minute(0).second(0);
            nextServiceTime = checkDate.toDate();
          }
          // If within service hours, we shouldn't be here (we're already in service hours)
          // But just in case, set to tomorrow's start time
          else {
            checkDate.add(1, 'days');
            while (!workdays.includes(checkDate.day())) {
              checkDate.add(1, 'days');
            }
            checkDate.hour(startHour).minute(0).second(0);
            nextServiceTime = checkDate.toDate();
          }
        } else {
          // Not a workday or past end time, find next workday
          if (workdays.includes(checkDate.day()) && checkDate.hour() >= endHour) {
            // Past today's service hours, move to next day
            checkDate.add(1, 'days');
          }
          
          // Find next workday
          let daysChecked = 0;
          while (daysChecked < 7 && !workdays.includes(checkDate.day())) {
            checkDate.add(1, 'days');
            daysChecked++;
          }
          
          checkDate.hour(startHour).minute(0).second(0);
          nextServiceTime = checkDate.toDate();
        }
      }
      
      return nextServiceTime;
    } catch (error) {
      logger.error(`Error getting next service time: ${error.message}`);
      // Fallback to tomorrow 9 AM
      return now.clone().add(1, 'days').hour(9).minute(0).second(0).toDate();
    }
  }

  /**
   * Get the off-hours message with timezone information
   * @returns {string} The off-hours message
   */
  async getOffHoursMessage(guildId) {
    // Ensure we're using the configured timezone
    const timezone = config.timezone || 'Asia/Taipei';
    
    // Create a current time in the configured timezone
    const now = moment.tz(timezone);
    logger.debug(`Current time in ${timezone}: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // Check if it's a holiday
    const holiday = await this.checkHoliday(guildId);
    if (holiday) {
      return this.getHolidayMessage(guildId, holiday);
    }
    
    // Get the next service time
    const nextServiceTime = await this.getNextServiceTime(guildId);
    
    // Format the next service time
    const nextServiceTimeFormatted = moment(nextServiceTime).tz(timezone).format('YYYY-MM-DD HH:mm');
    logger.debug(`Next service time in ${timezone}: ${nextServiceTimeFormatted}`);
    
    // Get the base message
    const message = config.serviceHours?.offHoursMessage ||
      '感謝您的來訊，我們目前非客服營業時間。您可以留下相關訊息，我們將會在下一個工作日盡速回覆您。';
    
    // Return the message with the next working day information
    return `${message}\n\n下一個工作時間: ${nextServiceTimeFormatted} (${timezone})`;
  }

  /**
   * Get the new ticket off-hours message with timezone information
   * @returns {string} The new ticket off-hours message
   */
  async getNewTicketOffHoursMessage(guildId) {
    // Ensure we're using the configured timezone
    const timezone = config.timezone || 'Asia/Taipei';
    
    // Create a current time in the configured timezone
    const now = moment.tz(timezone);
    logger.debug(`Current time for ticket in ${timezone}: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // Check if it's a holiday
    const holiday = await this.checkHoliday(guildId);
    if (holiday) {
      return this.getHolidayMessage(guildId, holiday);
    }
    
    // Get the next service time
    const nextServiceTime = await this.getNextServiceTime(guildId);
    
    // Format the next service time
    const nextServiceTimeFormatted = moment(nextServiceTime).tz(timezone).format('YYYY-MM-DD HH:mm');
    logger.debug(`Next service time for ticket in ${timezone}: ${nextServiceTimeFormatted}`);
    
    // Get the base message
    const message = config.serviceHours?.newTicketOffHoursMessage ||
      '目前非客服處理時間，您可以先善用 AI 客服協助處理您的問題，如果無法解決再請轉為專人客服，我們會在下一個工作日盡速為您服務。';
    
    // Return the message with the next working day information
    return `${message}\n\n下一個工作時間: ${nextServiceTimeFormatted} (${timezone})`;
  }

  /**
   * Get holiday message
   * @param {string} guildId - The guild ID
   * @param {Object} holiday - The holiday object
   * @returns {Promise<string>} The holiday message
   */
  async getHolidayMessage(guildId, holiday) {
    const timezone = config.timezone || 'Asia/Taipei';
    const now = moment.tz(timezone);
    
    let message = `🏖️ **休假通知**\n\n`;
    message += `目前為休假時間：**${holiday.name}**\n`;
    
    if (holiday.reason) {
      message += `休假原因：${holiday.reason}\n`;
    }
    
    // Calculate when the holiday ends
    let resumeTime = null;
    
    if (!holiday.is_recurring && holiday.end_date) {
      // For one-time holidays, use the end date
      resumeTime = moment(holiday.end_date).tz(timezone);
      message += `\n預計恢復服務時間：${resumeTime.format('YYYY-MM-DD HH:mm')} (${timezone})`;
    } else {
      // For recurring holidays, find the next service time
      const nextServiceTime = await this.getNextServiceTimeIgnoringCurrentHoliday(guildId, holiday);
      if (nextServiceTime) {
        resumeTime = moment(nextServiceTime).tz(timezone);
        message += `\n下一個工作時間：${resumeTime.format('YYYY-MM-DD HH:mm')} (${timezone})`;
      }
    }
    
    message += '\n\n您可以留下訊息，我們將在恢復服務後盡速回覆您。';
    
    return message;
  }

  /**
   * Get next service time ignoring the current holiday
   * @param {string} guildId - The guild ID
   * @param {Object} currentHoliday - The current holiday to ignore
   * @returns {Promise<Date>} The next service time
   */
  async getNextServiceTimeIgnoringCurrentHoliday(guildId, currentHoliday) {
    // This is a simplified version - you may want to implement more complex logic
    // For now, just call the regular getNextServiceTime
    return this.getNextServiceTime(guildId);
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