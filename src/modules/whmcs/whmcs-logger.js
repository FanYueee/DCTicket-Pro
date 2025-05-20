const winston = require('winston');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const config = require('../../core/config');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create WHMCS logs directory if it doesn't exist
const whmcsLogsDir = path.join(logsDir, 'whmcs');
if (!fs.existsSync(whmcsLogsDir)) {
  fs.mkdirSync(whmcsLogsDir);
}

// Create the logger
const whmcsLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => {
        // Use the configured timezone for timestamps
        return moment().tz(config.timezone || 'UTC').format('YYYY-MM-DD HH:mm:ss');
      }
    }),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(whmcsLogsDir, 'whmcs.log')
    })
  ]
});

module.exports = whmcsLogger;