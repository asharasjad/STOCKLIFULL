const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, "inventory.sqlite");
    this.schemaPath = path.join(__dirname, "simple-schema.sql");
    this.db = null;
    this.isInitialized = false;
    this.initializeDatabase();
  }

  initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error("Could not open database:", err);
          reject(err);
        } else {
          console.log("Connected to SQLite database.");
          this.setupDatabase()
            .then(() => {
              this.isInitialized = true;
              resolve();
            })
            .catch(reject);
        }
      });
    });
  }

  splitSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let i = 0;

    while (i < sql.length) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === ';') {
          // End of statement
          current = current.trim();
          if (current && !current.startsWith('--')) {
            statements.push(current);
          }
          current = '';
          i++;
          continue;
        }
      } else {
        if (char === stringChar && sql[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        }
      }

      current += char;
      i++;
    }

    // Add any remaining statement
    current = current.trim();
    if (current && !current.startsWith('--')) {
      statements.push(current);
    }

    return statements;
  }

  async setupDatabase() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Enable foreign keys
        this.db.run("PRAGMA foreign_keys = ON");
        
        // Create essential tables only for now
        console.log("Creating database tables...");
        
        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')) DEFAULT 'staff',
            status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Categories table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Products table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            description TEXT,
            category_id INTEGER NOT NULL,
            selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            min_stock_level INTEGER NOT NULL DEFAULT 0,
            reorder_point INTEGER NOT NULL DEFAULT 5,
            status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'discontinued')) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
          )
        `);

        // Payment methods table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('cash', 'card', 'digital', 'voucher', 'other')),
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Sales transactions table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS sales_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_number TEXT UNIQUE NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
            tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            payment_method_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')) DEFAULT 'pending',
            served_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
            FOREIGN KEY (served_by) REFERENCES users(id)
          )
        `);

        // System settings table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
            category TEXT NOT NULL,
            description TEXT,
            updated_by INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (updated_by) REFERENCES users(id)
          )
        `);

        // Alerts table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK (type IN ('low_stock', 'expiry_warning', 'system', 'security', 'order', 'staff')),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
            target_user_id INTEGER,
            target_role TEXT CHECK (target_role IN ('admin', 'manager', 'staff')),
            is_read BOOLEAN DEFAULT FALSE,
            is_dismissed BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (target_user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error("Database setup error:", err);
            reject(err);
          } else {
            console.log("Database schema initialized successfully.");
            this.seedInitialData()
              .then(resolve)
              .catch(reject);
          }
        });
      });
    });
  }

  async seedInitialData() {
    return new Promise((resolve, reject) => {
      // Check if we need to seed initial data
      this.db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row.count === 0) {
          console.log("Seeding initial data...");
          this.insertInitialData()
            .then(() => {
              console.log("Initial data seeded successfully.");
              resolve();
            })
            .catch(reject);
        } else {
          console.log("Database already contains data, skipping seed.");
          resolve();
        }
      });
    });
  }

  async insertInitialData() {
    return new Promise((resolve, reject) => {
      const bcrypt = require("bcrypt");
      const saltRounds = 10;

      // Create default admin user
      bcrypt.hash("admin123", saltRounds, (err, hash) => {
        if (err) {
          reject(err);
          return;
        }

        const initialData = [
          // Insert default admin user
          `INSERT INTO users (username, email, password_hash, first_name, last_name, role) 
           VALUES ('admin', 'admin@inventorypro.com', '${hash}', 'System', 'Administrator', 'admin')`,

          // Insert default payment methods
          `INSERT INTO payment_methods (name, type) VALUES 
           ('Cash', 'cash'),
           ('Card', 'card'),
           ('Contactless', 'card'),
           ('Gift Voucher', 'voucher')`,

          // Insert default categories
          `INSERT INTO categories (name, description) VALUES 
           ('Starters', 'Appetizers and starter dishes'),
           ('Mains', 'Main course dishes'),
           ('Chicken', 'Chicken-based dishes'),
           ('Pizzas', 'Pizza varieties'),
           ('Pastas', 'Pasta dishes'),
           ('Drinks', 'Beverages and drinks'),
           ('Desserts', 'Sweet dishes and desserts')`,

          // Insert system settings
          `INSERT INTO system_settings (setting_key, setting_value, data_type, category, description, updated_by) VALUES 
           ('company_name', 'InventoryPro', 'string', 'general', 'Company name', 1),
           ('currency', 'GBP', 'string', 'general', 'Default currency', 1),
           ('tax_rate', '20.00', 'number', 'financial', 'Default VAT rate', 1),
           ('timezone', 'Europe/London', 'string', 'general', 'System timezone', 1),
           ('time_format', '24', 'string', 'general', '12 or 24 hour format', 1),
           ('low_stock_threshold', '5', 'number', 'inventory', 'Global low stock alert threshold', 1),
           ('session_timeout', '3600', 'number', 'security', 'Session timeout in seconds', 1)`
        ];

        let completed = 0;
        let hasError = false;

        initialData.forEach((statement, index) => {
          this.db.run(statement, (err) => {
            if (err && !hasError) {
              console.error(`Error inserting initial data ${index + 1}:`, err);
              hasError = true;
              reject(err);
              return;
            }

            completed++;
            if (completed === initialData.length && !hasError) {
              resolve();
            }
          });
        });
      });
    });
  }

  // Utility methods for database operations
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async transaction(queries) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");
        
        let completed = 0;
        let hasError = false;
        const results = [];

        queries.forEach((query, index) => {
          this.db.run(query.sql, query.params || [], function(err) {
            if (err && !hasError) {
              hasError = true;
              this.db.run("ROLLBACK");
              reject(err);
              return;
            }

            results[index] = { lastID: this.lastID, changes: this.changes };
            completed++;

            if (completed === queries.length && !hasError) {
              this.db.run("COMMIT", (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(results);
                }
              });
            }
          });
        });
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log("Database connection closed.");
          resolve();
        }
      });
    });
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;
