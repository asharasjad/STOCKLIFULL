document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.getAttribute("data-page");
  const links = document.querySelectorAll("nav a[data-link]");

  links.forEach((link) => {
    if (link.getAttribute("data-link") === currentPage) {
      link.classList.add("bg-gray-100", "dark:bg-gray-700", "font-semibold", "text-blue-600");
    } else {
      link.classList.remove("bg-gray-100", "dark:bg-gray-700", "font-semibold", "text-blue-600");
    }
  });
});