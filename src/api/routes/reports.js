const express = require("express");
const { query, validationResult } = require("express-validator");
const PDFDocument = require("pdf-lib").PDFDocument;
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const db = require("../../database/db");
const { asyncHandler, createError } = require("../middleware/errorHandler");
const { logger, auditLog } = require("../utils/logger");

const router = express.Router();

/**
 * @route   GET /api/reports/sales
 * @desc    Generate sales report
 * @access  Private
 */
router.get("/sales",
  [
    query("start_date").isISO8601().withMessage("Valid start date is required"),
    query("end_date").isISO8601().withMessage("Valid end date is required"),
    query("format").optional().isIn(["json", "pdf", "excel"]).withMessage("Format must be json, pdf, or excel")
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

    const { start_date, end_date, format = "json" } = req.query;

    try {
      // Sales summary
      const summary = await db.get(`
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(tax_amount), 0) as total_tax,
          COALESCE(AVG(total_amount), 0) as average_transaction,
          COALESCE(SUM(discount_amount), 0) as total_discounts
        FROM sales_transactions 
        WHERE DATE(created_at) BETWEEN ? AND ?
          AND status = 'completed'
      `, [start_date, end_date]);

      // Daily breakdown
      const dailyBreakdown = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transactions,
          COALESCE(SUM(total_amount), 0) as sales,
          COALESCE(SUM(tax_amount), 0) as tax
        FROM sales_transactions 
        WHERE DATE(created_at) BETWEEN ? AND ?
          AND status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `, [start_date, end_date]);

      // Payment method breakdown
      const paymentBreakdown = await db.query(`
        SELECT 
          pm.name,
          COUNT(*) as transaction_count,
          COALESCE(SUM(st.total_amount), 0) as total_amount
        FROM sales_transactions st
        JOIN payment_methods pm ON st.payment_method_id = pm.id
        WHERE DATE(st.created_at) BETWEEN ? AND ?
          AND st.status = 'completed'
        GROUP BY pm.id, pm.name
        ORDER BY total_amount DESC
      `, [start_date, end_date]);

      // Top selling items
      const topItems = await db.query(`
        SELECT 
          ti.item_name,
          SUM(ti.quantity) as total_quantity,
          COALESCE(SUM(ti.total_price), 0) as total_revenue
        FROM transaction_items ti
        JOIN sales_transactions st ON ti.transaction_id = st.id
        WHERE DATE(st.created_at) BETWEEN ? AND ?
          AND st.status = 'completed'
        GROUP BY ti.item_name
        ORDER BY total_revenue DESC
        LIMIT 10
      `, [start_date, end_date]);

      const reportData = {
        period: { start_date, end_date },
        summary,
        daily_breakdown: dailyBreakdown,
        payment_breakdown: paymentBreakdown,
        top_items: topItems,
        generated_at: new Date().toISOString(),
        generated_by: req.user.username
      };

      if (format === "json") {
        res.json({
          success: true,
          data: reportData
        });
      } else {
        // Generate file and return download link
        const filename = await generateReportFile(reportData, format, "sales");
        
        auditLog("report_generated", {
          reportType: "sales",
          format,
          period: `${start_date} to ${end_date}`,
          filename,
          generatedBy: req.user.id,
          ip: req.ip
        });

        res.json({
          success: true,
          message: "Report generated successfully",
          data: {
            download_url: `/api/reports/download/${filename}`,
            filename,
            format
          }
        });
      }

    } catch (error) {
      logger.error("Sales report error:", error);
      throw createError("Failed to generate sales report", 500);
    }
  })
);

/**
 * @route   GET /api/reports/inventory
 * @desc    Generate inventory report
 * @access  Private
 */
router.get("/inventory",
  [
    query("format").optional().isIn(["json", "pdf", "excel"]).withMessage("Format must be json, pdf, or excel"),
    query("category").optional().isInt({ min: 1 }).withMessage("Category must be valid ID"),
    query("low_stock_only").optional().isBoolean().withMessage("Low stock only must be boolean")
  ],
  asyncHandler(async (req, res) => {
    const { format = "json", category, low_stock_only = false } = req.query;

    let whereClause = "WHERE p.status = 'active'";
    const params = [];

    if (category) {
      whereClause += " AND p.category_id = ?";
      params.push(category);
    }

    if (low_stock_only === "true") {
      whereClause += " AND p.stock_quantity <= p.reorder_point";
    }

    try {
      // Inventory summary
      const summary = await db.get(`
        SELECT 
          COUNT(*) as total_products,
          COALESCE(SUM(stock_quantity), 0) as total_stock_items,
          COALESCE(SUM(stock_quantity * cost_price), 0) as total_cost_value,
          COALESCE(SUM(stock_quantity * selling_price), 0) as total_selling_value,
          COUNT(CASE WHEN stock_quantity <= reorder_point THEN 1 END) as low_stock_items
        FROM products p
        ${whereClause}
      `, params);

      // Products details
      const products = await db.query(`
        SELECT 
          p.*,
          c.name as category_name,
          s.company_name as supplier_name,
          (p.stock_quantity * p.cost_price) as total_cost_value,
          (p.stock_quantity * p.selling_price) as total_selling_value,
          CASE WHEN p.stock_quantity <= p.reorder_point THEN 1 ELSE 0 END as is_low_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${whereClause}
        ORDER BY c.name, p.name
      `, params);

      // Category breakdown
      const categoryBreakdown = await db.query(`
        SELECT 
          c.name as category_name,
          COUNT(p.id) as product_count,
          COALESCE(SUM(p.stock_quantity), 0) as total_items,
          COALESCE(SUM(p.stock_quantity * p.cost_price), 0) as total_value
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        WHERE c.status = 'active'
        GROUP BY c.id, c.name
        ORDER BY total_value DESC
      `);

      const reportData = {
        summary,
        products,
        category_breakdown: categoryBreakdown,
        filters: { category, low_stock_only },
        generated_at: new Date().toISOString(),
        generated_by: req.user.username
      };

      if (format === "json") {
        res.json({
          success: true,
          data: reportData
        });
      } else {
        const filename = await generateReportFile(reportData, format, "inventory");
        
        auditLog("report_generated", {
          reportType: "inventory",
          format,
          filters: { category, low_stock_only },
          filename,
          generatedBy: req.user.id,
          ip: req.ip
        });

        res.json({
          success: true,
          message: "Report generated successfully",
          data: {
            download_url: `/api/reports/download/${filename}`,
            filename,
            format
          }
        });
      }

    } catch (error) {
      logger.error("Inventory report error:", error);
      throw createError("Failed to generate inventory report", 500);
    }
  })
);

/**
 * @route   GET /api/reports/staff
 * @desc    Generate staff report
 * @access  Private (Manager/Admin)
 */
router.get("/staff",
  [
    query("start_date").isISO8601().withMessage("Valid start date is required"),
    query("end_date").isISO8601().withMessage("Valid end date is required"),
    query("format").optional().isIn(["json", "pdf", "excel"]).withMessage("Format must be json, pdf, or excel")
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

    const { start_date, end_date, format = "json" } = req.query;

    try {
      // Staff summary
      const summary = await db.get(`
        SELECT 
          COUNT(DISTINCT e.id) as total_employees,
          COALESCE(SUM(tt.total_hours), 0) as total_hours_worked,
          COALESCE(SUM(tt.overtime_hours), 0) as total_overtime,
          COALESCE(SUM(tt.gross_pay), 0) as total_gross_pay,
          COALESCE(AVG(tt.total_hours), 0) as average_hours_per_shift
        FROM employees e
        LEFT JOIN time_tracking tt ON e.id = tt.employee_id
          AND DATE(tt.clock_in) BETWEEN ? AND ?
          AND tt.status = 'completed'
        WHERE e.status = 'active'
      `, [start_date, end_date]);

      // Employee breakdown
      const employeeBreakdown = await db.query(`
        SELECT 
          e.employee_number,
          e.first_name,
          e.last_name,
          e.position,
          e.hourly_rate,
          COUNT(tt.id) as shifts_worked,
          COALESCE(SUM(tt.total_hours), 0) as total_hours,
          COALESCE(SUM(tt.overtime_hours), 0) as overtime_hours,
          COALESCE(SUM(tt.gross_pay), 0) as gross_pay
        FROM employees e
        LEFT JOIN time_tracking tt ON e.id = tt.employee_id
          AND DATE(tt.clock_in) BETWEEN ? AND ?
          AND tt.status = 'completed'
        WHERE e.status = 'active'
        GROUP BY e.id
        ORDER BY total_hours DESC
      `, [start_date, end_date]);

      const reportData = {
        period: { start_date, end_date },
        summary,
        employee_breakdown: employeeBreakdown,
        generated_at: new Date().toISOString(),
        generated_by: req.user.username
      };

      if (format === "json") {
        res.json({
          success: true,
          data: reportData
        });
      } else {
        const filename = await generateReportFile(reportData, format, "staff");
        
        auditLog("report_generated", {
          reportType: "staff",
          format,
          period: `${start_date} to ${end_date}`,
          filename,
          generatedBy: req.user.id,
          ip: req.ip
        });

        res.json({
          success: true,
          message: "Report generated successfully",
          data: {
            download_url: `/api/reports/download/${filename}`,
            filename,
            format
          }
        });
      }

    } catch (error) {
      logger.error("Staff report error:", error);
      throw createError("Failed to generate staff report", 500);
    }
  })
);

/**
 * @route   GET /api/reports/download/:filename
 * @desc    Download generated report file
 * @access  Private
 */
router.get("/download/:filename",
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../../reports", filename);

    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Report file not found"
        });
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      
      let contentType = "application/octet-stream";
      if (ext === ".pdf") contentType = "application/pdf";
      if (ext === ".xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", stats.size);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      logger.error("Download report error:", error);
      throw createError("Failed to download report", 500);
    }
  })
);

/**
 * Helper function to generate report files
 */
async function generateReportFile(data, format, reportType) {
  const reportsDir = path.join(__dirname, "../../reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${reportType}-report-${timestamp}.${format === "excel" ? "xlsx" : format}`;
  const filePath = path.join(reportsDir, filename);

  if (format === "excel") {
    await generateExcelReport(data, filePath, reportType);
  } else if (format === "pdf") {
    await generatePDFReport(data, filePath, reportType);
  }

  return filename;
}

/**
 * Generate Excel report with multiple worksheets
 */
async function generateExcelReport(data, filePath, reportType) {
  const workbook = new ExcelJS.Workbook();
  
  // Set workbook properties
  workbook.creator = 'InventoryPro';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Summary worksheet
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Style definitions
  const titleStyle = { font: { bold: true, size: 16, color: { argb: 'FF0066CC' } } };
  const headerStyle = { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } } };
  const labelStyle = { font: { bold: true } };
  
  // Title
  summarySheet.mergeCells('A1:E1');
  summarySheet.getCell('A1').value = `${reportType.toUpperCase()} REPORT`;
  summarySheet.getCell('A1').style = titleStyle;
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };
  
  // Generation info
  summarySheet.getCell('A3').value = 'Generated:';
  summarySheet.getCell('A3').style = labelStyle;
  summarySheet.getCell('B3').value = new Date(data.generated_at).toLocaleString();
  
  summarySheet.getCell('A4').value = 'Generated by:';
  summarySheet.getCell('A4').style = labelStyle;
  summarySheet.getCell('B4').value = data.generated_by;
  
  let currentRow = 6;
  
  // Summary section
  if (data.summary) {
    summarySheet.getCell(`A${currentRow}`).value = 'SUMMARY';
    summarySheet.getCell(`A${currentRow}`).style = headerStyle;
    currentRow += 2;
    
    Object.entries(data.summary).forEach(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      summarySheet.getCell(`A${currentRow}`).value = label;
      summarySheet.getCell(`A${currentRow}`).style = labelStyle;
      
      if (typeof value === 'number' && (key.includes('amount') || key.includes('value') || key.includes('sales') || key.includes('pay'))) {
        summarySheet.getCell(`B${currentRow}`).value = value;
        summarySheet.getCell(`B${currentRow}`).numFmt = '£#,##0.00';
      } else {
        summarySheet.getCell(`B${currentRow}`).value = value;
      }
      currentRow++;
    });
  }
  
  // Report-specific detailed data
  switch (reportType) {
    case 'sales':
      // Daily breakdown sheet
      if (data.daily_breakdown && data.daily_breakdown.length > 0) {
        const dailySheet = workbook.addWorksheet('Daily Breakdown');
        dailySheet.getRow(1).values = ['Date', 'Transactions', 'Sales', 'Tax'];
        dailySheet.getRow(1).font = { bold: true };
        
        data.daily_breakdown.forEach((row, index) => {
          const rowNum = index + 2;
          dailySheet.getRow(rowNum).values = [
            row.date,
            row.transactions,
            row.sales,
            row.tax
          ];
          dailySheet.getCell(`C${rowNum}`).numFmt = '£#,##0.00';
          dailySheet.getCell(`D${rowNum}`).numFmt = '£#,##0.00';
        });
        
        // Auto-fit columns
        dailySheet.columns.forEach(column => {
          column.width = 15;
        });
      }
      
      // Payment breakdown sheet
      if (data.payment_breakdown && data.payment_breakdown.length > 0) {
        const paymentSheet = workbook.addWorksheet('Payment Methods');
        paymentSheet.getRow(1).values = ['Payment Method', 'Transaction Count', 'Total Amount'];
        paymentSheet.getRow(1).font = { bold: true };
        
        data.payment_breakdown.forEach((payment, index) => {
          const rowNum = index + 2;
          paymentSheet.getRow(rowNum).values = [
            payment.name,
            payment.transaction_count,
            payment.total_amount
          ];
          paymentSheet.getCell(`C${rowNum}`).numFmt = '£#,##0.00';
        });
        
        paymentSheet.columns.forEach(column => {
          column.width = 18;
        });
      }
      break;
      
    case 'inventory':
      // Products sheet
      if (data.products && data.products.length > 0) {
        const productsSheet = workbook.addWorksheet('Products');
        productsSheet.getRow(1).values = [
          'Name', 'SKU', 'Category', 'Stock Quantity', 'Reorder Point', 
          'Cost Price', 'Selling Price', 'Total Cost Value', 'Total Selling Value', 'Low Stock'
        ];
        productsSheet.getRow(1).font = { bold: true };
        
        data.products.forEach((product, index) => {
          const rowNum = index + 2;
          productsSheet.getRow(rowNum).values = [
            product.name,
            product.sku,
            product.category_name || 'N/A',
            product.stock_quantity,
            product.reorder_point,
            product.cost_price,
            product.selling_price,
            product.total_cost_value,
            product.total_selling_value,
            product.is_low_stock ? 'Yes' : 'No'
          ];
          
          // Format currency columns
          ['F', 'G', 'H', 'I'].forEach(col => {
            productsSheet.getCell(`${col}${rowNum}`).numFmt = '£#,##0.00';
          });
          
          // Highlight low stock items
          if (product.is_low_stock) {
            productsSheet.getRow(rowNum).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEEEE' }
            };
          }
        });
        
        productsSheet.columns.forEach(column => {
          column.width = 12;
        });
      }
      
      // Category breakdown sheet
      if (data.category_breakdown && data.category_breakdown.length > 0) {
        const categorySheet = workbook.addWorksheet('Categories');
        categorySheet.getRow(1).values = ['Category', 'Product Count', 'Total Items', 'Total Value'];
        categorySheet.getRow(1).font = { bold: true };
        
        data.category_breakdown.forEach((category, index) => {
          const rowNum = index + 2;
          categorySheet.getRow(rowNum).values = [
            category.category_name || 'Uncategorized',
            category.product_count,
            category.total_items,
            category.total_value
          ];
          categorySheet.getCell(`D${rowNum}`).numFmt = '£#,##0.00';
        });
        
        categorySheet.columns.forEach(column => {
          column.width = 15;
        });
      }
      break;
      
    case 'staff':
      // Employee breakdown sheet
      if (data.employee_breakdown && data.employee_breakdown.length > 0) {
        const employeeSheet = workbook.addWorksheet('Employee Summary');
        employeeSheet.getRow(1).values = [
          'Employee Number', 'Name', 'Position', 'Hourly Rate', 'Shifts Worked', 
          'Total Hours', 'Overtime Hours', 'Gross Pay'
        ];
        employeeSheet.getRow(1).font = { bold: true };
        
        data.employee_breakdown.forEach((employee, index) => {
          const rowNum = index + 2;
          employeeSheet.getRow(rowNum).values = [
            employee.employee_number,
            `${employee.first_name} ${employee.last_name}`,
            employee.position,
            employee.hourly_rate,
            employee.shifts_worked,
            employee.total_hours,
            employee.overtime_hours,
            employee.gross_pay
          ];
          
          // Format currency columns
          employeeSheet.getCell(`D${rowNum}`).numFmt = '£#,##0.00';
          employeeSheet.getCell(`H${rowNum}`).numFmt = '£#,##0.00';
        });
        
        employeeSheet.columns.forEach(column => {
          column.width = 14;
        });
      }
      break;
  }
  
  // Auto-fit summary sheet columns
  summarySheet.columns.forEach(column => {
    column.width = 20;
  });
  
  await workbook.xlsx.writeFile(filePath);
}

/**
 * Generate PDF report using pdf-lib
 */
async function generatePDFReport(data, filePath, reportType) {
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add a page
  let page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  // Get fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let yPosition = height - 50;
  const lineHeight = 20;
  const margin = 50;
  
  // Helper function to add text
  const addText = (text, x, y, options = {}) => {
    page.drawText(text, {
      x,
      y,
      size: options.size || 12,
      font: options.bold ? helveticaBoldFont : helveticaFont,
      color: options.color || rgb(0, 0, 0),
      ...options
    });
  };
  
  // Helper function to check if we need a new page
  const checkNewPage = () => {
    if (yPosition < 100) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }
  };
  
  // Title
  addText(`${reportType.toUpperCase()} REPORT`, margin, yPosition, { 
    size: 24, 
    bold: true, 
    color: rgb(0.2, 0.2, 0.8) 
  });
  yPosition -= 40;
  
  // Generation info
  addText(`Generated: ${new Date(data.generated_at).toLocaleString()}`, margin, yPosition, { size: 10, color: rgb(0.5, 0.5, 0.5) });
  yPosition -= lineHeight;
  addText(`Generated by: ${data.generated_by}`, margin, yPosition, { size: 10, color: rgb(0.5, 0.5, 0.5) });
  yPosition -= 30;
  
  // Summary section
  if (data.summary) {
    addText('SUMMARY', margin, yPosition, { size: 16, bold: true });
    yPosition -= 30;
    
    Object.entries(data.summary).forEach(([key, value]) => {
      checkNewPage();
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const displayValue = typeof value === 'number' && key.includes('amount') ? 
        `£${value.toFixed(2)}` : value.toString();
      
      addText(`${label}:`, margin, yPosition, { bold: true });
      addText(displayValue, margin + 150, yPosition);
      yPosition -= lineHeight;
    });
    yPosition -= 20;
  }
  
  // Report-specific sections
  switch (reportType) {
    case 'sales':
      if (data.period) {
        addText('PERIOD', margin, yPosition, { size: 14, bold: true });
        yPosition -= 25;
        addText(`From: ${data.period.start_date}`, margin, yPosition);
        yPosition -= lineHeight;
        addText(`To: ${data.period.end_date}`, margin, yPosition);
        yPosition -= 30;
      }
      
      if (data.payment_breakdown && data.payment_breakdown.length > 0) {
        checkNewPage();
        addText('PAYMENT METHOD BREAKDOWN', margin, yPosition, { size: 14, bold: true });
        yPosition -= 25;
        
        data.payment_breakdown.forEach(payment => {
          checkNewPage();
          addText(payment.name, margin, yPosition, { bold: true });
          addText(`${payment.transaction_count} transactions`, margin + 120, yPosition);
          addText(`£${payment.total_amount.toFixed(2)}`, margin + 250, yPosition);
          yPosition -= lineHeight;
        });
      }
      break;
      
    case 'inventory':
      if (data.category_breakdown && data.category_breakdown.length > 0) {
        checkNewPage();
        addText('CATEGORY BREAKDOWN', margin, yPosition, { size: 14, bold: true });
        yPosition -= 25;
        
        data.category_breakdown.slice(0, 15).forEach(category => {
          checkNewPage();
          addText(category.category_name || 'Uncategorized', margin, yPosition, { bold: true });
          addText(`${category.product_count} products`, margin + 120, yPosition);
          addText(`£${category.total_value.toFixed(2)}`, margin + 250, yPosition);
          yPosition -= lineHeight;
        });
      }
      break;
      
    case 'staff':
      if (data.employee_breakdown && data.employee_breakdown.length > 0) {
        checkNewPage();
        addText('EMPLOYEE BREAKDOWN', margin, yPosition, { size: 14, bold: true });
        yPosition -= 25;
        
        data.employee_breakdown.forEach(employee => {
          checkNewPage();
          addText(`${employee.first_name} ${employee.last_name}`, margin, yPosition, { bold: true });
          addText(employee.position || 'N/A', margin + 120, yPosition);
          addText(`${employee.total_hours || 0}h`, margin + 220, yPosition);
          addText(`£${(employee.gross_pay || 0).toFixed(2)}`, margin + 270, yPosition);
          yPosition -= lineHeight;
        });
      }
      break;
  }
  
  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
}

module.exports = router;