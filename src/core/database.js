const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    // Create data directory if it doesn't exist
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.dbPath, (err) => {
        if (err) {
          logger.error(`Database connection error: ${err.message}`);
          reject(err);
          return;
        }
        
        logger.info('Connected to the SQLite database.');
        this.createTables()
          .then(() => resolve())
          .catch(error => reject(error));
      });
    });
  }

  async createTables() {
    const queries = [
      // Departments Table
      `CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        emoji TEXT,
        color TEXT,
        category_id TEXT
      )`,

      // Settings Table
      `CREATE TABLE IF NOT EXISTS settings (
        guild_id TEXT NOT NULL,
        panel_channel_id TEXT,
        panel_message_id TEXT,
        service_hours_enabled BOOLEAN DEFAULT 1,
        PRIMARY KEY (guild_id)
      )`,

      // Service Hours Table
      `CREATE TABLE IF NOT EXISTS service_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES settings (guild_id)
      )`,

      // Tickets Table
      `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        status TEXT NOT NULL,
        ai_handled BOOLEAN DEFAULT 0,
        human_handled BOOLEAN DEFAULT 0,
        staff_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )`,

      // Department Roles Table
      `CREATE TABLE IF NOT EXISTS department_roles (
        department_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (department_id, role_id),
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )`,

      // Messages Table
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        is_ai BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets (id)
      )`,

      // AI Prompts Table
      `CREATE TABLE IF NOT EXISTS ai_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id TEXT,
        prompt_text TEXT NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )`,

      // AI Conversations Table for maintaining context
      `CREATE TABLE IF NOT EXISTS ai_conversations (
        ticket_id TEXT PRIMARY KEY,
        context TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets (id)
      )`,

      // Holidays Table for vacation/holiday management
      `CREATE TABLE IF NOT EXISTS holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        reason TEXT,
        cron_expression TEXT,
        start_date DATETIME,
        end_date DATETIME,
        is_recurring BOOLEAN DEFAULT 0,
        enabled BOOLEAN DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Holiday Settings Table
      `CREATE TABLE IF NOT EXISTS holiday_settings (
        guild_id TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Ticket Reminder Settings Table
      `CREATE TABLE IF NOT EXISTS ticket_reminder_settings (
        guild_id TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT 0,
        reminder_timeout INTEGER DEFAULT 600,
        reminder_role_id TEXT,
        reminder_mode TEXT DEFAULT 'once',
        reminder_interval INTEGER DEFAULT 60,
        reminder_max_count INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Staff Reminder Preferences Table
      `CREATE TABLE IF NOT EXISTS staff_reminder_preferences (
        user_id TEXT PRIMARY KEY,
        receive_reminders BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Ticket Response Tracking Table
      `CREATE TABLE IF NOT EXISTS ticket_response_tracking (
        ticket_id TEXT PRIMARY KEY,
        last_customer_message_at DATETIME,
        last_staff_response_at DATETIME,
        reminder_sent BOOLEAN DEFAULT 0,
        reminder_sent_at DATETIME,
        reminder_count INTEGER DEFAULT 0,
        last_reminder_at DATETIME,
        FOREIGN KEY (ticket_id) REFERENCES tickets (id)
      )`
    ];

    for (const query of queries) {
      await this.run(query);
    }

    // Insert default departments if they don't exist yet
    for (const dept of config.departments) {
      await this.run(
        `INSERT OR IGNORE INTO departments (id, name, description, emoji, color, category_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dept.id, dept.name, dept.description, dept.emoji, dept.color, dept.categoryId]
      );
    }

    // Insert default AI prompts if they don't exist yet
    if (config.ai && config.ai.enabled) {
      // First insert default prompt
      await this.run(
        `INSERT OR IGNORE INTO ai_prompts (department_id, prompt_text, is_default)
         SELECT NULL, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_prompts WHERE is_default = 1)`,
        [config.ai.defaultPrompt]
      );

      // Then insert department-specific prompts
      if (config.ai.departmentPrompts) {
        for (const [deptId, prompt] of Object.entries(config.ai.departmentPrompts)) {
          await this.run(
            `INSERT OR IGNORE INTO ai_prompts (department_id, prompt_text, is_default)
             SELECT ?, ?, 0 WHERE NOT EXISTS (SELECT 1 FROM ai_prompts WHERE department_id = ?)`,
            [deptId, prompt, deptId]
          );
        }
      }
    }

    // Insert default service hours if they don't exist yet
    if (config.serviceHours && config.serviceHours.enabled) {
      // Get all guild IDs from settings
      const guilds = await this.all('SELECT guild_id FROM settings');

      for (const guild of guilds) {
        const guildId = guild.guild_id;

        // Check if service hours already exist for this guild
        const existingHours = await this.all(
          'SELECT * FROM service_hours WHERE guild_id = ?',
          [guildId]
        );

        // If no hours exist, create default ones
        if (existingHours.length === 0) {
          // Default work schedule (Monday to Friday, 9AM-6PM)
          const defaultSchedules = [
            {
              cron: '0 9-17 * * 1-5', // Monday to Friday, 9AM-6PM
              description: '週一至週五 9:00-18:00'
            }
          ];

          for (const schedule of defaultSchedules) {
            await this.run(
              'INSERT INTO service_hours (guild_id, cron_expression, description, enabled) VALUES (?, ?, ?, 1)',
              [guildId, schedule.cron, schedule.description]
            );
          }
        }
      }
    }

    logger.info('Database tables created/verified successfully.');
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error(`Database query error: ${err.message}`);
          logger.error(`Query: ${sql}`);
          logger.error(`Params: ${JSON.stringify(params)}`);
          reject(err);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error(`Database query error: ${err.message}`);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error(`Database query error: ${err.message}`);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) {
          logger.error(`Error closing database: ${err.message}`);
          reject(err);
          return;
        }
        logger.info('Database connection closed.');
        resolve();
      });
    });
  }
}

module.exports = new Database();