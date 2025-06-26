    // Ensure the DOM is fully loaded before attaching event listeners
    document.addEventListener("DOMContentLoaded", () => {
      const alertBell = document.getElementById("alertBell");
      const alertsDropdown = document.getElementById("alertsDropdown");

      if (alertBell && alertsDropdown) {
        // Toggle the visibility of the alerts dropdown
        alertBell.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent the click from propagating to the document
          alertsDropdown.classList.toggle("hidden");
        });

        // Close the dropdown when clicking outside
        document.addEventListener("click", (e) => {
          if (!alertsDropdown.contains(e.target) && e.target !== alertBell) {
            alertsDropdown.classList.add("hidden");
          }
        });
      } else {
        console.error("Bell or dropdown element not found.");
      }
    });
