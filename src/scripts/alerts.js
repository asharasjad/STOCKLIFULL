/**
 * Global Alerts Manager
 * Handles low stock alerts and notifications across all pages
 */

class AlertsManager {
  constructor() {
    this.alerts = [];
    this.refreshInterval = null;
    this.init();
  }

  async init() {
    // Load initial alerts
    await this.loadAlerts();
    
    // Set up auto-refresh every 60 seconds
    this.startAutoRefresh();
    
    // Set up alert bell click handler
    this.setupAlertBell();
  }

  setupAlertBell() {
    const alertBell = document.getElementById('alertBell');
    const alertsDropdown = document.getElementById('alertsDropdown');
    
    if (alertBell && alertsDropdown) {
      alertBell.addEventListener('click', (e) => {
        e.stopPropagation();
        alertsDropdown.classList.toggle('hidden');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!alertsDropdown.contains(e.target) && e.target !== alertBell) {
          alertsDropdown.classList.add('hidden');
        }
      });
    }
  }

  async loadAlerts() {
    try {
      // Only load if authenticated
      if (!window.api || !window.api.isAuthenticated()) {
        return;
      }

      // Get low stock products as alerts
      const lowStockProducts = await window.api.getLowStockProducts();
      
      // Convert to alert format
      this.alerts = lowStockProducts.slice(0, 10).map(product => ({
        id: `low-stock-${product.id}`,
        message: `Low stock: ${product.name} (${product.stock_quantity} remaining)`,
        type: 'low_stock',
        product_id: product.id,
        product_name: product.name,
        stock_quantity: product.stock_quantity,
        reorder_point: product.reorder_point,
        created_at: new Date().toISOString(),
        priority: product.stock_quantity === 0 ? 'critical' : 'warning'
      }));

      this.updateAlertsDisplay();
    } catch (error) {
      console.warn('Failed to load alerts:', error);
    }
  }

  updateAlertsDisplay() {
    this.updateAlertBadge();
    this.updateAlertsDropdown();
  }

  updateAlertBadge() {
    const alertBell = document.getElementById('alertBell');
    if (!alertBell) return;

    // Remove existing badge
    const existingBadge = alertBell.querySelector('.alert-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add new badge if there are alerts
    if (this.alerts.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'alert-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold';
      badge.textContent = Math.min(this.alerts.length, 9); // Show max 9, then 9+
      if (this.alerts.length > 9) {
        badge.textContent = '9+';
      }
      
      alertBell.style.position = 'relative';
      alertBell.appendChild(badge);
    }
  }

  updateAlertsDropdown() {
    const alertsContainer = document.querySelector('#alertsDropdown ul');
    if (!alertsContainer) return;

    // Clear existing alerts
    alertsContainer.innerHTML = '';

    if (this.alerts.length === 0) {
      alertsContainer.innerHTML = `
        <li class="p-4 text-sm text-gray-500 dark:text-gray-400 italic text-center">
          <i class="bi bi-check-circle text-green-500 mr-2"></i>
          No low stock alerts
        </li>
      `;
      return;
    }

    // Add each alert
    this.alerts.forEach((alert, index) => {
      const alertItem = document.createElement('li');
      const priorityColor = alert.priority === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
      const borderColor = alert.priority === 'critical' ? 'border-red-500' : 'border-orange-500';
      
      alertItem.className = `p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-l-4 ${borderColor}`;
      alertItem.innerHTML = `
        <div class="flex items-start">
          <i class="bi bi-exclamation-triangle-fill ${priorityColor} mr-2 mt-0.5 flex-shrink-0"></i>
          <div class="flex-1 min-w-0">
            <div class="${priorityColor} font-medium truncate">${this.escapeHtml(alert.product_name)}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              ${alert.stock_quantity} remaining${alert.reorder_point ? ` (reorder at ${alert.reorder_point})` : ''}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${this.formatRelativeTime(alert.created_at)}</div>
          </div>
        </div>
      `;
      
      // Add click handler to navigate to product
      alertItem.addEventListener('click', () => {
        this.navigateToProduct(alert.product_id);
        this.closeDropdown();
      });
      
      alertsContainer.appendChild(alertItem);
      
      // Add divider between items (except last)
      if (index < this.alerts.length - 1) {
        const divider = document.createElement('li');
        divider.className = 'border-t border-gray-200 dark:border-gray-700';
        alertsContainer.appendChild(divider);
      }
    });

    // Add "View all" link at bottom
    const viewAllItem = document.createElement('li');
    viewAllItem.className = 'p-3 text-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700';
    viewAllItem.innerHTML = `
      <a href="inventory.html?filter=low_stock" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
        <i class="bi bi-arrow-right mr-1"></i>
        View all low stock items (${this.alerts.length})
      </a>
    `;
    alertsContainer.appendChild(viewAllItem);
  }

  navigateToProduct(productId) {
    // Check if we're already on inventory page
    const currentPage = document.body.getAttribute('data-page');
    if (currentPage === 'inventory') {
      // If on inventory page, highlight the product
      if (window.inventoryManager) {
        window.inventoryManager.highlightProduct(productId);
      }
    } else {
      // Navigate to inventory page with highlight parameter
      window.location.href = `inventory.html?highlight=${productId}`;
    }
  }

  closeDropdown() {
    const dropdown = document.getElementById('alertsDropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
  }

  startAutoRefresh() {
    // Refresh alerts every 60 seconds
    this.refreshInterval = setInterval(() => {
      this.loadAlerts();
    }, 60000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public method to refresh alerts
  async refresh() {
    await this.loadAlerts();
  }

  // Public method to get current alerts count
  getAlertsCount() {
    return this.alerts.length;
  }

  // Public method to get alerts by priority
  getCriticalAlertsCount() {
    return this.alerts.filter(alert => alert.priority === 'critical').length;
  }

  destroy() {
    this.stopAutoRefresh();
  }
}

// Initialize alerts manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if alert bell exists
  if (document.getElementById('alertBell')) {
    window.alertsManager = new AlertsManager();
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.alertsManager) {
    window.alertsManager.destroy();
  }
});