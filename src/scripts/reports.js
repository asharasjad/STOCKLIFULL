/**
 * Reports System JavaScript
 * Handles inventory reports, sales analytics, and staff reports
 */

class ReportsSystem {
    constructor() {
        this.currentReportType = 'inventory';
        this.reportData = {};
        this.chartInstances = {};
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadInitialReports();
        this.initializeDatePickers();
    }

    setupEventListeners() {
        // Report type selection
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-report-type]')) {
                e.preventDefault();
                this.switchReportType(e.target.dataset.reportType);
            }
        });

        // Generate report buttons
        const generateInventoryBtn = document.querySelector('#generateInventoryReport');
        if (generateInventoryBtn) {
            generateInventoryBtn.addEventListener('click', () => this.generateInventoryReport());
        }

        const generateSalesBtn = document.querySelector('#generateSalesReport');
        if (generateSalesBtn) {
            generateSalesBtn.addEventListener('click', () => this.generateSalesReport());
        }

        const generateStaffBtn = document.querySelector('#generateStaffReport');
        if (generateStaffBtn) {
            generateStaffBtn.addEventListener('click', () => this.generateStaffReport());
        }

        // Export buttons
        const exportPdfBtn = document.querySelector('#exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPDF());
        }

        const exportExcelBtn = document.querySelector('#exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }

        // Date range filters
        const dateRangeForm = document.querySelector('#dateRangeForm');
        if (dateRangeForm) {
            dateRangeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyDateFilter();
            });
        }
    }

    initializeDatePickers() {
        const startDate = document.querySelector('#startDate');
        const endDate = document.querySelector('#endDate');

        if (startDate && endDate) {
            // Set default date range (last 30 days)
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            endDate.value = today.toISOString().split('T')[0];
            startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
        }
    }

    switchReportType(reportType) {
        this.currentReportType = reportType;
        
        // Update active tab
        document.querySelectorAll('[data-report-type]').forEach(tab => {
            tab.classList.remove('bg-blue-600', 'text-white');
            tab.classList.add('text-gray-700', 'dark:text-gray-300');
        });
        
        const activeTab = document.querySelector(`[data-report-type="${reportType}"]`);
        if (activeTab) {
            activeTab.classList.add('bg-blue-600', 'text-white');
            activeTab.classList.remove('text-gray-700', 'dark:text-gray-300');
        }

        // Show/hide report sections
        document.querySelectorAll('.report-section').forEach(section => {
            section.classList.add('hidden');
        });

        const activeSection = document.querySelector(`#${reportType}Reports`);
        if (activeSection) {
            activeSection.classList.remove('hidden');
        }

        // Load appropriate reports
        this.loadReportData(reportType);
    }

    async loadInitialReports() {
        await this.loadReportData('inventory');
        this.generateDashboardSummary();
    }

    async loadReportData(reportType) {
        try {
            switch (reportType) {
                case 'inventory':
                    await this.loadInventoryReports();
                    break;
                case 'sales':
                    await this.loadSalesReports();
                    break;
                case 'staff':
                    await this.loadStaffReports();
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${reportType} reports:`, error);
            this.showError(`Failed to load ${reportType} reports`);
        }
    }

    async loadInventoryReports() {
        // Load inventory dashboard data
        const dashboardResponse = await window.api.request('GET', '/inventory/dashboard');
        if (dashboardResponse.success) {
            this.reportData.inventory = dashboardResponse.data;
            this.renderInventoryReports();
        }

        // Load products for detailed analysis
        const productsResponse = await window.api.request('GET', '/inventory/products?limit=100');
        if (productsResponse.success) {
            this.reportData.products = productsResponse.data.products;
            this.renderInventoryAnalytics();
        }

        // Load suppliers data
        const suppliersResponse = await window.api.request('GET', '/inventory/suppliers');
        if (suppliersResponse.success) {
            this.reportData.suppliers = suppliersResponse.data.suppliers;
        }
    }

    async loadSalesReports() {
        const startDate = document.querySelector('#startDate')?.value || this.getDefaultStartDate();
        const endDate = document.querySelector('#endDate')?.value || this.getDefaultEndDate();

        // Load sales summary
        const salesResponse = await window.api.request('GET', `/pos/sales-summary?date=${endDate}`);
        if (salesResponse.success) {
            this.reportData.sales = salesResponse.data;
            this.renderSalesReports();
        }

        // Load recent transactions for analysis
        const transactionsResponse = await window.api.request('GET', `/pos/recent-transactions?limit=50&date=${endDate}`);
        if (transactionsResponse.success) {
            this.reportData.transactions = transactionsResponse.data.transactions;
            this.renderSalesAnalytics();
        }
    }

    async loadStaffReports() {
        // Load employees data
        const employeesResponse = await window.api.request('GET', '/staff/employees');
        if (employeesResponse.success) {
            this.reportData.employees = employeesResponse.data.employees;
        }

        // Load schedules for current week
        const startDate = this.getWeekStart();
        const endDate = this.getWeekEnd();
        
        const schedulesResponse = await window.api.request('GET', `/staff/schedules?start_date=${startDate}&end_date=${endDate}`);
        if (schedulesResponse.success) {
            this.reportData.schedules = schedulesResponse.data.schedules;
            this.renderStaffReports();
        }
    }

    renderInventoryReports() {
        const inventoryStatsContainer = document.querySelector('#inventoryStats');
        if (!inventoryStatsContainer || !this.reportData.inventory) return;

        const stats = this.reportData.inventory;
        
        inventoryStatsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Products</h3>
                            <p class="text-2xl font-bold text-blue-600">${stats.total_products || 0}</p>
                        </div>
                        <i class="bi bi-box text-4xl text-blue-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock Items</h3>
                            <p class="text-2xl font-bold text-red-600">${stats.low_stock_count || 0}</p>
                        </div>
                        <i class="bi bi-exclamation-triangle text-4xl text-red-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Stock Value</h3>
                            <p class="text-2xl font-bold text-green-600">£${(stats.total_value || 0).toFixed(2)}</p>
                        </div>
                        <i class="bi bi-currency-pound text-4xl text-green-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Categories</h3>
                            <p class="text-2xl font-bold text-purple-600">${stats.total_categories || 0}</p>
                        </div>
                        <i class="bi bi-tags text-4xl text-purple-500"></i>
                    </div>
                </div>
            </div>
        `;
    }

    renderInventoryAnalytics() {
        if (!this.reportData.products) return;

        // Render low stock products table
        this.renderLowStockTable();
        
        // Render stock value chart
        this.renderStockValueChart();
        
        // Render category distribution
        this.renderCategoryDistribution();
    }

    renderLowStockTable() {
        const lowStockContainer = document.querySelector('#lowStockTable');
        if (!lowStockContainer) return;

        const lowStockProducts = this.reportData.products.filter(product => 
            product.stock_quantity <= product.reorder_point
        );

        if (lowStockProducts.length === 0) {
            lowStockContainer.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-check-circle text-3xl mb-2 block text-green-500"></i>
                    <p>All products are adequately stocked</p>
                </div>
            `;
            return;
        }

        lowStockContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Stock</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reorder Point</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        ${lowStockProducts.map(product => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${product.name}</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">${product.category_name || 'N/A'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${product.sku}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${product.stock_quantity === 0 ? 'text-red-600' : 'text-yellow-600'}">${product.stock_quantity}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${product.reorder_point}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        product.stock_quantity === 0 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                    }">
                                        ${product.stock_quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderSalesReports() {
        const salesStatsContainer = document.querySelector('#salesStats');
        if (!salesStatsContainer || !this.reportData.sales) return;

        const stats = this.reportData.sales.summary;
        
        salesStatsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Daily Sales</h3>
                            <p class="text-2xl font-bold text-green-600">£${(stats.total_sales || 0).toFixed(2)}</p>
                        </div>
                        <i class="bi bi-currency-pound text-4xl text-green-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Transactions</h3>
                            <p class="text-2xl font-bold text-blue-600">${stats.transaction_count || 0}</p>
                        </div>
                        <i class="bi bi-receipt text-4xl text-blue-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Average Sale</h3>
                            <p class="text-2xl font-bold text-purple-600">£${(stats.average_sale || 0).toFixed(2)}</p>
                        </div>
                        <i class="bi bi-graph-up text-4xl text-purple-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tax</h3>
                            <p class="text-2xl font-bold text-orange-600">£${(stats.total_tax || 0).toFixed(2)}</p>
                        </div>
                        <i class="bi bi-calculator text-4xl text-orange-500"></i>
                    </div>
                </div>
            </div>
        `;

        // Render payment method breakdown
        this.renderPaymentBreakdown();
    }

    renderPaymentBreakdown() {
        const paymentContainer = document.querySelector('#paymentBreakdown');
        if (!paymentContainer || !this.reportData.sales.payment_breakdown) return;

        const payments = this.reportData.sales.payment_breakdown;
        
        if (payments.length === 0) {
            paymentContainer.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-credit-card text-3xl mb-2 block"></i>
                    <p>No payment data available</p>
                </div>
            `;
            return;
        }

        const total = payments.reduce((sum, payment) => sum + payment.total, 0);

        paymentContainer.innerHTML = payments.map(payment => {
            const percentage = ((payment.total / total) * 100).toFixed(1);
            return `
                <div class="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    <div>
                        <span class="font-medium text-gray-800 dark:text-gray-200">${payment.name}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">(${payment.count} transactions)</span>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold text-gray-800 dark:text-gray-200">£${payment.total.toFixed(2)}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${percentage}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderStaffReports() {
        const staffStatsContainer = document.querySelector('#staffStats');
        if (!staffStatsContainer) return;

        const activeEmployees = this.reportData.employees?.filter(emp => emp.status === 'active') || [];
        const totalSchedules = this.reportData.schedules?.length || 0;
        const totalHours = this.reportData.schedules?.reduce((sum, schedule) => sum + (schedule.scheduled_hours || 0), 0) || 0;

        staffStatsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Employees</h3>
                            <p class="text-2xl font-bold text-blue-600">${activeEmployees.length}</p>
                        </div>
                        <i class="bi bi-people text-4xl text-blue-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Shifts</h3>
                            <p class="text-2xl font-bold text-green-600">${totalSchedules}</p>
                        </div>
                        <i class="bi bi-calendar-week text-4xl text-green-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Hours</h3>
                            <p class="text-2xl font-bold text-purple-600">${totalHours.toFixed(1)}</p>
                        </div>
                        <i class="bi bi-clock text-4xl text-purple-500"></i>
                    </div>
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Hours/Employee</h3>
                            <p class="text-2xl font-bold text-orange-600">${activeEmployees.length > 0 ? (totalHours / activeEmployees.length).toFixed(1) : '0.0'}</p>
                        </div>
                        <i class="bi bi-person-check text-4xl text-orange-500"></i>
                    </div>
                </div>
            </div>
        `;

        this.renderEmployeeScheduleTable();
    }

    renderEmployeeScheduleTable() {
        const scheduleContainer = document.querySelector('#employeeScheduleTable');
        if (!scheduleContainer) return;

        const schedules = this.reportData.schedules || [];
        
        if (schedules.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-calendar-x text-3xl mb-2 block"></i>
                    <p>No schedules found for this period</p>
                </div>
            `;
            return;
        }

        scheduleContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hours</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Position</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        ${schedules.map(schedule => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${schedule.first_name} ${schedule.last_name}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    ${new Date(schedule.schedule_date).toLocaleDateString()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    ${schedule.scheduled_hours}h
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    ${schedule.position || 'N/A'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        schedule.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                        schedule.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                    }">
                                        ${schedule.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async generateInventoryReport() {
        this.showLoading(true);
        try {
            await this.loadInventoryReports();
            this.showSuccess('Inventory report generated successfully');
        } catch (error) {
            this.showError('Failed to generate inventory report');
        } finally {
            this.showLoading(false);
        }
    }

    async generateSalesReport() {
        this.showLoading(true);
        try {
            await this.loadSalesReports();
            this.showSuccess('Sales report generated successfully');
        } catch (error) {
            this.showError('Failed to generate sales report');
        } finally {
            this.showLoading(false);
        }
    }

    async generateStaffReport() {
        this.showLoading(true);
        try {
            await this.loadStaffReports();
            this.showSuccess('Staff report generated successfully');
        } catch (error) {
            this.showError('Failed to generate staff report');
        } finally {
            this.showLoading(false);
        }
    }

    async exportToPDF() {
        try {
            this.showLoading(true);
            
            const exportData = {
                reportType: this.currentReportType,
                startDate: document.querySelector('#startDate')?.value,
                endDate: document.querySelector('#endDate')?.value
            };

            let apiEndpoint;
            switch (this.currentReportType) {
                case 'inventory':
                    apiEndpoint = '/reports/inventory?format=pdf';
                    if (exportData.startDate && exportData.endDate) {
                        // For inventory, we don't use date range but could add category filter
                    }
                    break;
                case 'sales':
                    apiEndpoint = `/reports/sales?format=pdf&start_date=${exportData.startDate || this.getDefaultStartDate()}&end_date=${exportData.endDate || this.getDefaultEndDate()}`;
                    break;
                case 'staff':
                    apiEndpoint = `/reports/staff?format=pdf&start_date=${exportData.startDate || this.getWeekStart()}&end_date=${exportData.endDate || this.getWeekEnd()}`;
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            const response = await window.api.request('GET', apiEndpoint);
            
            if (response.success) {
                // Download the generated file
                const downloadUrl = response.data.download_url;
                await this.downloadFile(downloadUrl, response.data.filename);
                this.showSuccess('PDF report generated and downloaded successfully');
            } else {
                throw new Error(response.message || 'Failed to generate PDF');
            }

        } catch (error) {
            console.error('PDF export error:', error);
            this.showError('Failed to generate PDF report: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async exportToExcel() {
        try {
            this.showLoading(true);
            
            const exportData = {
                reportType: this.currentReportType,
                startDate: document.querySelector('#startDate')?.value,
                endDate: document.querySelector('#endDate')?.value
            };

            let apiEndpoint;
            switch (this.currentReportType) {
                case 'inventory':
                    apiEndpoint = '/reports/inventory?format=excel';
                    break;
                case 'sales':
                    apiEndpoint = `/reports/sales?format=excel&start_date=${exportData.startDate || this.getDefaultStartDate()}&end_date=${exportData.endDate || this.getDefaultEndDate()}`;
                    break;
                case 'staff':
                    apiEndpoint = `/reports/staff?format=excel&start_date=${exportData.startDate || this.getWeekStart()}&end_date=${exportData.endDate || this.getWeekEnd()}`;
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            const response = await window.api.request('GET', apiEndpoint);
            
            if (response.success) {
                // Download the generated file
                const downloadUrl = response.data.download_url;
                await this.downloadFile(downloadUrl, response.data.filename);
                this.showSuccess('Excel report generated and downloaded successfully');
            } else {
                throw new Error(response.message || 'Failed to generate Excel');
            }

        } catch (error) {
            console.error('Excel export error:', error);
            this.showError('Failed to generate Excel report: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async downloadFile(downloadUrl, filename) {
        try {
            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = `${window.api.getBaseURL()}${downloadUrl}`;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error('Download error:', error);
            throw new Error('Failed to download file');
        }
    }

    getDefaultStartDate() {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }

    getWeekStart() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        return new Date(today.setDate(diff)).toISOString().split('T')[0];
    }

    getWeekEnd() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + 6;
        return new Date(today.setDate(diff)).toISOString().split('T')[0];
    }

    showLoading(show) {
        const loadingElement = document.querySelector('#reportsLoading');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize reports system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'reports') {
        window.reportsSystem = new ReportsSystem();
    }
});