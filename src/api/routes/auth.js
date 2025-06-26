const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");

const db = require("../../database/db");
const { 
  generateToken, 
  authenticateToken, 
  createSession, 
  removeSession 
} = require("../middleware/auth");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { logger, auditLog, securityLog } = require("../utils/logger");

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts, please try again later"
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post("/login", 
  loginLimiter,
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
  ],
  asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { email, password, rememberMe = false } = req.body;

    try {
      // Find user by email
      const user = await db.get(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );

      if (!user) {
        securityLog("login_failed", {
          email,
          reason: "user_not_found",
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }

      // Check if user is active
      if (user.status !== "active") {
        securityLog("login_failed", {
          email,
          userId: user.id,
          reason: "account_inactive",
          status: user.status,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          message: "Account is inactive"
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        securityLog("login_failed", {
          email,
          userId: user.id,
          reason: "invalid_password",
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }

      // Generate token
      const token = generateToken(user);
      
      // Create session
      await createSession(user.id, token);

      // Update last login
      await db.run(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
        [user.id]
      );

      // Audit log
      auditLog("user_login", {
        userId: user.id,
        username: user.username,
        email: user.email,
        ip: req.ip,
        userAgent: req.get("User-Agent")
      });

      // Remove sensitive data
      const { password_hash, ...userResponse } = user;

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: userResponse,
          token,
          expiresIn: rememberMe ? "7d" : "24h"
        }
      });

    } catch (error) {
      logger.error("Login error:", error);
      throw createError("Login failed", 500);
    }
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate token
 * @access  Private
 */
router.post("/logout", 
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      
      if (token) {
        await removeSession(token);
      }

      auditLog("user_logout", {
        userId: req.user.id,
        username: req.user.username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Logout successful"
      });

    } catch (error) {
      logger.error("Logout error:", error);
      throw createError("Logout failed", 500);
    }
  })
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (Admin only)
 * @access  Private (Admin)
 */
router.post("/register",
  authLimiter,
  authenticateToken,
  [
    body("username")
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username must be 3-30 characters and contain only letters, numbers, and underscores"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Password must be at least 8 characters with uppercase, lowercase, and number"),
    body("first_name")
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage("First name is required and must be less than 50 characters"),
    body("last_name")
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage("Last name is required and must be less than 50 characters"),
    body("role")
      .isIn(["admin", "manager", "staff"])
      .withMessage("Role must be admin, manager, or staff")
  ],
  asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can register new users"
      });
    }

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { username, email, password, first_name, last_name, role } = req.body;

    try {
      // Check if user already exists
      const existingUser = await db.get(
        "SELECT id FROM users WHERE email = ? OR username = ?",
        [email, username]
      );

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email or username already exists"
        });
      }

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await db.run(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [username, email, password_hash, first_name, last_name, role]
      );

      const newUser = await db.get(
        "SELECT id, username, email, first_name, last_name, role, status, created_at FROM users WHERE id = ?",
        [result.lastID]
      );

      auditLog("user_created", {
        newUserId: newUser.id,
        newUsername: newUser.username,
        newUserEmail: newUser.email,
        newUserRole: newUser.role,
        createdBy: req.user.id,
        createdByUsername: req.user.username,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: { user: newUser }
      });

    } catch (error) {
      logger.error("Registration error:", error);
      throw createError("Registration failed", 500);
    }
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const user = await db.get(
        "SELECT id, username, email, first_name, last_name, role, status, last_login, created_at FROM users WHERE id = ?",
        [req.user.id]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      logger.error("Get profile error:", error);
      throw createError("Failed to get profile", 500);
    }
  })
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile",
  authenticateToken,
  [
    body("first_name")
      .optional()
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage("First name must be less than 50 characters"),
    body("last_name")
      .optional()
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage("Last name must be less than 50 characters"),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email")
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

    const { first_name, last_name, email } = req.body;
    const updates = {};
    const params = [];

    if (first_name !== undefined) {
      updates.first_name = "first_name = ?";
      params.push(first_name);
    }
    if (last_name !== undefined) {
      updates.last_name = "last_name = ?";
      params.push(last_name);
    }
    if (email !== undefined) {
      // Check if email is already taken
      const existingUser = await db.get(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, req.user.id]
      );

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already taken"
        });
      }

      updates.email = "email = ?";
      params.push(email);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    try {
      params.push(req.user.id);
      
      await db.run(
        `UPDATE users SET ${Object.values(updates).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );

      const updatedUser = await db.get(
        "SELECT id, username, email, first_name, last_name, role, status, last_login, created_at, updated_at FROM users WHERE id = ?",
        [req.user.id]
      );

      auditLog("profile_updated", {
        userId: req.user.id,
        username: req.user.username,
        changes: { first_name, last_name, email },
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: { user: updatedUser }
      });

    } catch (error) {
      logger.error("Profile update error:", error);
      throw createError("Failed to update profile", 500);
    }
  })
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put("/change-password",
  authenticateToken,
  [
    body("current_password")
      .isLength({ min: 1 })
      .withMessage("Current password is required"),
    body("new_password")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("New password must be at least 8 characters with uppercase, lowercase, and number"),
    body("confirm_password")
      .custom((value, { req }) => {
        if (value !== req.body.new_password) {
          throw new Error("Password confirmation does not match");
        }
        return true;
      })
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

    const { current_password, new_password } = req.body;

    try {
      // Get current user with password
      const user = await db.get(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
      
      if (!isCurrentPasswordValid) {
        securityLog("password_change_failed", {
          userId: req.user.id,
          reason: "invalid_current_password",
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }

      // Hash new password
      const saltRounds = 12;
      const new_password_hash = await bcrypt.hash(new_password, saltRounds);

      // Update password
      await db.run(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [new_password_hash, req.user.id]
      );

      auditLog("password_changed", {
        userId: req.user.id,
        username: req.user.username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Password changed successfully"
      });

    } catch (error) {
      logger.error("Password change error:", error);
      throw createError("Failed to change password", 500);
    }
  })
);

module.exports = router;