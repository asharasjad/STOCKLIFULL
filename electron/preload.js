const { contextBridge, ipcRenderer } = require("electron");

// Expose secure API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // API communication
  apiRequest: async (method, endpoint, data = null, token = null) => {
    return await ipcRenderer.invoke("api-request", { method, endpoint, data, token });
  },

  // App utilities
  getAppVersion: async () => {
    return await ipcRenderer.invoke("get-app-version");
  },

  // Local storage helpers for authentication
  storage: {
    setItem: (key, value) => {
      localStorage.setItem(key, value);
    },
    getItem: (key) => {
      return localStorage.getItem(key);
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
    clear: () => {
      localStorage.clear();
    }
  },

  // Utility functions
  utils: {
    formatCurrency: (amount, currency = "GBP") => {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency
      }).format(amount);
    },
    
    formatDate: (date, options = {}) => {
      const defaultOptions = { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      };
      return new Date(date).toLocaleDateString("en-GB", { ...defaultOptions, ...options });
    },
    
    formatTime: (date, is24Hour = true) => {
      return new Date(date).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: !is24Hour
      });
    }
  }
});