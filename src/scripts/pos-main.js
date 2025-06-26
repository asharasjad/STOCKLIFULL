/**
 * POS Main Dashboard JavaScript
 * Handles dashboard functionality for Point of Sale main page
 */

class POSMainDashboard {
    constructor() {
        this.salesData = {};
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        await this.loadSalesSummary();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    async loadSalesSummary() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await window.api.request('GET', `/pos/sales-summary?date=${today}`);
            
            if (response.success) {
                this.salesData = response.data;
                this.updateDashboard();
            }
        } catch (error) {
            console.error('Failed to load sales summary:', error);
            this.showError('Failed to load today\'s sales data');
        }
    }

    updateDashboard() {
        // Update cards with real data
        this.updateSalesCards();
        this.updatePaymentBreakdown();
        this.updateRecentTransactions();
    }

    updateSalesCards() {
        const { summary } = this.salesData;
        
        // Update daily sales total
        const dailySalesElement = document.querySelector('#dailySales');
        if (dailySalesElement) {
            dailySalesElement.textContent = `£${(summary?.total_sales || 0).toFixed(2)}`;
        }

        // Update transaction count
        const transactionCountElement = document.querySelector('#transactionCount');
        if (transactionCountElement) {
            transactionCountElement.textContent = summary?.transaction_count || 0;
        }

        // Update average sale
        const averageSaleElement = document.querySelector('#averageSale');
        if (averageSaleElement) {
            averageSaleElement.textContent = `£${(summary?.average_sale || 0).toFixed(2)}`;
        }

        // Update total tax
        const totalTaxElement = document.querySelector('#totalTax');
        if (totalTaxElement) {
            totalTaxElement.textContent = `£${(summary?.total_tax || 0).toFixed(2)}`;
        }

        // Update last updated time
        const lastUpdatedElement = document.querySelector('#lastUpdated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date().toLocaleTimeString();
        }
    }

    updatePaymentBreakdown() {
        const { payment_breakdown } = this.salesData;
        const paymentBreakdownElement = document.querySelector('#paymentBreakdown');
        
        if (!paymentBreakdownElement || !payment_breakdown) return;

        if (payment_breakdown.length === 0) {
            paymentBreakdownElement.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-credit-card text-3xl mb-2 block"></i>
                    <p>No transactions today</p>
                </div>
            `;
            return;
        }

        paymentBreakdownElement.innerHTML = payment_breakdown.map(payment => {
            const percentage = ((payment.total / this.salesData.summary.total_sales) * 100).toFixed(1);
            return `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
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

    async updateRecentTransactions() {
        try {
            // Get recent transactions (we'll need to add this endpoint or modify existing)
            const response = await window.api.request('GET', '/pos/recent-transactions?limit=5');
            
            if (response.success && response.data.transactions) {
                this.renderRecentTransactions(response.data.transactions);
            }
        } catch (error) {
            console.error('Failed to load recent transactions:', error);
            // Don't show error for this as it's not critical
        }
    }

    renderRecentTransactions(transactions) {
        const recentTransactionsElement = document.querySelector('#recentTransactions');
        if (!recentTransactionsElement) return;

        if (transactions.length === 0) {
            recentTransactionsElement.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-receipt text-3xl mb-2 block"></i>
                    <p>No recent transactions</p>
                </div>
            `;
            return;
        }

        recentTransactionsElement.innerHTML = transactions.map(transaction => `
            <div class="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div>
                    <div class="font-medium text-gray-800 dark:text-gray-200">${transaction.transaction_number}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        ${new Date(transaction.created_at).toLocaleTimeString()}
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-semibold text-gray-800 dark:text-gray-200">£${transaction.total_amount.toFixed(2)}</div>
                    <div class="text-sm ${transaction.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}">
                        ${transaction.status}
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.querySelector('#refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSalesSummary());
        }

        // New transaction button
        const newTransactionBtn = document.querySelector('#newTransactionBtn');
        if (newTransactionBtn) {
            newTransactionBtn.addEventListener('click', () => {
                window.location.href = 'sales-mode.html';
            });
        }

        // Transaction history button
        const historyBtn = document.querySelector('#transactionHistoryBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.showTransactionHistory());
        }

        // End of day button
        const endOfDayBtn = document.querySelector('#endOfDayBtn');
        if (endOfDayBtn) {
            endOfDayBtn.addEventListener('click', () => this.showEndOfDayModal());
        }
    }

    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadSalesSummary();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    showTransactionHistory() {
        // For now, just show an alert. In a full implementation, this would open a modal or navigate to a history page
        alert('Transaction history feature would be implemented here');
    }

    showEndOfDayModal() {
        const modal = document.querySelector('#endOfDayModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.generateEndOfDayReport();
        }
    }

    hideEndOfDayModal() {
        const modal = document.querySelector('#endOfDayModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    generateEndOfDayReport() {
        const reportContent = document.querySelector('#endOfDayReportContent');
        if (!reportContent || !this.salesData.summary) return;

        const { summary, payment_breakdown } = this.salesData;
        const today = new Date().toLocaleDateString();

        reportContent.innerHTML = `
            <div class="space-y-4">
                <div class="text-center border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Daily Sales Report</h3>
                    <p class="text-gray-600 dark:text-gray-400">${today}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">£${summary.total_sales.toFixed(2)}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Total Sales</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${summary.transaction_count}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Transactions</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-semibold text-purple-600">£${summary.average_sale.toFixed(2)}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Average Sale</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-semibold text-orange-600">£${summary.total_tax.toFixed(2)}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Total Tax</div>
                    </div>
                </div>
                
                ${payment_breakdown && payment_breakdown.length > 0 ? `
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">Payment Breakdown</h4>
                        ${payment_breakdown.map(payment => `
                            <div class="flex justify-between py-1">
                                <span class="text-gray-600 dark:text-gray-400">${payment.name}</span>
                                <span class="font-medium text-gray-800 dark:text-gray-200">£${payment.total.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async printEndOfDayReport() {
        const reportContent = document.querySelector('#endOfDayReportContent');
        if (!reportContent) return;

        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>End of Day Report - ${new Date().toLocaleDateString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
                    .stat { text-align: center; padding: 15px; border: 1px solid #ddd; }
                    .stat-value { font-size: 24px; font-weight: bold; }
                    .stat-label { font-size: 12px; color: #666; }
                    .breakdown { margin-top: 20px; }
                    .breakdown-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>InventoryPro</h1>
                    <h2>End of Day Report</h2>
                    <p>${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</p>
                </div>
                ${reportContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    }

    showError(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-red-500 text-white';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Cleanup when leaving the page
    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'pos-main') {
        window.posMainDashboard = new POSMainDashboard();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.posMainDashboard) {
        window.posMainDashboard.destroy();
    }
});