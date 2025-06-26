const express = require("express");
const { body, validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const db = require("../../database/db");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { authorizeRole } = require("../middleware/auth");
const { logger, auditLog } = require("../utils/logger");

const router = express.Router();

// Configure multer for backup file uploads
const upload = multer({
  dest: path.join(__dirname, "../../temp/"),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(sql|db|sqlite)$/;
    if (allowedTypes.test(file.originalname.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only SQL, DB, and SQLite files are allowed"));
    }
  }
});

/**
 * @route   GET /api/settings
 * @desc    Get all system settings
 * @access  Private (Admin/Manager)
 */
router.get("/",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    try {
      // Get all settings from the database
      const settings = await db.query(`
        SELECT 
          setting_key,
          setting_value,
          data_type,
          category
        FROM system_settings 
        WHERE is_encrypted = 0
        ORDER BY category, setting_key
      `);

      // Convert to nested object structure
      const settingsObject = {};
      
      settings.forEach(setting => {
        const category = setting.category;
        const key = setting.setting_key.replace(`${category}.`, '');
        
        if (!settingsObject[category]) {
          settingsObject[category] = {};
        }
        
        // Convert value based on data type
        let value = setting.setting_value;
        if (setting.data_type === 'boolean') {
          value = value === 'true' || value === '1';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        }
        
        settingsObject[category][key] = value;
      });

      // Provide defaults if no settings exist
      if (Object.keys(settingsObject).length === 0) {
        const defaultSettings = getDefaultSettings();
        await initializeDefaultSettings(defaultSettings);
        return res.json({
          success: true,
          data: defaultSettings
        });
      }

      res.json({
        success: true,
        data: settingsObject
      });

    } catch (error) {
      logger.error("Get settings error:", error);
      throw createError("Failed to fetch settings", 500);
    }
  })
);

/**
 * @route   PUT /api/settings
 * @desc    Update system settings
 * @access  Private (Admin/Manager)
 */
router.put("/",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const settingsData = req.body;

    try {
      await db.run("BEGIN TRANSACTION");

      const auditChanges = {};
      let updatedCount = 0;

      // Process each category of settings
      for (const [category, categorySettings] of Object.entries(settingsData)) {
        for (const [key, value] of Object.entries(categorySettings)) {
          const settingKey = `${category}.${key}`;
          
          // Get current value for audit
          const currentSetting = await db.get(
            "SELECT setting_value FROM system_settings WHERE setting_key = ?",
            [settingKey]
          );

          let stringValue = value;
          let dataType = 'string';
          
          if (typeof value === 'boolean') {
            stringValue = value ? 'true' : 'false';
            dataType = 'boolean';
          } else if (typeof value === 'number') {
            stringValue = value.toString();
            dataType = 'number';
          }

          if (currentSetting) {
            // Update existing setting
            if (currentSetting.setting_value !== stringValue) {
              auditChanges[settingKey] = {
                old: currentSetting.setting_value,
                new: stringValue
              };

              await db.run(`
                UPDATE system_settings 
                SET setting_value = ?, data_type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE setting_key = ?
              `, [stringValue, dataType, req.user.id, settingKey]);
              
              updatedCount++;
            }
          } else {
            // Insert new setting
            await db.run(`
              INSERT INTO system_settings 
              (setting_key, setting_value, data_type, category, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [settingKey, stringValue, dataType, category, req.user.id]);
            
            auditChanges[settingKey] = {
              old: null,
              new: stringValue
            };
            updatedCount++;
          }
        }
      }

      await db.run("COMMIT");

      if (Object.keys(auditChanges).length > 0) {
        auditLog("settings_updated", {
          changes: auditChanges,
          updatedBy: req.user.id,
          ip: req.ip
        });
      }

      res.json({
        success: true,
        message: `${updatedCount} settings updated successfully`
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Update settings error:", error);
      throw createError("Failed to update settings", 500);
    }
  })
);

/**
 * @route   POST /api/settings/backup
 * @desc    Create database backup
 * @access  Private (Admin)
 */
router.post("/backup",
  authorizeRole(["admin"]),
  asyncHandler(async (req, res) => {
    try {
      const backupDir = path.join(__dirname, "../../backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFilename = `inventory-backup-${timestamp}.sqlite`;
      const backupPath = path.join(backupDir, backupFilename);

      // Copy database file
      const dbPath = path.join(__dirname, "../../database/inventory.sqlite");
      fs.copyFileSync(dbPath, backupPath);

      auditLog("database_backup", {
        backupFilename,
        backupPath,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Database backup created successfully",
        data: {
          filename: backupFilename,
          download_url: `/api/settings/backup/download/${backupFilename}`,
          size: fs.statSync(backupPath).size,
          created_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error("Database backup error:", error);
      throw createError("Failed to create database backup", 500);
    }
  })
);

/**
 * @route   POST /api/settings/restore
 * @desc    Restore database from backup
 * @access  Private (Admin)
 */
router.post("/restore",
  authorizeRole(["admin"]),
  upload.single('backup'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No backup file provided"
      });
    }

    try {
      const backupPath = req.file.path;
      const dbPath = path.join(__dirname, "../../database/inventory.sqlite");
      
      // Create a backup of current database before restore
      const currentBackupPath = path.join(__dirname, "../../backups", `pre-restore-backup-${Date.now()}.sqlite`);
      fs.copyFileSync(dbPath, currentBackupPath);

      // Restore from uploaded file
      fs.copyFileSync(backupPath, dbPath);

      // Clean up uploaded file
      fs.unlinkSync(backupPath);

      auditLog("database_restored", {
        backupFilename: req.file.originalname,
        restoredBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Database restored successfully"
      });

    } catch (error) {
      logger.error("Database restore error:", error);
      throw createError("Failed to restore database", 500);
    }
  })
);

/**
 * @route   GET /api/settings/backup/download/:filename
 * @desc    Download backup file
 * @access  Private (Admin)
 */
router.get("/backup/download/:filename",
  authorizeRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const backupPath = path.join(__dirname, "../../backups", filename);

    try {
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({
          success: false,
          message: "Backup file not found"
        });
      }

      const stats = fs.statSync(backupPath);
      
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", stats.size);

      const fileStream = fs.createReadStream(backupPath);
      fileStream.pipe(res);

    } catch (error) {
      logger.error("Download backup error:", error);
      throw createError("Failed to download backup", 500);
    }
  })
);

/**
 * @route   GET /api/settings/system-info
 * @desc    Get system information
 * @access  Private (Admin/Manager)
 */
router.get("/system-info",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    try {
      // Database stats
      const dbStats = await db.query(`
        SELECT 
          'users' as table_name, COUNT(*) as count FROM users
        UNION ALL
        SELECT 'products', COUNT(*) FROM products
        UNION ALL
        SELECT 'sales_transactions', COUNT(*) FROM sales_transactions
        UNION ALL
        SELECT 'employees', COUNT(*) FROM employees
        UNION ALL
        SELECT 'suppliers', COUNT(*) FROM suppliers
        UNION ALL
        SELECT 'categories', COUNT(*) FROM categories
      `);

      // System stats
      const systemStats = {
        node_version: process.version,
        platform: process.platform,
        uptime: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
        database_size: getDatabaseSize()
      };

      res.json({
        success: true,
        data: {
          database_stats: dbStats,
          system_stats: systemStats
        }
      });

    } catch (error) {
      logger.error("Get system info error:", error);
      throw createError("Failed to fetch system information", 500);
    }
  })
);

// Helper functions

function getDefaultSettings() {
  return {
    company: {
      name: 'InventoryPro Business',
      address: '',
      city: '',
      postal_code: '',
      country: 'United Kingdom',
      phone: '',
      email: '',
      website: '',
      vat_number: '',
      registration_number: ''
    },
    business: {
      currency: 'GBP',
      currency_symbol: '£',
      tax_rate: 20.0,
      business_hours_start: '09:00',
      business_hours_end: '17:00',
      timezone: 'Europe/London',
      date_format: 'DD/MM/YYYY',
      fiscal_year_start: '04-01'
    },
    inventory: {
      auto_reorder: false,
      low_stock_threshold: 10,
      default_supplier_id: null,
      enable_barcode_scanning: true,
      track_expiry_dates: true,
      enable_batch_tracking: false
    },
    pos: {
      auto_print_receipts: true,
      allow_discounts: true,
      max_discount_percent: 20,
      require_manager_approval: true,
      enable_tips: false,
      default_payment_method: 'cash'
    },
    notifications: {
      email_alerts: true,
      low_stock_alerts: true,
      order_notifications: true,
      system_maintenance: true,
      backup_reminders: true
    },
    security: {
      session_timeout: 480,
      password_min_length: 8,
      require_strong_passwords: true,
      enable_two_factor: false,
      login_attempts_limit: 5,
      auto_logout_idle: true
    },
    backup: {
      auto_backup_enabled: true,
      backup_frequency: 'daily',
      backup_retention_days: 30,
      backup_location: 'local'
    }
  };
}

async function initializeDefaultSettings(settings) {
  try {
    await db.run("BEGIN TRANSACTION");

    for (const [category, categorySettings] of Object.entries(settings)) {
      for (const [key, value] of Object.entries(categorySettings)) {
        const settingKey = `${category}.${key}`;
        
        let stringValue = value;
        let dataType = 'string';
        
        if (typeof value === 'boolean') {
          stringValue = value ? 'true' : 'false';
          dataType = 'boolean';
        } else if (typeof value === 'number') {
          stringValue = value.toString();
          dataType = 'number';
        }

        await db.run(`
          INSERT OR IGNORE INTO system_settings 
          (setting_key, setting_value, data_type, category, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [settingKey, stringValue, dataType, category]);
      }
    }

    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

function getDatabaseSize() {
  try {
    const dbPath = path.join(__dirname, "../../database/inventory.sqlite");
    if (fs.existsSync(dbPath)) {
      return fs.statSync(dbPath).size;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

module.exports = router;