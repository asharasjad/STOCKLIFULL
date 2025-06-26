const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const path = require("path");

// Import database manager
const db = require("../database/db");

// Import route modules
const authRoutes = require("./routes/auth");
const inventoryRoutes = require("./routes/inventory");
const posRoutes = require("./routes/pos");
const staffRoutes = require("./routes/staff");
const reportsRoutes = require("./routes/reports");
const settingsRoutes = require("./routes/settings");

// Import middleware
const { authenticateToken, authorizeRole } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");
const { logger } = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Electron compatibility
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use("/api/", limiter);

// CORS configuration
app.use(cors({
  origin: ["http://localhost", "file://"], // Allow Electron renderer
  credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent")
  });
  next();
});

// Root endpoint for wait-on
app.get("/", (req, res) => {
  res.json({
    service: "InventoryPro API",
    status: "running",
    version: "1.0.0"
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: db.isInitialized ? "connected" : "disconnected"
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/inventory", authenticateToken, inventoryRoutes);
app.use("/api/pos", authenticateToken, posRoutes);
app.use("/api/staff", authenticateToken, authorizeRole(["admin", "manager"]), staffRoutes);
app.use("/api/reports", authenticateToken, reportsRoutes);
app.use("/api/settings", authenticateToken, authorizeRole(["admin"]), settingsRoutes);

// Serve static files for uploaded content
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  
  try {
    await db.close();
    logger.info("Database connection closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  
  try {
    await db.close();
    logger.info("Database connection closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`InventoryPro API Server running on port ${PORT}`);
  console.log(`🚀 InventoryPro API Server started successfully`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use`);
    console.error(`❌ Port ${PORT} is already in use. Please stop other applications using this port.`);
  } else {
    logger.error("Server error:", error);
    console.error("❌ Server error:", error.message);
  }
  process.exit(1);
});

module.exports = app;