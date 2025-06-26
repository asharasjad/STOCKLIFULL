/**
 * Dashboard Script
 * Handles loading and displaying real-time dashboard data
 */

class DashboardManager {
  constructor() {
    this.isLoading = false;
    this.refreshInterval = null;
    this.init();
  }

  async init() {
    // Load initial data
    await this.loadDashboardData();
    
    // Set up auto-refresh every 30 seconds
    this.startAutoRefresh();
    
    // Set up manual refresh button if exists
    const refreshButton = document.getElementById('refreshDashboard');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.loadDashboardData());
    }
  }

  async loadDashboardData() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      this.showLoadingState();

      // Check if user is authenticated
      if (!window.api.isAuthenticated()) {
        this.showLoginRequired();
        return;
      }

      // Fetch dashboard statistics
      const dashboardData = await window.api.getDashboardStats();
      this.updateDashboardCards(dashboardData.statistics);
      this.updateRecentMovements(dashboardData.recent_movements);
      
      // Update user welcome message
      this.updateUserWelcome();
      
      // Load alerts
      await this.loadAlerts();

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      this.showError(error.message);
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  updateDashboardCards(stats) {
    // Update Total Items
    const totalItemsElement = document.querySelector('[data-stat="total-items"]');
    if (totalItemsElement) {
      totalItemsElement.textContent = this.formatNumber(stats.total_products);
    }

    // Update Low Stock
    const lowStockElement = document.querySelector('[data-stat="low-stock"]');
    if (lowStockElement) {
      lowStockElement.textContent = this.formatNumber(stats.low_stock_count);
      // Add warning class if low stock count > 0
      const lowStockCard = lowStockElement.closest('.bg-white');
      if (lowStockCard) {
        if (stats.low_stock_count > 0) {
          lowStockCard.classList.add('border-l-4', 'border-orange-500');
        } else {
          lowStockCard.classList.remove('border-l-4', 'border-orange-500');
        }
      }
    }

    // Update Pending Orders
    const pendingOrdersElement = document.querySelector('[data-stat="pending-orders"]');
    if (pendingOrdersElement) {
      pendingOrdersElement.textContent = this.formatNumber(stats.pending_orders);
    }

    // Update Active Suppliers
    const activeSuppliersElement = document.querySelector('[data-stat="active-suppliers"]');
    if (activeSuppliersElement) {
      activeSuppliersElement.textContent = this.formatNumber(stats.active_suppliers);
    }
  }

  updateRecentMovements(movements) {
    // This would update a recent movements section if it exists
    // For now, we'll log it for future implementation
    console.log('Recent stock movements:', movements);
  }

  async loadAlerts() {
    try {
      // Get low stock products as alerts
      const lowStockProducts = await window.api.getLowStockProducts();
      
      // Convert to alert format
      const alerts = lowStockProducts.slice(0, 5).map(product => ({
        id: `low-stock-${product.id}`,
        message: `Low stock alert: ${product.name} (${product.stock_quantity} remaining)`,
        type: 'low_stock',
        product_id: product.id,
        created_at: new Date().toISOString(),
        priority: product.stock_quantity === 0 ? 'critical' : 'warning'
      }));

      this.updateAlertsDropdown(alerts);
    } catch (error) {
      console.warn('Failed to load alerts:', error);
    }
  }

  updateAlertsDropdown(alerts) {
    const alertsContainer = document.querySelector('#alertsDropdown ul');
    const alertBell = document.getElementById('alertBell');
    
    if (!alertsContainer) return;

    // Clear existing alerts
    alertsContainer.innerHTML = '';

    // Update bell badge
    if (alertBell) {
      const existingBadge = alertBell.querySelector('.alert-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      if (alerts.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'alert-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center';
        badge.textContent = alerts.length;
        alertBell.style.position = 'relative';
        alertBell.appendChild(badge);
      }
    }

    if (alerts.length === 0) {
      alertsContainer.innerHTML = '<li class="p-4 text-sm text-gray-500 dark:text-gray-400 italic">No new alerts</li>';
      return;
    }

    // Add each alert
    alerts.forEach(alert => {
      const alertItem = document.createElement('li');
      const priorityColor = alert.priority === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
      
      alertItem.className = `p-4 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-l-4 ${alert.priority === 'critical' ? 'border-red-500' : 'border-orange-500'}`;
      alertItem.innerHTML = `
        <div class="flex items-start">
          <i class="bi bi-exclamation-triangle-fill ${priorityColor} mr-2 mt-0.5"></i>
          <div class="flex-1">
            <div class="${priorityColor} font-medium">${this.escapeHtml(alert.message)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${this.formatRelativeTime(alert.created_at)}</div>
          </div>
        </div>
      `;
      
      // Add click handler to view product or navigate
      alertItem.addEventListener('click', () => {
        if (alert.type === 'low_stock' && alert.product_id) {
          // Navigate to inventory page and highlight product
          window.location.href = `inventory.html?highlight=${alert.product_id}`;
        }
        
        // Close dropdown
        const dropdown = document.getElementById('alertsDropdown');
        if (dropdown) {
          dropdown.classList.add('hidden');
        }
      });
      
      alertsContainer.appendChild(alertItem);
    });

    // Add "View all alerts" link
    const viewAllItem = document.createElement('li');
    viewAllItem.className = 'p-4 text-center border-t border-gray-200 dark:border-gray-700';
    viewAllItem.innerHTML = '<a href="inventory.html?filter=low_stock" class="text-sm text-blue-600 hover:underline">View all low stock items</a>';
    alertsContainer.appendChild(viewAllItem);
  }

  updateUserWelcome() {
    const user = window.api.getCurrentUser();
    const welcomeElement = document.querySelector('[data-user="welcome"]');
    if (welcomeElement && user) {
      const userName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email;
      welcomeElement.innerHTML = `Welcome, <span class="font-medium">${this.escapeHtml(userName)}</span>`;
    }
  }

  showLoginRequired() {
    // Show login modal or redirect to login
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.classList.remove('hidden');
    }
  }

  showLoadingState() {
    // Add loading indicators to cards
    document.querySelectorAll('[data-stat]').forEach(element => {
      element.textContent = '...';
      element.classList.add('animate-pulse');
    });
  }

  hideLoadingState() {
    // Remove loading indicators
    document.querySelectorAll('[data-stat]').forEach(element => {
      element.classList.remove('animate-pulse');
    });
  }

  showError(message) {
    // Show error notification
    console.error('Dashboard error:', message);
    
    // You could implement a toast notification here
    // For now, we'll show a simple alert
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
    errorDiv.textContent = `Error loading dashboard: ${message}`;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  startAutoRefresh() {
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
  }

  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    this.stopAutoRefresh();
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the dashboard page
  if (document.body.getAttribute('data-page') === 'dashboard') {
    window.dashboardManager = new DashboardManager();
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.dashboardManager) {
    window.dashboardManager.destroy();
  }
});