const express = require("express");
const { body, query, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../../database/db");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { authorizeRole } = require("../middleware/auth");
const { logger, auditLog } = require("../utils/logger");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/products");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// Dashboard Routes

/**
 * @route   GET /api/inventory/dashboard
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get("/dashboard",
  asyncHandler(async (req, res) => {
    try {
      // Get total products count
      const { total_products } = await db.get("SELECT COUNT(*) as total_products FROM products WHERE status = 'active'");
      
      // Get low stock count
      const { low_stock_count } = await db.get(`
        SELECT COUNT(*) as low_stock_count 
        FROM products 
        WHERE stock_quantity <= reorder_point AND status = 'active'
      `);
      
      // Get pending purchase orders count
      const { pending_orders } = await db.get(`
        SELECT COUNT(*) as pending_orders 
        FROM purchase_orders 
        WHERE status = 'pending' OR status = 'approved'
      `);
      
      // Get active suppliers count
      const { active_suppliers } = await db.get("SELECT COUNT(*) as active_suppliers FROM suppliers WHERE status = 'active'");
      
      // Get recent stock movements (last 7 days)
      const recentMovements = await db.query(`
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku,
          u.first_name || ' ' || u.last_name as performed_by_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.performed_by = u.id
        WHERE sm.created_at >= date('now', '-7 days')
        ORDER BY sm.created_at DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          statistics: {
            total_products: total_products || 0,
            low_stock_count: low_stock_count || 0,
            pending_orders: pending_orders || 0,
            active_suppliers: active_suppliers || 0
          },
          recent_movements: recentMovements || []
        }
      });

    } catch (error) {
      logger.error("Get dashboard error:", error);
      throw createError("Failed to fetch dashboard data", 500);
    }
  })
);

// Products Routes

/**
 * @route   GET /api/inventory/products
 * @desc    Get all products with pagination and filtering
 * @access  Private
 */
router.get("/products",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("search").optional().isLength({ max: 100 }).withMessage("Search term too long"),
    query("category").optional().isInt({ min: 1 }).withMessage("Category must be a valid ID"),
    query("status").optional().isIn(["active", "inactive", "discontinued"]).withMessage("Invalid status"),
    query("low_stock").optional().isBoolean().withMessage("Low stock must be boolean")
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
      page = 1,
      limit = 20,
      search = "",
      category,
      status,
      low_stock,
      sort_by = "name",
      sort_order = "ASC"
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params = [];

    // Build where clause
    if (search) {
      whereClause += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      whereClause += " AND p.category_id = ?";
      params.push(category);
    }

    if (status) {
      whereClause += " AND p.status = ?";
      params.push(status);
    }

    if (low_stock === "true") {
      whereClause += " AND p.stock_quantity <= p.reorder_point";
    }

    // Validate sort fields
    const validSortFields = ["name", "sku", "stock_quantity", "selling_price", "created_at"];
    const sortField = validSortFields.includes(sort_by) ? sort_by : "name";
    const sortDirection = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
      `;
      
      const { total } = await db.get(countQuery, params);

      // Get products
      const productsQuery = `
        SELECT 
          p.*,
          c.name as category_name,
          CASE 
            WHEN p.stock_quantity <= p.reorder_point THEN 1 
            ELSE 0 
          END as is_low_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.${sortField} ${sortDirection}
        LIMIT ? OFFSET ?
      `;

      const products = await db.query(productsQuery, [...params, limit, offset]);

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: total,
            total_pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error("Get products error:", error);
      throw createError("Failed to fetch products", 500);
    }
  })
);

/**
 * @route   GET /api/inventory/products/:id
 * @desc    Get single product
 * @access  Private
 */
router.get("/products/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    try {
      const product = await db.get(`
        SELECT 
          p.*,
          c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [id]);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      res.json({
        success: true,
        data: {
          product
        }
      });

    } catch (error) {
      logger.error("Get product error:", error);
      throw createError("Failed to fetch product", 500);
    }
  })
);

/**
 * @route   POST /api/inventory/products
 * @desc    Create new product
 * @access  Private (Manager/Admin)
 */
router.post("/products",
  authorizeRole(["admin", "manager"]),
  upload.single("image"),
  [
    body("name").trim().isLength({ min: 1, max: 255 }).withMessage("Product name is required"),
    body("sku").trim().isLength({ min: 1, max: 50 }).withMessage("SKU is required"),
    body("category_id").isInt({ min: 1 }).withMessage("Category is required"),
    body("selling_price").isFloat({ min: 0 }).withMessage("Selling price must be positive"),
    body("cost_price").optional().isFloat({ min: 0 }).withMessage("Cost price must be positive"),
    body("stock_quantity").optional().isInt({ min: 0 }).withMessage("Stock quantity must be non-negative"),
    body("min_stock_level").optional().isInt({ min: 0 }).withMessage("Min stock level must be non-negative"),
    body("reorder_point").optional().isInt({ min: 0 }).withMessage("Reorder point must be non-negative")
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
      name,
      sku,
      description = "",
      category_id,
      selling_price,
      stock_quantity = 0,
      min_stock_level = 0,
      reorder_point = 5
    } = req.body;

    let image_url = null;
    if (req.file) {
      image_url = `/uploads/products/${req.file.filename}`;
    }

    try {
      // Check if SKU already exists
      const existingSku = await db.get("SELECT id FROM products WHERE sku = ?", [sku]);
      if (existingSku) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists"
        });
      }

      // Verify category exists
      const category = await db.get("SELECT id FROM categories WHERE id = ?", [category_id]);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Category not found"
        });
      }

      // Create product
      const result = await db.run(`
        INSERT INTO products (
          name, sku, description, category_id, selling_price, stock_quantity, 
          min_stock_level, reorder_point, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        name, sku, description, category_id, selling_price, stock_quantity, 
        min_stock_level, reorder_point
      ]);

      // Initial stock logging can be added later

      const newProduct = await db.get(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [result.lastID]);

      auditLog("product_created", {
        productId: result.lastID,
        productName: name,
        sku,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: { product: newProduct }
      });

    } catch (error) {
      logger.error("Create product error:", error);
      throw createError("Failed to create product", 500);
    }
  })
);

/**
 * @route   PUT /api/inventory/products/:id
 * @desc    Update product
 * @access  Private (Manager/Admin)
 */
router.put("/products/:id",
  authorizeRole(["admin", "manager"]),
  upload.single("image"),
  [
    body("name").optional().trim().isLength({ min: 1, max: 255 }).withMessage("Product name is required"),
    body("sku").optional().trim().isLength({ min: 1, max: 50 }).withMessage("SKU is required"),
    body("category_id").optional().isInt({ min: 1 }).withMessage("Category is required"),
    body("selling_price").optional().isFloat({ min: 0 }).withMessage("Selling price must be positive"),
    body("cost_price").optional().isFloat({ min: 0 }).withMessage("Cost price must be positive"),
    body("stock_quantity").optional().isInt({ min: 0 }).withMessage("Stock quantity must be non-negative"),
    body("min_stock_level").optional().isInt({ min: 0 }).withMessage("Min stock level must be non-negative"),
    body("reorder_point").optional().isInt({ min: 0 }).withMessage("Reorder point must be non-negative")
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    try {
      // Verify product exists
      const existingProduct = await db.get("SELECT * FROM products WHERE id = ?", [id]);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      const {
        name,
        sku,
        description,
        category_id,
        selling_price,
        stock_quantity,
        min_stock_level,
        reorder_point,
        status = "active"
      } = req.body;

      // Check if SKU already exists for different product
      if (sku && sku !== existingProduct.sku) {
        const existingSku = await db.get("SELECT id FROM products WHERE sku = ? AND id != ?", [sku, id]);
        if (existingSku) {
          return res.status(400).json({
            success: false,
            message: "SKU already exists"
          });
        }
      }

      // Verify category exists if provided
      if (category_id) {
        const category = await db.get("SELECT id FROM categories WHERE id = ?", [category_id]);
        if (!category) {
          return res.status(400).json({
            success: false,
            message: "Category not found"
          });
        }
      }

      // Handle image upload
      let image_url = existingProduct.image_url;
      if (req.file) {
        image_url = `/uploads/products/${req.file.filename}`;
      }

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];

      if (name !== undefined) {
        updateFields.push("name = ?");
        updateValues.push(name);
      }
      if (sku !== undefined) {
        updateFields.push("sku = ?");
        updateValues.push(sku);
      }
      if (description !== undefined) {
        updateFields.push("description = ?");
        updateValues.push(description);
      }
      if (category_id !== undefined) {
        updateFields.push("category_id = ?");
        updateValues.push(category_id);
      }
      if (selling_price !== undefined) {
        updateFields.push("selling_price = ?");
        updateValues.push(selling_price);
      }
      if (stock_quantity !== undefined) {
        updateFields.push("stock_quantity = ?");
        updateValues.push(stock_quantity);
      }
      if (min_stock_level !== undefined) {
        updateFields.push("min_stock_level = ?");
        updateValues.push(min_stock_level);
      }
      if (reorder_point !== undefined) {
        updateFields.push("reorder_point = ?");
        updateValues.push(reorder_point);
      }
      if (status !== undefined) {
        updateFields.push("status = ?");
        updateValues.push(status);
      }
      if (image_url !== existingProduct.image_url) {
        updateFields.push("image_url = ?");
        updateValues.push(image_url);
      }

      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateValues.push(id);

      if (updateFields.length > 1) { // More than just updated_at
        await db.run(`
          UPDATE products 
          SET ${updateFields.join(", ")}
          WHERE id = ?
        `, updateValues);
      }

      // Get updated product with category info
      const updatedProduct = await db.get(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [id]);

      auditLog("product_updated", {
        productId: id,
        productName: updatedProduct.name,
        updatedBy: req.user.id,
        changes: req.body,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Product updated successfully",
        data: { product: updatedProduct }
      });

    } catch (error) {
      logger.error("Update product error:", error);
      throw createError("Failed to update product", 500);
    }
  })
);

/**
 * @route   DELETE /api/inventory/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Manager/Admin)
 */
router.delete("/products/:id",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    try {
      // Verify product exists
      const product = await db.get("SELECT * FROM products WHERE id = ?", [id]);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      // Soft delete by setting status to 'deleted'
      await db.run(
        "UPDATE products SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );

      auditLog("product_deleted", {
        productId: id,
        productName: product.name,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Product deleted successfully"
      });

    } catch (error) {
      logger.error("Delete product error:", error);
      throw createError("Failed to delete product", 500);
    }
  })
);

// Categories Routes

/**
 * @route   GET /api/inventory/categories
 * @desc    Get all categories
 * @access  Private
 */
router.get("/categories",
  asyncHandler(async (req, res) => {
    try {
      const categories = await db.query(`
        SELECT 
          c.*,
          COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY c.name
      `);

      res.json({
        success: true,
        data: { categories }
      });

    } catch (error) {
      logger.error("Get categories error:", error);
      throw createError("Failed to fetch categories", 500);
    }
  })
);

/**
 * @route   POST /api/inventory/categories
 * @desc    Create new category
 * @access  Private (Manager/Admin)
 */
router.post("/categories",
  authorizeRole(["admin", "manager"]),
  [
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Category name is required"),
    body("description").optional().isLength({ max: 255 }).withMessage("Description too long")
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

    const { name, description = "" } = req.body;

    try {
      // Check if category name already exists
      const existing = await db.get("SELECT id FROM categories WHERE name = ?", [name]);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Category name already exists"
        });
      }

      const result = await db.run(
        "INSERT INTO categories (name, description) VALUES (?, ?)",
        [name, description]
      );

      const newCategory = await db.get("SELECT * FROM categories WHERE id = ?", [result.lastID]);

      auditLog("category_created", {
        categoryId: result.lastID,
        categoryName: name,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category: newCategory }
      });

    } catch (error) {
      logger.error("Create category error:", error);
      throw createError("Failed to create category", 500);
    }
  })
);

/**
 * @route   DELETE /api/inventory/categories/:id
 * @desc    Delete category (soft delete)
 * @access  Private (Manager/Admin)
 */
router.delete("/categories/:id",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID"
      });
    }

    try {
      // Verify category exists
      const category = await db.get("SELECT * FROM categories WHERE id = ?", [id]);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found"
        });
      }

      // Check if category has products
      const productCount = await db.get(
        "SELECT COUNT(*) as count FROM products WHERE category_id = ? AND status != 'deleted'",
        [id]
      );

      if (productCount.count > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete category with existing products"
        });
      }

      // Soft delete by setting status to 'deleted'
      await db.run(
        "UPDATE categories SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );

      auditLog("category_deleted", {
        categoryId: id,
        categoryName: category.name,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Category deleted successfully"
      });

    } catch (error) {
      logger.error("Delete category error:", error);
      throw createError("Failed to delete category", 500);
    }
  })
);

// Stock Movement Routes

/**
 * @route   POST /api/inventory/stock-movement
 * @desc    Record stock movement (adjustment, transfer, etc.)
 * @access  Private (Manager/Admin)
 */
router.post("/stock-movement",
  authorizeRole(["admin", "manager"]),
  [
    body("product_id").isInt({ min: 1 }).withMessage("Product ID is required"),
    body("movement_type").isIn(["in", "out", "adjustment", "transfer", "expired", "damaged"]).withMessage("Invalid movement type"),
    body("quantity").isInt({ min: 1 }).withMessage("Quantity must be positive"),
    body("notes").optional().isLength({ max: 255 }).withMessage("Notes too long")
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

    const { product_id, movement_type, quantity, notes = "", unit_cost = null } = req.body;

    try {
      // Verify product exists
      const product = await db.get("SELECT * FROM products WHERE id = ?", [product_id]);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      // Calculate new stock quantity
      let newQuantity = product.stock_quantity;
      if (movement_type === "in" || movement_type === "adjustment") {
        newQuantity += quantity;
      } else {
        newQuantity -= quantity;
        if (newQuantity < 0) {
          return res.status(400).json({
            success: false,
            message: "Insufficient stock"
          });
        }
      }

      // Start transaction
      const queries = [
        {
          sql: `INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, unit_cost, notes, performed_by)
                VALUES (?, ?, ?, 'adjustment', ?, ?, ?)`,
          params: [product_id, movement_type, quantity, unit_cost, notes, req.user.id]
        },
        {
          sql: "UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          params: [newQuantity, product_id]
        }
      ];

      await db.transaction(queries);

      auditLog("stock_movement", {
        productId: product_id,
        productName: product.name,
        movementType: movement_type,
        quantity,
        oldQuantity: product.stock_quantity,
        newQuantity,
        performedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Stock movement recorded successfully",
        data: {
          old_quantity: product.stock_quantity,
          new_quantity: newQuantity,
          movement_quantity: quantity
        }
      });

    } catch (error) {
      logger.error("Stock movement error:", error);
      throw createError("Failed to record stock movement", 500);
    }
  })
);

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get products with low stock
 * @access  Private
 */
router.get("/low-stock",
  asyncHandler(async (req, res) => {
    try {
      const products = await db.query(`
        SELECT 
          p.*,
          c.name as category_name,
          (p.reorder_point - p.stock_quantity) as shortage
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.stock_quantity <= p.reorder_point 
          AND p.status = 'active'
        ORDER BY shortage DESC, p.name
      `);

      res.json({
        success: true,
        data: { products }
      });

    } catch (error) {
      logger.error("Get low stock error:", error);
      throw createError("Failed to fetch low stock products", 500);
    }
  })
);

// Suppliers Routes

/**
 * @route   GET /api/inventory/suppliers
 * @desc    Get all suppliers with pagination and filtering
 * @access  Private
 */
router.get("/suppliers",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("search").optional().isLength({ max: 100 }).withMessage("Search term too long"),
    query("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status")
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
      page = 1,
      limit = 20,
      search = "",
      status,
      sort_by = "company_name",
      sort_order = "ASC"
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params = [];

    // Build where clause
    if (search) {
      whereClause += " AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    // Validate sort fields
    const validSortFields = ["company_name", "contact_person", "email", "created_at"];
    const sortField = validSortFields.includes(sort_by) ? sort_by : "company_name";
    const sortDirection = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM suppliers ${whereClause}`;
      const { total } = await db.get(countQuery, params);

      // Get suppliers
      const suppliersQuery = `
        SELECT *
        FROM suppliers
        ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT ? OFFSET ?
      `;

      const suppliers = await db.query(suppliersQuery, [...params, limit, offset]);

      res.json({
        success: true,
        data: {
          suppliers,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: total,
            total_pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error("Get suppliers error:", error);
      throw createError("Failed to fetch suppliers", 500);
    }
  })
);

/**
 * @route   GET /api/inventory/suppliers/:id
 * @desc    Get single supplier
 * @access  Private
 */
router.get("/suppliers/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID"
      });
    }

    try {
      const supplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [id]);

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found"
        });
      }

      res.json({
        success: true,
        data: { supplier }
      });

    } catch (error) {
      logger.error("Get supplier error:", error);
      throw createError("Failed to fetch supplier", 500);
    }
  })
);

/**
 * @route   POST /api/inventory/suppliers
 * @desc    Create new supplier
 * @access  Private (Manager/Admin)
 */
router.post("/suppliers",
  authorizeRole(["admin", "manager"]),
  [
    body("company_name").trim().isLength({ min: 1, max: 255 }).withMessage("Company name is required"),
    body("contact_person").trim().isLength({ min: 1, max: 255 }).withMessage("Contact person is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").optional().trim().isLength({ max: 20 }).withMessage("Phone number too long"),
    body("address").optional().trim().isLength({ max: 500 }).withMessage("Address too long"),
    body("city").optional().trim().isLength({ max: 100 }).withMessage("City name too long"),
    body("country").optional().trim().isLength({ max: 100 }).withMessage("Country name too long"),
    body("postal_code").optional().trim().isLength({ max: 20 }).withMessage("Postal code too long")
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
      company_name,
      contact_person,
      email,
      phone = "",
      address = "",
      city = "",
      country = "",
      postal_code = "",
      notes = ""
    } = req.body;

    try {
      // Check if email already exists
      const existingEmail = await db.get("SELECT id FROM suppliers WHERE email = ?", [email]);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }

      // Create supplier
      const result = await db.run(`
        INSERT INTO suppliers (
          company_name, contact_person, email, phone, address, 
          city, country, postal_code, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        company_name, contact_person, email, phone, address,
        city, country, postal_code, notes
      ]);

      const newSupplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [result.lastID]);

      auditLog("supplier_created", {
        supplierId: result.lastID,
        companyName: company_name,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Supplier created successfully",
        data: { supplier: newSupplier }
      });

    } catch (error) {
      logger.error("Create supplier error:", error);
      throw createError("Failed to create supplier", 500);
    }
  })
);

/**
 * @route   PUT /api/inventory/suppliers/:id
 * @desc    Update supplier
 * @access  Private (Manager/Admin)
 */
router.put("/suppliers/:id",
  authorizeRole(["admin", "manager"]),
  [
    body("company_name").optional().trim().isLength({ min: 1, max: 255 }).withMessage("Company name is required"),
    body("contact_person").optional().trim().isLength({ min: 1, max: 255 }).withMessage("Contact person is required"),
    body("email").optional().isEmail().withMessage("Valid email is required"),
    body("phone").optional().trim().isLength({ max: 20 }).withMessage("Phone number too long"),
    body("address").optional().trim().isLength({ max: 500 }).withMessage("Address too long"),
    body("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status")
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID"
      });
    }

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    try {
      // Verify supplier exists
      const existingSupplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [id]);
      if (!existingSupplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found"
        });
      }

      // Check if email already exists for different supplier
      if (req.body.email && req.body.email !== existingSupplier.email) {
        const existingEmail = await db.get("SELECT id FROM suppliers WHERE email = ? AND id != ?", [req.body.email, id]);
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: "Email already exists"
          });
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];

      const allowedFields = ["company_name", "contact_person", "email", "phone", "address", "city", "country", "postal_code", "notes", "status"];
      
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(req.body[field]);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateValues.push(id);

        await db.run(`
          UPDATE suppliers 
          SET ${updateFields.join(", ")}
          WHERE id = ?
        `, updateValues);
      }

      // Get updated supplier
      const updatedSupplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [id]);

      auditLog("supplier_updated", {
        supplierId: id,
        companyName: updatedSupplier.company_name,
        updatedBy: req.user.id,
        changes: req.body,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Supplier updated successfully",
        data: { supplier: updatedSupplier }
      });

    } catch (error) {
      logger.error("Update supplier error:", error);
      throw createError("Failed to update supplier", 500);
    }
  })
);

/**
 * @route   DELETE /api/inventory/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (Manager/Admin)
 */
router.delete("/suppliers/:id",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID"
      });
    }

    try {
      // Verify supplier exists
      const supplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [id]);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found"
        });
      }

      // Check if supplier has active purchase orders or products
      const activeConnections = await db.get(`
        SELECT 
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ? AND status != 'cancelled') as active_orders,
          (SELECT COUNT(*) FROM products WHERE supplier_id = ? AND status = 'active') as active_products
      `, [id, id]);

      if (activeConnections.active_orders > 0 || activeConnections.active_products > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete supplier with active purchase orders or products"
        });
      }

      // Soft delete by setting status to 'deleted'
      await db.run(
        "UPDATE suppliers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );

      auditLog("supplier_deleted", {
        supplierId: id,
        companyName: supplier.company_name,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Supplier deleted successfully"
      });

    } catch (error) {
      logger.error("Delete supplier error:", error);
      throw createError("Failed to delete supplier", 500);
    }
  })
);

// Purchase Orders Routes

/**
 * @route   GET /api/inventory/purchase-orders
 * @desc    Get all purchase orders
 * @access  Private
 */
router.get("/purchase-orders",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("status").optional().isIn(["pending", "approved", "sent", "delivered", "cancelled"]).withMessage("Invalid status")
  ],
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE po.status != 'deleted'";
    const params = [];

    if (status) {
      whereClause += " AND po.status = ?";
      params.push(status);
    }

    try {
      const orders = await db.query(`
        SELECT 
          po.*,
          s.company_name as supplier_name,
          s.contact_name as supplier_contact,
          COUNT(poi.id) as item_count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
        ${whereClause}
        GROUP BY po.id
        ORDER BY po.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      const totalCount = await db.get(`
        SELECT COUNT(DISTINCT po.id) as count
        FROM purchase_orders po
        ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount.count,
            pages: Math.ceil(totalCount.count / limit)
          }
        }
      });

    } catch (error) {
      logger.error("Get purchase orders error:", error);
      throw createError("Failed to fetch purchase orders", 500);
    }
  })
);

/**
 * @route   POST /api/inventory/purchase-orders
 * @desc    Create new purchase order
 * @access  Private (Manager/Admin)
 */
router.post("/purchase-orders",
  authorizeRole(["admin", "manager"]),
  [
    body("supplier_id").isInt({ min: 1 }).withMessage("Valid supplier ID is required"),
    body("expected_delivery").optional().isISO8601().withMessage("Valid delivery date required"),
    body("notes").optional().isLength({ max: 500 }).withMessage("Notes too long"),
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.product_id").isInt({ min: 1 }).withMessage("Valid product ID required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Valid quantity required"),
    body("items.*.unit_price").isFloat({ min: 0 }).withMessage("Valid unit price required")
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

    const { supplier_id, expected_delivery, notes, items } = req.body;

    try {
      // Begin transaction
      await db.run("BEGIN TRANSACTION");

      // Verify supplier exists
      const supplier = await db.get("SELECT * FROM suppliers WHERE id = ? AND status = 'active'", [supplier_id]);
      if (!supplier) {
        await db.run("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Supplier not found"
        });
      }

      // Generate PO number
      const currentYear = new Date().getFullYear();
      const lastPO = await db.get(`
        SELECT po_number FROM purchase_orders 
        WHERE po_number LIKE 'PO-${currentYear}%' 
        ORDER BY id DESC LIMIT 1
      `);

      let poNumber;
      if (lastPO) {
        const lastNumber = parseInt(lastPO.po_number.split('-')[1].slice(4));
        poNumber = `PO-${currentYear}${(lastNumber + 1).toString().padStart(3, '0')}`;
      } else {
        poNumber = `PO-${currentYear}001`;
      }

      // Calculate total amount
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += item.quantity * item.unit_price;
      }

      // Create purchase order
      const result = await db.run(`
        INSERT INTO purchase_orders (
          po_number, supplier_id, total_amount, expected_delivery, 
          notes, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
      `, [poNumber, supplier_id, totalAmount, expected_delivery || null, notes || null, req.user.id]);

      const purchaseOrderId = result.lastID;

      // Add order items
      for (const item of items) {
        await db.run(`
          INSERT INTO purchase_order_items (
            purchase_order_id, product_id, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?)
        `, [purchaseOrderId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]);
      }

      await db.run("COMMIT");

      auditLog("purchase_order_created", {
        purchaseOrderId,
        poNumber,
        supplierId: supplier_id,
        totalAmount,
        itemCount: items.length,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Purchase order created successfully",
        data: {
          id: purchaseOrderId,
          po_number: poNumber,
          total_amount: totalAmount
        }
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Create purchase order error:", error);
      throw createError("Failed to create purchase order", 500);
    }
  })
);

/**
 * @route   PUT /api/inventory/purchase-orders/:id
 * @desc    Update purchase order
 * @access  Private (Manager/Admin)
 */
router.put("/purchase-orders/:id",
  authorizeRole(["admin", "manager"]),
  [
    body("supplier_id").optional().isInt({ min: 1 }).withMessage("Valid supplier ID required"),
    body("expected_delivery").optional().isISO8601().withMessage("Valid delivery date required"),
    body("notes").optional().isLength({ max: 500 }).withMessage("Notes too long"),
    body("items").optional().isArray({ min: 1 }).withMessage("At least one item required")
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
      // Check if order exists and can be modified
      const order = await db.get("SELECT * FROM purchase_orders WHERE id = ?", [id]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Purchase order not found"
        });
      }

      if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: "Cannot modify delivered or cancelled orders"
        });
      }

      await db.run("BEGIN TRANSACTION");

      // Update purchase order
      const updateFields = [];
      const updateValues = [];

      if (updateData.supplier_id) {
        updateFields.push("supplier_id = ?");
        updateValues.push(updateData.supplier_id);
      }
      if (updateData.expected_delivery) {
        updateFields.push("expected_delivery = ?");
        updateValues.push(updateData.expected_delivery);
      }
      if (updateData.notes !== undefined) {
        updateFields.push("notes = ?");
        updateValues.push(updateData.notes);
      }

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateValues.push(id);

        await db.run(`
          UPDATE purchase_orders 
          SET ${updateFields.join(", ")} 
          WHERE id = ?
        `, updateValues);
      }

      // Update items if provided
      if (updateData.items) {
        // Delete existing items
        await db.run("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", [id]);

        // Add new items
        let totalAmount = 0;
        for (const item of updateData.items) {
          const itemTotal = item.quantity * item.unit_price;
          totalAmount += itemTotal;

          await db.run(`
            INSERT INTO purchase_order_items (
              purchase_order_id, product_id, quantity, unit_price, total_price
            ) VALUES (?, ?, ?, ?, ?)
          `, [id, item.product_id, item.quantity, item.unit_price, itemTotal]);
        }

        // Update total amount
        await db.run(
          "UPDATE purchase_orders SET total_amount = ? WHERE id = ?",
          [totalAmount, id]
        );
      }

      await db.run("COMMIT");

      auditLog("purchase_order_updated", {
        purchaseOrderId: id,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Purchase order updated successfully"
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Update purchase order error:", error);
      throw createError("Failed to update purchase order", 500);
    }
  })
);

/**
 * @route   PATCH /api/inventory/purchase-orders/:id
 * @desc    Update purchase order status
 * @access  Private (Manager/Admin)
 */
router.patch("/purchase-orders/:id",
  authorizeRole(["admin", "manager"]),
  [
    body("status").isIn(["pending", "approved", "sent", "delivered", "cancelled"]).withMessage("Invalid status")
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const order = await db.get("SELECT * FROM purchase_orders WHERE id = ?", [id]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Purchase order not found"
        });
      }

      await db.run(
        "UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, id]
      );

      auditLog("purchase_order_status_updated", {
        purchaseOrderId: id,
        oldStatus: order.status,
        newStatus: status,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Purchase order status updated successfully"
      });

    } catch (error) {
      logger.error("Update purchase order status error:", error);
      throw createError("Failed to update purchase order status", 500);
    }
  })
);

// Recipes Routes

/**
 * @route   GET /api/inventory/recipes
 * @desc    Get all recipes
 * @access  Private
 */
router.get("/recipes",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("category").optional().isLength({ min: 1 }).withMessage("Category filter required"),
    query("status").optional().isIn(["active", "inactive", "draft"]).withMessage("Invalid status")
  ],
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, category, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE r.status != 'deleted'";
    const params = [];

    if (category) {
      whereClause += " AND r.category = ?";
      params.push(category);
    }

    if (status) {
      whereClause += " AND r.status = ?";
      params.push(status);
    }

    try {
      const recipes = await db.query(`
        SELECT 
          r.*,
          COUNT(ri.id) as ingredient_count
        FROM recipes r
        LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        ${whereClause}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      const totalCount = await db.get(`
        SELECT COUNT(*) as count FROM recipes r ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          recipes,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount.count,
            pages: Math.ceil(totalCount.count / limit)
          }
        }
      });

    } catch (error) {
      logger.error("Get recipes error:", error);
      throw createError("Failed to fetch recipes", 500);
    }
  })
);

/**
 * @route   POST /api/inventory/recipes
 * @desc    Create new recipe
 * @access  Private (Manager/Admin)
 */
router.post("/recipes",
  authorizeRole(["admin", "manager"]),
  [
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Recipe name is required"),
    body("category").optional().isLength({ max: 50 }).withMessage("Category too long"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description too long"),
    body("prep_time").optional().isInt({ min: 1 }).withMessage("Valid prep time required"),
    body("cook_time").optional().isInt({ min: 1 }).withMessage("Valid cook time required"),
    body("servings").optional().isInt({ min: 1 }).withMessage("Valid servings count required"),
    body("instructions").optional().isLength({ max: 2000 }).withMessage("Instructions too long"),
    body("status").optional().isIn(["active", "inactive", "draft"]).withMessage("Invalid status"),
    body("ingredients").isArray({ min: 1 }).withMessage("At least one ingredient is required"),
    body("ingredients.*.product_id").isInt({ min: 1 }).withMessage("Valid product ID required"),
    body("ingredients.*.quantity").isFloat({ min: 0 }).withMessage("Valid quantity required"),
    body("ingredients.*.unit").isLength({ min: 1 }).withMessage("Unit is required")
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

    const { name, category, description, prep_time, cook_time, servings, instructions, status = 'active', ingredients } = req.body;

    try {
      await db.run("BEGIN TRANSACTION");

      // Create recipe
      const result = await db.run(`
        INSERT INTO recipes (
          name, category, description, prep_time, cook_time, 
          servings, instructions, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [name, category || null, description || null, prep_time || null, cook_time || null, 
          servings || null, instructions || null, status, req.user.id]);

      const recipeId = result.lastID;

      // Add ingredients
      for (const ingredient of ingredients) {
        await db.run(`
          INSERT INTO recipe_ingredients (
            recipe_id, product_id, quantity, unit
          ) VALUES (?, ?, ?, ?)
        `, [recipeId, ingredient.product_id, ingredient.quantity, ingredient.unit]);
      }

      await db.run("COMMIT");

      auditLog("recipe_created", {
        recipeId,
        recipeName: name,
        ingredientCount: ingredients.length,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Recipe created successfully",
        data: {
          id: recipeId,
          name
        }
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Create recipe error:", error);
      throw createError("Failed to create recipe", 500);
    }
  })
);

/**
 * @route   PUT /api/inventory/recipes/:id
 * @desc    Update recipe
 * @access  Private (Manager/Admin)
 */
router.put("/recipes/:id",
  authorizeRole(["admin", "manager"]),
  [
    body("name").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Recipe name required"),
    body("category").optional().isLength({ max: 50 }).withMessage("Category too long"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description too long"),
    body("prep_time").optional().isInt({ min: 1 }).withMessage("Valid prep time required"),
    body("cook_time").optional().isInt({ min: 1 }).withMessage("Valid cook time required"),
    body("servings").optional().isInt({ min: 1 }).withMessage("Valid servings count required"),
    body("instructions").optional().isLength({ max: 2000 }).withMessage("Instructions too long"),
    body("status").optional().isIn(["active", "inactive", "draft"]).withMessage("Invalid status"),
    body("ingredients").optional().isArray({ min: 1 }).withMessage("At least one ingredient required")
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
      const recipe = await db.get("SELECT * FROM recipes WHERE id = ?", [id]);
      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recipe not found"
        });
      }

      await db.run("BEGIN TRANSACTION");

      // Update recipe
      const updateFields = [];
      const updateValues = [];

      const fields = ["name", "category", "description", "prep_time", "cook_time", "servings", "instructions", "status"];
      
      fields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateValues.push(id);

        await db.run(`
          UPDATE recipes 
          SET ${updateFields.join(", ")} 
          WHERE id = ?
        `, updateValues);
      }

      // Update ingredients if provided
      if (updateData.ingredients) {
        // Delete existing ingredients
        await db.run("DELETE FROM recipe_ingredients WHERE recipe_id = ?", [id]);

        // Add new ingredients
        for (const ingredient of updateData.ingredients) {
          await db.run(`
            INSERT INTO recipe_ingredients (
              recipe_id, product_id, quantity, unit
            ) VALUES (?, ?, ?, ?)
          `, [id, ingredient.product_id, ingredient.quantity, ingredient.unit]);
        }
      }

      await db.run("COMMIT");

      auditLog("recipe_updated", {
        recipeId: id,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Recipe updated successfully"
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Update recipe error:", error);
      throw createError("Failed to update recipe", 500);
    }
  })
);

/**
 * @route   DELETE /api/inventory/recipes/:id
 * @desc    Delete recipe
 * @access  Private (Manager/Admin)
 */
router.delete("/recipes/:id",
  authorizeRole(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const recipe = await db.get("SELECT * FROM recipes WHERE id = ?", [id]);
      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recipe not found"
        });
      }

      await db.run("BEGIN TRANSACTION");

      // Delete recipe ingredients
      await db.run("DELETE FROM recipe_ingredients WHERE recipe_id = ?", [id]);

      // Delete recipe
      await db.run("DELETE FROM recipes WHERE id = ?", [id]);

      await db.run("COMMIT");

      auditLog("recipe_deleted", {
        recipeId: id,
        recipeName: recipe.name,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Recipe deleted successfully"
      });

    } catch (error) {
      await db.run("ROLLBACK");
      logger.error("Delete recipe error:", error);
      throw createError("Failed to delete recipe", 500);
    }
  })
);

module.exports = router;