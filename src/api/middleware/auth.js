const jwt = require("jsonwebtoken");
const db = require("../../database/db");
const { logger } = require("../utils/logger");

// JWT Secret - In production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Middleware to authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required"
      });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        logger.warn("Invalid token attempt", {
          error: err.message,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: "Invalid or expired token"
        });
      }

      try {
        // Verify user still exists and is active
        const user = await db.get(
          "SELECT id, username, email, role, status FROM users WHERE id = ? AND status = 'active'",
          [decoded.id]
        );

        if (!user) {
          return res.status(403).json({
            success: false,
            message: "User not found or inactive"
          });
        }

        // Update last login
        await db.run(
          "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
          [user.id]
        );

        // Attach user to request
        req.user = user;
        next();

      } catch (dbError) {
        logger.error("Database error in authentication:", dbError);
        return res.status(500).json({
          success: false,
          message: "Authentication error"
        });
      }
    });

  } catch (error) {
    logger.error("Authentication middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }
};

/**
 * Middleware to authorize specific roles
 */
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Unauthorized access attempt", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: "Insufficient permissions"
      });
    }

    next();
  };
};

/**
 * Optional authentication - sets user if token is valid but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        req.user = null;
        return next();
      }

      try {
        const user = await db.get(
          "SELECT id, username, email, role, status FROM users WHERE id = ? AND status = 'active'",
          [decoded.id]
        );

        req.user = user || null;
        next();

      } catch (dbError) {
        req.user = null;
        next();
      }
    });

  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Create and store session
 */
const createSession = async (userId, token) => {
  try {
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    await db.run(
      "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
      [userId, token, expiresAt.toISOString()]
    );

    return true;
  } catch (error) {
    logger.error("Error creating session:", error);
    return false;
  }
};

/**
 * Remove session
 */
const removeSession = async (token) => {
  try {
    await db.run(
      "DELETE FROM user_sessions WHERE session_token = ?",
      [token]
    );
    return true;
  } catch (error) {
    logger.error("Error removing session:", error);
    return false;
  }
};

/**
 * Clean expired sessions
 */
const cleanExpiredSessions = async () => {
  try {
    const result = await db.run(
      "DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP"
    );
    
    if (result.changes > 0) {
      logger.info(`Cleaned ${result.changes} expired sessions`);
    }
    
    return result.changes;
  } catch (error) {
    logger.error("Error cleaning expired sessions:", error);
    return 0;
  }
};

// Clean expired sessions every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

module.exports = {
  generateToken,
  authenticateToken,
  authorizeRole,
  optionalAuth,
  createSession,
  removeSession,
  cleanExpiredSessions,
  JWT_SECRET
};