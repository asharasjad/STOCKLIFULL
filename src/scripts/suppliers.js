/**
 * Suppliers Management Script
 * Handles supplier listing, searching, filtering, and CRUD operations
 */

class SuppliersManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentSearch = '';
    this.currentStatus = '';
    this.isLoading = false;
    this.suppliers = [];
    this.currentEditingSupplier = null;
    
    this.init();
  }

  async init() {
    // Load initial data
    await this.loadSuppliers();
    
    // Set up event listeners
    this.setupEventListeners();
    this.setupModalEvents();
  }

  setupEventListeners() {
    // Search input
    const searchInput = document.querySelector('input[placeholder="Search suppliers..."]');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentSearch = e.target.value;
          this.currentPage = 1;
          this.loadSuppliers();
        }, 300);
      });
    }

    // Add new supplier button
    const addButton = document.querySelector('button[id="addNewSupplier"]');
    if (addButton) {
      addButton.addEventListener('click', () => this.showAddSupplierModal());
    }

    // Export button
    const exportButton = document.querySelector('button[data-action="export"]');
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportSuppliers());
    }

    // Filter button
    const filterButton = document.querySelector('button[data-action="filter"]');
    if (filterButton) {
      filterButton.addEventListener('click', () => this.showFilterModal());
    }
  }

  setupModalEvents() {
    const modal = document.getElementById('supplierModal');
    const closeButton = document.getElementById('closeSupplierModal');
    const cancelButton = document.getElementById('cancelSupplier');
    const form = document.getElementById('supplierForm');

    // Close modal events
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hideSupplierModal());
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.hideSupplierModal());
    }

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideSupplierModal();
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSupplier();
      });
    }
  }

  async loadSuppliers() {
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
        sort_by: 'company_name',
        sort_order: 'ASC'
      };

      if (this.currentStatus) {
        params.status = this.currentStatus;
      }

      // Fetch suppliers
      const response = await window.api.getSuppliers(params);
      this.suppliers = response.suppliers;
      
      // Update the table
      this.updateSuppliersTable(response.suppliers);
      this.updatePagination(response.pagination);

    } catch (error) {
      console.error('Failed to load suppliers:', error);
      this.showError('Failed to load suppliers: ' + error.message);
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  updateSuppliersTable(suppliers) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    if (suppliers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <div class="flex flex-col items-center">
              <i class="bi bi-truck text-4xl mb-2"></i>
              <p>No suppliers found</p>
              ${this.currentSearch ? '<p class="text-sm">Try adjusting your search terms</p>' : ''}
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = suppliers.map(supplier => `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
          SUP${String(supplier.id).padStart(3, '0')}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${this.escapeHtml(supplier.company_name)}</div>
          ${supplier.address ? `<div class="text-sm text-gray-500 dark:text-gray-400">${this.escapeHtml(supplier.city || '')}</div>` : ''}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${this.escapeHtml(supplier.contact_person)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          <a href="mailto:${this.escapeHtml(supplier.email)}" class="text-blue-600 hover:text-blue-900">
            ${this.escapeHtml(supplier.email)}
          </a>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
          ${supplier.phone ? `<a href="tel:${this.escapeHtml(supplier.phone)}" class="text-blue-600 hover:text-blue-900">${this.escapeHtml(supplier.phone)}</a>` : '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${this.getStatusBadge(supplier.status)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="suppliersManager.viewSupplier(${supplier.id})" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-3" title="View">
            <i class="bi bi-eye"></i>
          </button>
          <button onclick="suppliersManager.editSupplier(${supplier.id})" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-3" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button onclick="suppliersManager.deleteSupplier(${supplier.id})" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-500" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  getStatusBadge(status) {
    switch (status) {
      case 'active':
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</span>';
      case 'inactive':
        return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Inactive</span>';
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
              onclick="suppliersManager.goToPage(${current_page - 1})" 
              class="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${current_page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}">
        Previous
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);

    for (let i = startPage; i <= endPage; i++) {
      buttons += `
        <button onclick="suppliersManager.goToPage(${i})" 
                class="px-3 py-1 ${i === current_page ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'} rounded">
          ${i}
        </button>
      `;
    }

    // Next button
    buttons += `
      <button ${current_page >= total_pages ? 'disabled' : ''} 
              onclick="suppliersManager.goToPage(${current_page + 1})" 
              class="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${current_page >= total_pages ? 'opacity-50 cursor-not-allowed' : ''}">
        Next
      </button>
    `;

    return buttons;
  }

  goToPage(page) {
    this.currentPage = page;
    this.loadSuppliers();
  }

  async viewSupplier(supplierId) {
    try {
      const supplier = await window.api.getSupplier(supplierId);
      this.showSupplierDetails(supplier);
    } catch (error) {
      console.error('Failed to load supplier details:', error);
      this.showError('Failed to load supplier details: ' + error.message);
    }
  }

  async editSupplier(supplierId) {
    await this.showEditSupplierModal(supplierId);
  }

  async deleteSupplier(supplierId) {
    if (!confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
      return;
    }

    try {
      await window.api.deleteSupplier(supplierId);
      this.showSuccessMessage('Supplier deleted successfully!');
      await this.loadSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      this.showError('Failed to delete supplier: ' + error.message);
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
              Loading suppliers...
            </div>
          </td>
        </tr>
      `;
    }
  }

  hideLoadingState() {
    // Loading state is replaced by updateSuppliersTable
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Supplier Modal Methods (to be implemented)
  async showAddSupplierModal() {
    console.log('Show add supplier modal - to be implemented');
  }

  async showEditSupplierModal(supplierId) {
    console.log('Show edit supplier modal - to be implemented', supplierId);
  }

  hideSupplierModal() {
    console.log('Hide supplier modal - to be implemented');
  }

  async saveSupplier() {
    console.log('Save supplier - to be implemented');
  }

  showSupplierDetails(supplier) {
    console.log('Show supplier details - to be implemented', supplier);
  }

  exportSuppliers() {
    console.log('Export suppliers - to be implemented');
  }

  showFilterModal() {
    console.log('Show filter modal - to be implemented');
  }
}

// Initialize suppliers manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') === 'suppliers') {
    window.suppliersManager = new SuppliersManager();
  }
});