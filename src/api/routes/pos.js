const express = require("express");
const { body, validationResult } = require("express-validator");

const db = require("../../database/db");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { logger, auditLog } = require("../utils/logger");

const router = express.Router();

/**
 * @route   GET /api/pos/menu
 * @desc    Get menu items for POS
 * @access  Private
 */
router.get("/menu",
  asyncHandler(async (req, res) => {
    try {
      const categories = await db.query(`
        SELECT 
          c.id,
          c.name,
          c.description,
          COUNT(p.id) as item_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id 
          AND p.status = 'active' 
          AND p.stock_quantity > 0
        WHERE c.status = 'active'
        GROUP BY c.id
        HAVING item_count > 0
        ORDER BY c.name
      `);

      const menuItems = await db.query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.selling_price,
          p.stock_quantity,
          p.image_url,
          c.id as category_id,
          c.name as category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active' 
          AND p.stock_quantity > 0
          AND c.status = 'active'
        ORDER BY c.name, p.name
      `);

      // Group items by category
      const menuByCategory = categories.map(category => ({
        ...category,
        items: menuItems.filter(item => item.category_id === category.id)
      }));

      res.json({
        success: true,
        data: { menu: menuByCategory }
      });

    } catch (error) {
      logger.error("Get menu error:", error);
      throw createError("Failed to fetch menu", 500);
    }
  })
);

/**
 * @route   POST /api/pos/transaction
 * @desc    Create new sales transaction
 * @access  Private
 */
router.post("/transaction",
  [
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.product_id").optional().isInt({ min: 1 }).withMessage("Product ID must be valid"),
    body("items.*.recipe_id").optional().isInt({ min: 1 }).withMessage("Recipe ID must be valid"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be positive"),
    body("items.*.unit_price").isFloat({ min: 0 }).withMessage("Unit price must be non-negative"),
    body("payment_method_id").isInt({ min: 1 }).withMessage("Payment method is required"),
    body("amount_paid").isFloat({ min: 0 }).withMessage("Amount paid must be non-negative")
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const {
      items,
      customer_name = null,
      customer_email = null,
      customer_phone = null,
      payment_method_id,
      amount_paid,
      discount_amount = 0,
      notes = ""
    } = req.body;

    try {
      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.quantity * item.unit_price;
      }

      const tax_rate = 20.00; // 20% VAT
      const tax_amount = ((subtotal - discount_amount) * tax_rate) / 100;
      const total_amount = subtotal + tax_amount - discount_amount;
      const change_given = Math.max(0, amount_paid - total_amount);

      // Generate transaction number
      const timestamp = Date.now();
      const transaction_number = `TXN-${timestamp}`;

      // Insert sales transaction
      const result = await db.run(`
        INSERT INTO sales_transactions (
          transaction_number, subtotal, tax_rate, tax_amount, discount_amount, 
          total_amount, payment_method_id, served_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `, [
        transaction_number, subtotal, tax_rate, tax_amount, discount_amount,
        total_amount, payment_method_id, req.user.id
      ]);

      const transactionId = result.lastID;

      // Insert transaction items and update stock
      for (const item of items) {
        await db.run(`
          INSERT INTO transaction_items (
            transaction_id, product_id, recipe_id, item_name, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          transactionId,
          item.product_id || null,
          item.recipe_id || null,
          item.name,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price
        ]);
      }

      // Get complete transaction details
      const transaction = await db.get(`
        SELECT * FROM sales_transactions WHERE id = ?
      `, [transactionId]);

      const transactionItems = await db.query(`
        SELECT * FROM transaction_items WHERE transaction_id = ?
      `, [transactionId]);

      auditLog("transaction_created", {
        transactionId,
        transactionNumber: transaction_number,
        totalAmount: total_amount,
        itemCount: items.length,
        servedBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Transaction completed successfully",
        data: {
          transaction: {
            ...transaction,
            items: transactionItems
          }
        }
      });

    } catch (error) {
      logger.error("Create transaction error:", error);
      throw createError("Failed to create transaction", 500);
    }
  })
);

/**
 * @route   GET /api/pos/payment-methods
 * @desc    Get available payment methods
 * @access  Private
 */
router.get("/payment-methods",
  asyncHandler(async (req, res) => {
    try {
      const paymentMethods = await db.query(`
        SELECT * FROM payment_methods 
        WHERE is_active = 1 
        ORDER BY name
      `);

      res.json({
        success: true,
        data: { payment_methods: paymentMethods }
      });

    } catch (error) {
      logger.error("Get payment methods error:", error);
      throw createError("Failed to fetch payment methods", 500);
    }
  })
);

/**
 * @route   GET /api/pos/sales-summary
 * @desc    Get daily sales summary
 * @access  Private
 */
router.get("/sales-summary",
  asyncHandler(async (req, res) => {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    try {
      const summary = await db.get(`
        SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(tax_amount), 0) as total_tax,
          COALESCE(AVG(total_amount), 0) as average_sale
        FROM sales_transactions 
        WHERE DATE(created_at) = ? 
          AND status = 'completed'
      `, [date]);

      const paymentBreakdown = await db.query(`
        SELECT 
          pm.name,
          COUNT(*) as count,
          COALESCE(SUM(st.total_amount), 0) as total
        FROM sales_transactions st
        JOIN payment_methods pm ON st.payment_method_id = pm.id
        WHERE DATE(st.created_at) = ? 
          AND st.status = 'completed'
        GROUP BY pm.id, pm.name
        ORDER BY total DESC
      `, [date]);

      res.json({
        success: true,
        data: {
          summary,
          payment_breakdown: paymentBreakdown,
          date
        }
      });

    } catch (error) {
      logger.error("Get sales summary error:", error);
      throw createError("Failed to fetch sales summary", 500);
    }
  })
);

/**
 * @route   GET /api/pos/recent-transactions
 * @desc    Get recent transactions
 * @access  Private
 */
router.get("/recent-transactions",
  asyncHandler(async (req, res) => {
    const { limit = 10, date = new Date().toISOString().split('T')[0] } = req.query;

    try {
      const transactions = await db.query(`
        SELECT 
          st.*,
          u.first_name || ' ' || u.last_name as served_by_name
        FROM sales_transactions st
        LEFT JOIN users u ON st.served_by = u.id
        WHERE DATE(st.created_at) = ?
        ORDER BY st.created_at DESC
        LIMIT ?
      `, [date, parseInt(limit)]);

      res.json({
        success: true,
        data: { transactions }
      });

    } catch (error) {
      logger.error("Get recent transactions error:", error);
      throw createError("Failed to fetch recent transactions", 500);
    }
  })
);

module.exports = router;