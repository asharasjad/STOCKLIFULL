const express = require("express");
const { body, query, validationResult } = require("express-validator");

const db = require("../../database/db");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { logger, auditLog } = require("../utils/logger");

const router = express.Router();

/**
 * @route   GET /api/staff/employees
 * @desc    Get all employees
 * @access  Private (Manager/Admin)
 */
router.get("/employees",
  asyncHandler(async (req, res) => {
    const { status = "active" } = req.query;

    try {
      const employees = await db.query(`
        SELECT 
          e.*,
          u.username,
          u.email as user_email
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.status = ?
        ORDER BY e.first_name, e.last_name
      `, [status]);

      res.json({
        success: true,
        data: { employees }
      });

    } catch (error) {
      logger.error("Get employees error:", error);
      throw createError("Failed to fetch employees", 500);
    }
  })
);

/**
 * @route   POST /api/staff/employees
 * @desc    Create new employee
 * @access  Private (Manager/Admin)
 */
router.post("/employees",
  [
    body("employee_number").trim().isLength({ min: 1 }).withMessage("Employee number is required"),
    body("first_name").trim().isLength({ min: 1 }).withMessage("First name is required"),
    body("last_name").trim().isLength({ min: 1 }).withMessage("Last name is required"),
    body("position").trim().isLength({ min: 1 }).withMessage("Position is required"),
    body("hourly_rate").isFloat({ min: 0 }).withMessage("Hourly rate must be positive"),
    body("hire_date").isISO8601().withMessage("Valid hire date is required")
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
      employee_number,
      first_name,
      last_name,
      email = null,
      phone = null,
      address = null,
      position,
      department = null,
      hourly_rate,
      hire_date,
      emergency_contact_name = null,
      emergency_contact_phone = null
    } = req.body;

    try {
      // Check if employee number already exists
      const existing = await db.get("SELECT id FROM employees WHERE employee_number = ?", [employee_number]);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Employee number already exists"
        });
      }

      const result = await db.run(`
        INSERT INTO employees (
          employee_number, first_name, last_name, email, phone, address,
          position, department, hourly_rate, hire_date,
          emergency_contact_name, emergency_contact_phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employee_number, first_name, last_name, email, phone, address,
        position, department, hourly_rate, hire_date,
        emergency_contact_name, emergency_contact_phone
      ]);

      const newEmployee = await db.get("SELECT * FROM employees WHERE id = ?", [result.lastID]);

      auditLog("employee_created", {
        employeeId: result.lastID,
        employeeNumber: employee_number,
        employeeName: `${first_name} ${last_name}`,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: { employee: newEmployee }
      });

    } catch (error) {
      logger.error("Create employee error:", error);
      throw createError("Failed to create employee", 500);
    }
  })
);

/**
 * @route   GET /api/staff/schedules
 * @desc    Get schedules
 * @access  Private (Manager/Admin)
 */
router.get("/schedules",
  [
    query("start_date").optional().isISO8601().withMessage("Invalid start date"),
    query("end_date").optional().isISO8601().withMessage("Invalid end date"),
    query("employee_id").optional().isInt({ min: 1 }).withMessage("Invalid employee ID")
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
      start_date = new Date().toISOString().split('T')[0],
      end_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      employee_id
    } = req.query;

    let whereClause = "WHERE s.schedule_date BETWEEN ? AND ?";
    const params = [start_date, end_date];

    if (employee_id) {
      whereClause += " AND s.employee_id = ?";
      params.push(employee_id);
    }

    try {
      const schedules = await db.query(`
        SELECT 
          s.*,
          e.first_name,
          e.last_name,
          e.position,
          u.username as created_by_name
        FROM schedules s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN users u ON s.created_by = u.id
        ${whereClause}
        ORDER BY s.schedule_date, s.shift_start, e.first_name
      `, params);

      res.json({
        success: true,
        data: { schedules }
      });

    } catch (error) {
      logger.error("Get schedules error:", error);
      throw createError("Failed to fetch schedules", 500);
    }
  })
);

/**
 * @route   POST /api/staff/schedules
 * @desc    Create new schedule
 * @access  Private (Manager/Admin)
 */
router.post("/schedules",
  [
    body("employee_id").isInt({ min: 1 }).withMessage("Employee ID is required"),
    body("schedule_date").isISO8601().withMessage("Valid schedule date is required"),
    body("shift_start").matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Valid start time is required"),
    body("shift_end").matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Valid end time is required"),
    body("break_duration").optional().isInt({ min: 0, max: 480 }).withMessage("Break duration must be 0-480 minutes")
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
      employee_id,
      schedule_date,
      shift_start,
      shift_end,
      break_duration = 30,
      position = null,
      notes = ""
    } = req.body;

    try {
      // Verify employee exists
      const employee = await db.get("SELECT * FROM employees WHERE id = ? AND status = 'active'", [employee_id]);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found"
        });
      }

      // Calculate scheduled hours
      const startTime = new Date(`1970-01-01T${shift_start}:00`);
      const endTime = new Date(`1970-01-01T${shift_end}:00`);
      let scheduledHours = (endTime - startTime) / (1000 * 60 * 60);
      
      if (scheduledHours < 0) {
        scheduledHours += 24; // Handle overnight shifts
      }
      
      scheduledHours -= break_duration / 60; // Subtract break time

      // Check for existing schedule
      const existing = await db.get(
        "SELECT id FROM schedules WHERE employee_id = ? AND schedule_date = ?",
        [employee_id, schedule_date]
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Schedule already exists for this employee on this date"
        });
      }

      const result = await db.run(`
        INSERT INTO schedules (
          employee_id, schedule_date, shift_start, shift_end,
          scheduled_hours, break_duration, position, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employee_id, schedule_date, shift_start, shift_end,
        scheduledHours, break_duration, position, notes, req.user.id
      ]);

      const newSchedule = await db.get(`
        SELECT s.*, e.first_name, e.last_name
        FROM schedules s
        JOIN employees e ON s.employee_id = e.id
        WHERE s.id = ?
      `, [result.lastID]);

      auditLog("schedule_created", {
        scheduleId: result.lastID,
        employeeId: employee_id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        scheduleDate: schedule_date,
        scheduledHours,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: "Schedule created successfully",
        data: { schedule: newSchedule }
      });

    } catch (error) {
      logger.error("Create schedule error:", error);
      throw createError("Failed to create schedule", 500);
    }
  })
);

/**
 * @route   POST /api/staff/clock-in
 * @desc    Clock in employee
 * @access  Private
 */
router.post("/clock-in",
  [
    body("employee_id").isInt({ min: 1 }).withMessage("Employee ID is required")
  ],
  asyncHandler(async (req, res) => {
    const { employee_id } = req.body;
    const currentTime = new Date().toISOString();

    try {
      // Verify employee exists and is active
      const employee = await db.get("SELECT * FROM employees WHERE id = ? AND status = 'active'", [employee_id]);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found"
        });
      }

      // Check if already clocked in
      const activeTime = await db.get(
        "SELECT id FROM time_tracking WHERE employee_id = ? AND clock_out IS NULL",
        [employee_id]
      );

      if (activeTime) {
        return res.status(400).json({
          success: false,
          message: "Employee is already clocked in"
        });
      }

      // Get today's schedule
      const today = new Date().toISOString().split('T')[0];
      const schedule = await db.get(
        "SELECT * FROM schedules WHERE employee_id = ? AND schedule_date = ?",
        [employee_id, today]
      );

      const result = await db.run(`
        INSERT INTO time_tracking (employee_id, schedule_id, clock_in, hourly_rate)
        VALUES (?, ?, ?, ?)
      `, [employee_id, schedule?.id || null, currentTime, employee.hourly_rate]);

      auditLog("employee_clock_in", {
        timeTrackingId: result.lastID,
        employeeId: employee_id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        clockIn: currentTime,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Clocked in successfully",
        data: {
          time_tracking_id: result.lastID,
          clock_in: currentTime
        }
      });

    } catch (error) {
      logger.error("Clock in error:", error);
      throw createError("Failed to clock in", 500);
    }
  })
);

/**
 * @route   POST /api/staff/clock-out
 * @desc    Clock out employee
 * @access  Private
 */
router.post("/clock-out",
  [
    body("employee_id").isInt({ min: 1 }).withMessage("Employee ID is required")
  ],
  asyncHandler(async (req, res) => {
    const { employee_id } = req.body;
    const currentTime = new Date().toISOString();

    try {
      // Find active time tracking record
      const timeRecord = await db.get(
        "SELECT * FROM time_tracking WHERE employee_id = ? AND clock_out IS NULL",
        [employee_id]
      );

      if (!timeRecord) {
        return res.status(400).json({
          success: false,
          message: "Employee is not clocked in"
        });
      }

      // Calculate total hours
      const clockIn = new Date(timeRecord.clock_in);
      const clockOut = new Date(currentTime);
      let totalHours = (clockOut - clockIn) / (1000 * 60 * 60);
      
      // Subtract break time if any
      const breakDuration = timeRecord.break_duration || 0;
      totalHours -= breakDuration / 60;

      // Calculate overtime (hours over 8)
      const regularHours = Math.min(totalHours, 8);
      const overtimeHours = Math.max(0, totalHours - 8);

      // Calculate gross pay
      const grossPay = (regularHours * timeRecord.hourly_rate) + (overtimeHours * timeRecord.hourly_rate * 1.5);

      await db.run(`
        UPDATE time_tracking 
        SET clock_out = ?, total_hours = ?, overtime_hours = ?, gross_pay = ?, status = 'completed'
        WHERE id = ?
      `, [currentTime, totalHours, overtimeHours, grossPay, timeRecord.id]);

      const employee = await db.get("SELECT first_name, last_name FROM employees WHERE id = ?", [employee_id]);

      auditLog("employee_clock_out", {
        timeTrackingId: timeRecord.id,
        employeeId: employee_id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        clockOut: currentTime,
        totalHours,
        overtimeHours,
        grossPay,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Clocked out successfully",
        data: {
          clock_out: currentTime,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          gross_pay: grossPay
        }
      });

    } catch (error) {
      logger.error("Clock out error:", error);
      throw createError("Failed to clock out", 500);
    }
  })
);

module.exports = router;