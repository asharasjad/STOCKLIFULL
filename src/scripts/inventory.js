/**
 * Inventory Management Script
 * Handles product listing, searching, filtering, and CRUD operations
 */

class InventoryManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentSearch = '';
    this.currentCategory = '';
    this.currentStatus = '';
    this.isLoading = false;
    this.products = [];
    this.categories = [];
    
    this.init();
  }

  async init() {
    // Load initial data
    await this.loadCategories();
    await this.loadProducts();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check for URL parameters (like highlighting a product from alerts)
    this.handleUrlParameters();
  }

  handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle highlight parameter
    const highlightId = urlParams.get('highlight');
    if (highlightId) {
      setTimeout(() => {
        this.highlightProduct(parseInt(highlightId));
      }, 1000); // Wait for products to load
    }
    
    // Handle filter parameter
    const filter = urlParams.get('filter');
    if (filter === 'low_stock') {
      this.currentLowStock = true;
      this.loadProducts();
    }
  }

  highlightProduct(productId) {
    // Find the product row and highlight it
    const rows = document.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const editButton = row.querySelector(`button[onclick*="editProduct(${productId})"]`);
      if (editButton) {
        // Add highlight animation
        row.classList.add('bg-yellow-100', 'dark:bg-yellow-900');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          row.classList.remove('bg-yellow-100', 'dark:bg-yellow-900');
        }, 3000);
      }
    });
  }

  setupEventListeners() {
    // Search input
    const searchInput = document.querySelector('input[placeholder="Search items..."]');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentSearch = e.target.value;
          this.currentPage = 1;
          this.loadProducts();
        }, 300);
      });
    }

    // Add new item button
    const addButton = document.querySelector('button[id="addNewItem"]');
    if (addButton) {
      addButton.addEventListener('click', () => this.showAddItemModal());
    }

    // Export button
    const exportButton = document.querySelector('button[data-action="export"]');
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportProducts());
    }

    // Filter button
    const filterButton = document.querySelector('button[data-action="filter"]');
    if (filterButton) {
      filterButton.addEventListener('click', () => this.showFilterModal());
    }

    // Categories button
    const categoriesButton = document.getElementById('manageCategoriesBtn');
    if (categoriesButton) {
      categoriesButton.addEventListener('click', () => this.showCategoriesModal());
    }

    // Product modal events
    this.setupModalEvents();
    this.setupCategoriesModalEvents();
  }

  setupModalEvents() {
    const modal = document.getElementById('productModal');
    const closeButton = document.getElementById('closeProductModal');
    const cancelButton = document.getElementById('cancelProduct');
    const form = document.getElementById('productForm');

    // Close modal events
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hideProductModal());
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.hideProductModal());
    }

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideProductModal();
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }
  }

  setupCategoriesModalEvents() {
    const modal = document.getElementById('categoriesModal');
    const closeButton = document.getElementById('closeCategoriesModal');
    const closeBtn = document.getElementById('closeCategoriesModalBtn');
    const form = document.getElementById('categoryForm');

    // Close modal events
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hideCategoriesModal());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideCategoriesModal());
    }

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideCategoriesModal();
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCategory();
      });
    }
  }

  async loadProducts() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      this.showLoadingState();

      // Check authentication
      if (!window.api.isAuthenticated()) {
        this.showLoginRequired();
        return;
      }

      // Build query parameters
      const params = {
        page: this.currentPage,
        limit: this.itemsPerPage,
        search: this.currentSearch,
        sort_by: 'name',
        sort_order: 'ASC'
      };

      if (this.currentCategory) {
        params.category = this.currentCategory;
      }

      if (this.currentStatus) {
        params.status = this.currentStatus;
      }

      if (this.currentLowStock) {
        params.low_stock = true;
      }

      // Fetch products
      const response = await window.api.getProducts(params);
      this.products = response.products;
      
      // Update the table
      this.updateProductsTable(response.products);
      this.updatePagination(response.pagination);

    } catch (error) {
      console.error('Failed to load products:', error);
      this.showError('Failed to load products: ' + error.message);
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  async loadCategories() {
    try {
      const categories = await window.api.getCategories();
      this.categories = categories;
    } catch (error) {
      console.warn('Failed to load categories:', error);
    }
  }

  updateProductsTable(products) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <div class="flex flex-col items-center">
              <i class="bi bi-box-seam text-4xl mb-2"></i>
              <p>No products found</p>
              ${this.currentSearch ? '<p class="text-sm">Try adjusting your search terms</p>' : ''}
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(product => `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            ${product.image_url ? 
              `<img src="${this.escapeHtml(product.image_url)}" alt="${this.escapeHtml(product.name)}" class="w-10 h-10 rounded-lg object-cover mr-3">` :
              `<div class="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center mr-3">
                <i class="bi bi-image text-gray-400"></i>
              </div>`
            }
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${this.escapeHtml(product.name)}</div>
              ${product.description ? `<div class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">${this.escapeHtml(product.description)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${this.escapeHtml(product.sku)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${this.escapeHtml(product.category_name || 'Uncategorized')}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          <div class="flex items-center">
            <span class="${product.is_low_stock ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}">${product.stock_quantity}</span>
            ${product.is_low_stock ? '<i class="bi bi-exclamation-triangle-fill text-orange-500 ml-1"></i>' : ''}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          $${parseFloat(product.selling_price).toFixed(2)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${this.getStatusBadge(product.status, product.is_low_stock)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="inventoryManager.editProduct(${product.id})" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-3" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button onclick="inventoryManager.deleteProduct(${product.id})" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-500" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  getStatusBadge(status, isLowStock) {
    if (isLowStock) {
      return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">Low Stock</span>';
    }
    
    switch (status) {
      case 'active':
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</span>';
      case 'inactive':
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Inactive</span>';
      case 'discontinued':
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Discontinued</span>';
      default:
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Unknown</span>';
    }
  }

  updatePagination(pagination) {
    const paginationInfo = document.querySelector('.pagination-info');
    const paginationButtons = document.querySelector('.pagination-buttons');
    
    if (paginationInfo) {
      const start = (pagination.current_page - 1) * pagination.per_page + 1;
      const end = Math.min(start + pagination.per_page - 1, pagination.total_items);
      paginationInfo.textContent = `Showing ${start} to ${end} of ${pagination.total_items} entries`;
    }

    if (paginationButtons) {
      paginationButtons.innerHTML = this.generatePaginationButtons(pagination);
    }
  }

  generatePaginationButtons(pagination) {
    const { current_page, total_pages } = pagination;
    let buttons = '';

    // Previous button
    buttons += `
      <button ${current_page <= 1 ? 'disabled' : ''} 
              onclick="inventoryManager.goToPage(${current_page - 1})" 
              class="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${current_page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}">
        Previous
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);

    for (let i = startPage; i <= endPage; i++) {
      buttons += `
        <button onclick="inventoryManager.goToPage(${i})" 
                class="px-3 py-1 ${i === current_page ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'} rounded">
          ${i}
        </button>
      `;
    }

    // Next button
    buttons += `
      <button ${current_page >= total_pages ? 'disabled' : ''} 
              onclick="inventoryManager.goToPage(${current_page + 1})" 
              class="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${current_page >= total_pages ? 'opacity-50 cursor-not-allowed' : ''}">
        Next
      </button>
    `;

    return buttons;
  }

  goToPage(page) {
    this.currentPage = page;
    this.loadProducts();
  }

  async editProduct(productId) {
    await this.showEditItemModal(productId);
  }

  async deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await window.api.deleteProduct(productId);
      this.showSuccessMessage('Product deleted successfully!');
      await this.loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      this.showError('Failed to delete product: ' + error.message);
    }
  }

  showLoadingState() {
    const tbody = document.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center">
            <div class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading products...
            </div>
          </td>
        </tr>
      `;
    }
  }

  hideLoadingState() {
    // Loading state is replaced by updateProductsTable
  }

  showLoginRequired() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.classList.remove('hidden');
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Product Modal Methods
  async showAddItemModal() {
    this.currentEditingProduct = null;
    this.resetProductForm();
    await this.loadCategoriesIntoSelect();
    
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    
    if (title) {
      title.textContent = 'Add New Product';
    }
    
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  async showEditItemModal(productId) {
    try {
      const product = await window.api.getProduct(productId);
      this.currentEditingProduct = product;
      this.populateProductForm(product);
      await this.loadCategoriesIntoSelect();
      
      const modal = document.getElementById('productModal');
      const title = document.getElementById('modalTitle');
      
      if (title) {
        title.textContent = 'Edit Product';
      }
      
      if (modal) {
        modal.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Failed to load product for editing:', error);
      this.showError('Failed to load product: ' + error.message);
    }
  }

  hideProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.resetProductForm();
    this.currentEditingProduct = null;
  }

  resetProductForm() {
    const form = document.getElementById('productForm');
    if (form) {
      form.reset();
    }
    
    // Clear any error messages
    this.clearFormErrors();
  }

  populateProductForm(product) {
    const fields = {
      productName: product.name,
      productSku: product.sku,
      productCategory: product.category_id,
      sellingPrice: product.selling_price,
      costPrice: product.cost_price,
      stockQuantity: product.stock_quantity,
      reorderPoint: product.reorder_point,
      productDescription: product.description
    };

    Object.keys(fields).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field && fields[fieldId] !== null && fields[fieldId] !== undefined) {
        field.value = fields[fieldId];
      }
    });
  }

  async loadCategoriesIntoSelect() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    try {
      // Clear existing options except the first one
      select.innerHTML = '<option value="">Select category...</option>';
      
      // Add categories
      this.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
      });
    } catch (error) {
      console.warn('Failed to load categories into select:', error);
    }
  }

  async saveProduct() {
    try {
      const form = document.getElementById('productForm');
      const formData = new FormData(form);
      
      // Show loading state
      const saveButton = document.getElementById('saveProduct');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      let response;
      if (this.currentEditingProduct) {
        // Update existing product
        response = await window.api.updateProduct(this.currentEditingProduct.id, formData);
      } else {
        // Create new product
        response = await window.api.createProduct(formData);
      }

      // Success
      this.hideProductModal();
      this.showSuccessMessage(
        this.currentEditingProduct ? 'Product updated successfully!' : 'Product created successfully!'
      );
      
      // Reload products list
      await this.loadProducts();

    } catch (error) {
      console.error('Failed to save product:', error);
      this.showFormError(error.message || 'Failed to save product');
    } finally {
      // Reset button state
      const saveButton = document.getElementById('saveProduct');
      saveButton.textContent = this.currentEditingProduct ? 'Update Product' : 'Save Product';
      saveButton.disabled = false;
    }
  }

  showFormError(message) {
    // Remove any existing error messages
    this.clearFormErrors();
    
    // Create and show error message at top of form
    const form = document.getElementById('productForm');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    errorDiv.textContent = message;
    
    form.insertBefore(errorDiv, form.firstChild);
  }

  clearFormErrors() {
    const existingErrors = document.querySelectorAll('.form-error');
    existingErrors.forEach(error => error.remove());
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.opacity = '0';
      setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }

  // Category Management Methods
  async showCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    if (modal) {
      modal.classList.remove('hidden');
      await this.loadCategoriesTable();
    }
  }

  hideCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.resetCategoryForm();
  }

  async loadCategoriesTable() {
    try {
      await this.loadCategories(); // Refresh categories data
      this.updateCategoriesTable();
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.showError('Failed to load categories: ' + error.message);
    }
  }

  updateCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (this.categories.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <div class="flex flex-col items-center">
              <i class="bi bi-tags text-4xl mb-2"></i>
              <p>No categories found</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.categories.map(category => `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
          ${this.escapeHtml(category.name)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${this.escapeHtml(category.description || 'No description')}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${category.product_count || 0} products
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Active
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="inventoryManager.editCategory(${category.id})" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-3" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button onclick="inventoryManager.deleteCategory(${category.id})" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-500" title="Delete" ${category.product_count > 0 ? 'disabled' : ''}>
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  async saveCategory() {
    try {
      const form = document.getElementById('categoryForm');
      const formData = new FormData(form);
      
      const categoryData = {
        name: formData.get('name'),
        description: formData.get('description')
      };

      // Show loading state
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton.innerHTML;
      submitButton.innerHTML = '<i class="bi bi-hourglass-split mr-2"></i> Saving...';
      submitButton.disabled = true;

      await window.api.createCategory(categoryData);

      // Success
      this.showSuccessMessage('Category created successfully!');
      this.resetCategoryForm();
      
      // Reload categories
      await this.loadCategories();
      this.updateCategoriesTable();

    } catch (error) {
      console.error('Failed to save category:', error);
      this.showFormError(error.message || 'Failed to save category');
    } finally {
      // Reset button state
      const submitButton = document.querySelector('#categoryForm button[type="submit"]');
      submitButton.innerHTML = '<i class="bi bi-plus-lg mr-2"></i> Add Category';
      submitButton.disabled = false;
    }
  }

  resetCategoryForm() {
    const form = document.getElementById('categoryForm');
    if (form) {
      form.reset();
    }
  }

  async editCategory(categoryId) {
    // Implementation for editing categories
    console.log('Edit category:', categoryId);
  }

  async deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      await window.api.deleteCategory(categoryId);
      this.showSuccessMessage('Category deleted successfully!');
      await this.loadCategories();
      this.updateCategoriesTable();
    } catch (error) {
      console.error('Failed to delete category:', error);
      this.showError('Failed to delete category: ' + error.message);
    }
  }
}

// Initialize inventory manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') === 'inventory') {
    window.inventoryManager = new InventoryManager();
  }
});