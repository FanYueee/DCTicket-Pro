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
        PRIMARY KEY (guild_id)
      )`,
      
      // Tickets Table
      `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
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