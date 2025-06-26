document.addEventListener("DOMContentLoaded", () => {
  const darkModeToggle = document.getElementById("darkModeToggle");

  // Check for saved dark mode preference
  const isDarkMode = localStorage.getItem("darkMode") === "true";
  if (isDarkMode) {
    document.documentElement.classList.add("dark");
    darkModeToggle.innerHTML = '<span class="material-icons-outlined text-xl align-middle">light_mode</span>';
  }

  // Toggle dark mode on button click
  darkModeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("darkMode", isDark); // Save preference

    // Toggle the icon
    if (isDark) {
      darkModeToggle.innerHTML = '<span class="material-icons-outlined text-xl align-middle">light_mode</span>';
    } else {
      darkModeToggle.innerHTML = '<span class="material-icons-outlined text-xl align-middle">dark_mode</span>';
    }
  });
});