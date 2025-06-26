document.addEventListener("DOMContentLoaded", () => {
  console.log("Dropdown script loaded.");

  const profileImage = document.getElementById("profileImage");
  const dropdownMenu = document.getElementById("dropdownMenu");
  const loginButton = document.getElementById("loginButton");
  const loginModal = document.getElementById("loginModal");
  const closeModal = document.getElementById("closeModal");

  if (!profileImage || !dropdownMenu || !loginButton || !loginModal || !closeModal) {
    console.error("One or more elements are missing.");
    return;
  }

  console.log("Event listeners are being attached.");

  // Toggle dropdown menu
  profileImage.addEventListener("click", () => {
    console.log("Profile image clicked.");
    dropdownMenu.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!dropdownMenu.contains(e.target) && e.target !== profileImage) {
      dropdownMenu.classList.add("hidden");
    }
  });

  // Show login modal
  loginButton.addEventListener("click", () => {
    console.log("Login button clicked.");
    dropdownMenu.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });

  // Close login modal
  closeModal.addEventListener("click", () => {
    console.log("Close modal button clicked.");
    loginModal.classList.add("hidden");
  });

  // Close modal when clicking outside
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      console.log("Clicked outside modal.");
      loginModal.classList.add("hidden");
    }
  });

  // Handle login form submission
  const loginForm = loginModal.querySelector("form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const rememberMe = document.querySelector('input[type="checkbox"]').checked;
      
      if (!email || !password) {
        showLoginError("Please enter both email and password");
        return;
      }
      
      try {
        // Show loading state
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = "Logging in...";
        submitButton.disabled = true;
        
        // Attempt login
        await window.api.login(email, password, rememberMe);
        
        // Login successful
        loginModal.classList.add("hidden");
        
        // Refresh the page data
        if (window.dashboardManager) {
          window.dashboardManager.loadDashboardData();
        }
        
        // Show success message
        showLoginSuccess("Login successful!");
        
      } catch (error) {
        console.error("Login failed:", error);
        showLoginError(error.message || "Login failed. Please try again.");
      } finally {
        // Reset button state
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.textContent = "Login";
        submitButton.disabled = false;
      }
    });
  }

  // Helper functions for login feedback
  function showLoginError(message) {
    // Remove any existing error messages
    const existingError = loginModal.querySelector(".login-error");
    if (existingError) {
      existingError.remove();
    }
    
    // Create and show error message
    const errorDiv = document.createElement("div");
    errorDiv.className = "login-error bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4";
    errorDiv.textContent = message;
    
    const form = loginModal.querySelector("form");
    form.insertBefore(errorDiv, form.firstChild);
  }

  function showLoginSuccess(message) {
    // Create and show success notification
    const successDiv = document.createElement("div");
    successDiv.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300";
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.opacity = "0";
      setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }
});