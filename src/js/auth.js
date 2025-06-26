/**
 * Authentication handling for InventoryPro
 */

class AuthManager {
  constructor() {
    this.api = window.api;
    this.initializeAuth();
  }

  initializeAuth() {
    // Check if user is already authenticated
    if (this.api.isAuthenticated()) {
      this.updateUIForAuthenticatedUser();
    }

    // Setup login form handler
    this.setupLoginForm();
    
    // Setup logout handler
    this.setupLogoutHandler();
  }

  setupLoginForm() {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");
    const loginSubmit = document.getElementById("loginSubmit");

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const email = formData.get("email");
        const password = formData.get("password");
        const rememberMe = formData.get("rememberMe") === "on";

        try {
          // Show loading state
          loginSubmit.disabled = true;
          loginSubmit.textContent = "Logging in...";
          loginError.classList.add("hidden");

          // Attempt login
          const result = await this.api.login(email, password, rememberMe);
          
          // Success - close modal and update UI
          this.closeLoginModal();
          this.updateUIForAuthenticatedUser();
          this.showNotification("Login successful!", "success");

        } catch (error) {
          // Show error
          loginError.textContent = error.message || "Login failed";
          loginError.classList.remove("hidden");
        } finally {
          // Reset button state
          loginSubmit.disabled = false;
          loginSubmit.textContent = "Login";
        }
      });
    }
  }

  setupLogoutHandler() {
    // Add logout functionality to dropdown
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.addEventListener("click", () => {
        if (this.api.isAuthenticated()) {
          this.logout();
        } else {
          this.showLoginModal();
        }
      });
    }
  }

  async logout() {
    try {
      await this.api.logout();
      this.updateUIForUnauthenticatedUser();
      this.showNotification("Logged out successfully", "info");
    } catch (error) {
      console.error("Logout error:", error);
      // Clear auth anyway
      this.api.clearAuth();
      this.updateUIForUnauthenticatedUser();
    }
  }

  updateUIForAuthenticatedUser() {
    const user = this.api.getCurrentUser();
    if (!user) return;

    // Update welcome message
    const welcomeSpan = document.querySelector("span.text-sm.text-gray-700.dark\\:text-gray-300");
    if (welcomeSpan && welcomeSpan.textContent.includes("Welcome,")) {
      welcomeSpan.innerHTML = `Welcome, <span class="font-medium">${user.first_name} ${user.last_name}</span>`;
    }

    // Update login button to logout
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.textContent = "Logout";
    }

    // Load alerts
    this.loadAlerts();
  }

  updateUIForUnauthenticatedUser() {
    // Reset welcome message
    const welcomeSpan = document.querySelector("span.text-sm.text-gray-700.dark\\:text-gray-300");
    if (welcomeSpan) {
      welcomeSpan.innerHTML = `Welcome, <span class="font-medium">Guest</span>`;
    }

    // Update logout button to login
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.textContent = "Login";
    }
  }

  async loadAlerts() {
    try {
      const alertsData = await this.api.getAlerts(true); // Get unread alerts
      this.updateAlertsUI(alertsData.alerts, alertsData.unread_count);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    }
  }

  updateAlertsUI(alerts, unreadCount) {
    const alertsDropdown = document.getElementById("alertsDropdown");
    if (!alertsDropdown) return;

    // Find the alerts list
    const alertsList = alertsDropdown.querySelector("ul");
    if (!alertsList) return;

    // Clear existing alerts
    alertsList.innerHTML = "";

    if (alerts.length === 0) {
      alertsList.innerHTML = '<li class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No new alerts</li>';
    } else {
      alerts.forEach(alert => {
        const li = document.createElement("li");
        li.className = "p-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer";
        li.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">${alert.title}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${this.formatDate(alert.created_at)}</div>
            </div>
            <span class="ml-2 text-xs px-2 py-1 rounded ${this.getAlertSeverityClass(alert.severity)}">${alert.severity}</span>
          </div>
        `;
        
        li.addEventListener("click", () => this.markAlertAsRead(alert.id));
        alertsList.appendChild(li);
      });
    }

    // Update notification badge (if exists)
    this.updateNotificationBadge(unreadCount);
  }

  getAlertSeverityClass(severity) {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "error": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "warning": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "info": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  }

  async markAlertAsRead(alertId) {
    try {
      await this.api.markAlertRead(alertId);
      this.loadAlerts(); // Refresh alerts
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  }

  updateNotificationBadge(count) {
    const bellIcon = document.getElementById("alertBell");
    if (!bellIcon) return;

    // Remove existing badge
    const existingBadge = bellIcon.querySelector(".notification-badge");
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add new badge if count > 0
    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center";
      badge.textContent = count > 99 ? "99+" : count.toString();
      bellIcon.appendChild(badge);
    }
  }

  showLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
      loginModal.classList.remove("hidden");
    }
  }

  closeLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
      loginModal.classList.add("hidden");
    }
    
    // Reset form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.reset();
    }
    
    // Hide error
    const loginError = document.getElementById("loginError");
    if (loginError) {
      loginError.classList.add("hidden");
    }
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-opacity duration-300 ${this.getNotificationClass(type)}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  getNotificationClass(type) {
    switch (type) {
      case "success": return "bg-green-500 text-white";
      case "error": return "bg-red-500 text-white";
      case "warning": return "bg-yellow-500 text-white";
      case "info": return "bg-blue-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

// Initialize auth manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.authManager = new AuthManager();
});