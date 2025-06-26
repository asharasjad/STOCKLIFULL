const { logger } = require("../utils/logger");

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error("API Error:", {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id || null
  });

  // SQLite errors
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    const message = "Duplicate entry - this record already exists";
    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }

  if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    const message = "Invalid reference - related record not found";
    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }

  if (error.code === "SQLITE_CONSTRAINT") {
    const message = "Database constraint violation";
    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    const message = "Invalid token";
    return res.status(401).json({
      success: false,
      message
    });
  }

  if (error.name === "TokenExpiredError") {
    const message = "Token expired";
    return res.status(401).json({
      success: false,
      message
    });
  }

  // Validation errors
  if (error.name === "ValidationError") {
    const message = "Validation failed";
    const details = error.details?.map(detail => detail.message) || [];
    
    return res.status(400).json({
      success: false,
      message,
      details
    });
  }

  // File upload errors
  if (error.code === "LIMIT_FILE_SIZE") {
    const message = "File too large";
    return res.status(413).json({
      success: false,
      message
    });
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    const message = "Unexpected file field";
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Cast errors (invalid ID format)
  if (error.name === "CastError") {
    const message = "Invalid ID format";
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Default server error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined
  });
};

/**
 * Handle async errors in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create a custom error
 */
const createError = (message, statusCode = 500, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = createError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  createError,
  notFound
};