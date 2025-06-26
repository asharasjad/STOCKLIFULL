/**
 * InventoryPro API Client
 * Handles all communication with the backend API
 */

class APIClient {
  constructor() {
    this.baseURL = "http://localhost:3001/api";
    this.token = localStorage.getItem("auth_token");
    this.user = JSON.parse(localStorage.getItem("user") || "null");
  }

  // Set authentication token
  setAuth(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
  }

  // Clear authentication
  clearAuth() {
    this.setAuth(null, null);
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Get base URL for downloads
  getBaseURL() {
    return this.baseURL.replace('/api', '');
  }

  // Make API request using Electron's secure bridge
  async request(method, endpoint, data = null) {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      const response = await window.electronAPI.apiRequest(method, endpoint, data, this.token);
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        this.clearAuth();
        this.redirectToLogin();
        throw new Error("Authentication required");
      }

      return response;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Redirect to login (for demo purposes, show login modal)
  redirectToLogin() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
      loginModal.classList.remove("hidden");
    }
  }

  // Authentication endpoints
  async login(email, password, rememberMe = false) {
    const response = await this.request("POST", "/auth/login", {
      email,
      password,
      rememberMe
    });

    if (response.ok && response.data.success) {
      this.setAuth(response.data.data.token, response.data.data.user);
      return response.data;
    }

    throw new Error(response.data.message || "Login failed");
  }

  async logout() {
    try {
      await this.request("POST", "/auth/logout");
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      this.clearAuth();
      window.location.href = "index.html";
    }
  }

  async getProfile() {
    const response = await this.request("GET", "/auth/me");
    if (response.ok && response.data.success) {
      return response.data.data.user;
    }
    throw new Error(response.data.message || "Failed to get profile");
  }

  async updateProfile(profileData) {
    const response = await this.request("PUT", "/auth/profile", profileData);
    if (response.ok && response.data.success) {
      this.user = response.data.data.user;
      localStorage.setItem("user", JSON.stringify(this.user));
      return response.data.data.user;
    }
    throw new Error(response.data.message || "Failed to update profile");
  }

  // Inventory endpoints
  async getDashboardStats() {
    const response = await this.request("GET", "/inventory/dashboard");
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get dashboard statistics");
  }

  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/inventory/products${queryString ? `?${queryString}` : ""}`;
    
    const response = await this.request("GET", endpoint);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get products");
  }

  async getProduct(id) {
    const response = await this.request("GET", `/inventory/products/${id}`);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get product");
  }

  async createProduct(productData) {
    const response = await this.request("POST", "/inventory/products", productData);
    if (response.ok && response.data.success) {
      return response.data.data.product;
    }
    throw new Error(response.data.message || "Failed to create product");
  }

  async updateProduct(id, productData) {
    const response = await this.request("PUT", `/inventory/products/${id}`, productData);
    if (response.ok && response.data.success) {
      return response.data.data.product;
    }
    throw new Error(response.data.message || "Failed to update product");
  }

  async deleteProduct(id) {
    const response = await this.request("DELETE", `/inventory/products/${id}`);
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to delete product");
  }

  async getCategories() {
    const response = await this.request("GET", "/inventory/categories");
    if (response.ok && response.data.success) {
      return response.data.data.categories;
    }
    throw new Error(response.data.message || "Failed to get categories");
  }

  async createCategory(categoryData) {
    const response = await this.request("POST", "/inventory/categories", categoryData);
    if (response.ok && response.data.success) {
      return response.data.data.category;
    }
    throw new Error(response.data.message || "Failed to create category");
  }

  async deleteCategory(id) {
    const response = await this.request("DELETE", `/inventory/categories/${id}`);
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to delete category");
  }

  async getLowStockProducts() {
    const response = await this.request("GET", "/inventory/low-stock");
    if (response.ok && response.data.success) {
      return response.data.data.products;
    }
    throw new Error(response.data.message || "Failed to get low stock products");
  }

  // Suppliers endpoints
  async getSuppliers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/inventory/suppliers${queryString ? `?${queryString}` : ""}`;
    
    const response = await this.request("GET", endpoint);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get suppliers");
  }

  async getSupplier(id) {
    const response = await this.request("GET", `/inventory/suppliers/${id}`);
    if (response.ok && response.data.success) {
      return response.data.data.supplier;
    }
    throw new Error(response.data.message || "Failed to get supplier");
  }

  async createSupplier(supplierData) {
    const response = await this.request("POST", "/inventory/suppliers", supplierData);
    if (response.ok && response.data.success) {
      return response.data.data.supplier;
    }
    throw new Error(response.data.message || "Failed to create supplier");
  }

  async updateSupplier(id, supplierData) {
    const response = await this.request("PUT", `/inventory/suppliers/${id}`, supplierData);
    if (response.ok && response.data.success) {
      return response.data.data.supplier;
    }
    throw new Error(response.data.message || "Failed to update supplier");
  }

  async deleteSupplier(id) {
    const response = await this.request("DELETE", `/inventory/suppliers/${id}`);
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to delete supplier");
  }

  // POS endpoints
  async getMenu() {
    const response = await this.request("GET", "/pos/menu");
    if (response.ok && response.data.success) {
      return response.data.data.menu;
    }
    throw new Error(response.data.message || "Failed to get menu");
  }

  async createTransaction(transactionData) {
    const response = await this.request("POST", "/pos/transaction", transactionData);
    if (response.ok && response.data.success) {
      return response.data.data.transaction;
    }
    throw new Error(response.data.message || "Failed to create transaction");
  }

  async getPaymentMethods() {
    const response = await this.request("GET", "/pos/payment-methods");
    if (response.ok && response.data.success) {
      return response.data.data.payment_methods;
    }
    throw new Error(response.data.message || "Failed to get payment methods");
  }

  async getSalesSummary(date = null) {
    const endpoint = date ? `/pos/sales-summary?date=${date}` : "/pos/sales-summary";
    const response = await this.request("GET", endpoint);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get sales summary");
  }

  // Staff endpoints
  async getEmployees(status = "active") {
    const response = await this.request("GET", `/staff/employees?status=${status}`);
    if (response.ok && response.data.success) {
      return response.data.data.employees;
    }
    throw new Error(response.data.message || "Failed to get employees");
  }

  async createEmployee(employeeData) {
    const response = await this.request("POST", "/staff/employees", employeeData);
    if (response.ok && response.data.success) {
      return response.data.data.employee;
    }
    throw new Error(response.data.message || "Failed to create employee");
  }

  async getSchedules(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/staff/schedules${queryString ? `?${queryString}` : ""}`;
    
    const response = await this.request("GET", endpoint);
    if (response.ok && response.data.success) {
      return response.data.data.schedules;
    }
    throw new Error(response.data.message || "Failed to get schedules");
  }

  async createSchedule(scheduleData) {
    const response = await this.request("POST", "/staff/schedules", scheduleData);
    if (response.ok && response.data.success) {
      return response.data.data.schedule;
    }
    throw new Error(response.data.message || "Failed to create schedule");
  }

  async clockIn(employeeId) {
    const response = await this.request("POST", "/staff/clock-in", { employee_id: employeeId });
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to clock in");
  }

  async clockOut(employeeId) {
    const response = await this.request("POST", "/staff/clock-out", { employee_id: employeeId });
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to clock out");
  }

  // Reports endpoints
  async getSalesReport(startDate, endDate, format = "json") {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, format });
    const response = await this.request("GET", `/reports/sales?${params}`);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get sales report");
  }

  async getInventoryReport(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/reports/inventory${queryString ? `?${queryString}` : ""}`;
    
    const response = await this.request("GET", endpoint);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get inventory report");
  }

  async getStaffReport(startDate, endDate, format = "json") {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, format });
    const response = await this.request("GET", `/reports/staff?${params}`);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get staff report");
  }

  // Settings endpoints
  async getSettings() {
    const response = await this.request("GET", "/settings");
    if (response.ok && response.data.success) {
      return response.data.data.settings;
    }
    throw new Error(response.data.message || "Failed to get settings");
  }

  async updateSettings(settings) {
    const response = await this.request("PUT", "/settings", { settings });
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to update settings");
  }

  async getAlerts(unreadOnly = false, limit = 50) {
    const params = new URLSearchParams({ unread_only: unreadOnly, limit });
    const response = await this.request("GET", `/settings/alerts?${params}`);
    if (response.ok && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to get alerts");
  }

  async markAlertRead(alertId) {
    const response = await this.request("PUT", `/settings/alerts/${alertId}/read`);
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to mark alert as read");
  }

  async dismissAlert(alertId) {
    const response = await this.request("DELETE", `/settings/alerts/${alertId}`);
    if (response.ok && response.data.success) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to dismiss alert");
  }
}

// Create global API client instance
window.api = new APIClient();

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = APIClient;
}