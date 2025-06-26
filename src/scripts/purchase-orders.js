/**
 * Purchase Orders Management System
 * Handles purchase order creation, editing, and approval workflow
 */

class PurchaseOrderSystem {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.orders = [];
        this.suppliers = [];
        this.products = [];
        this.currentOrder = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.renderOrders();
    }

    setupEventListeners() {
        // New Purchase Order button
        const newOrderBtn = document.querySelector('.bg-blue-600');
        if (newOrderBtn && newOrderBtn.textContent.includes('New Purchase Order')) {
            newOrderBtn.addEventListener('click', () => this.showCreateOrderModal());
        }

        // Search functionality
        const searchInput = document.querySelector('input[placeholder*="Search orders"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filter button
        const filterBtn = document.querySelector('button[title="Filter"], .bg-gray-200:has(.bi-funnel-fill)');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterModal());
        }

        // Export button
        const exportBtn = document.querySelector('.bg-gray-200:has(.bi-box-arrow-up)');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportOrders());
        }

        // Table action handlers will be set up when rendering
    }

    async loadInitialData() {
        try {
            // Load purchase orders
            const ordersResponse = await window.api.request('GET', '/inventory/purchase-orders');
            if (ordersResponse.success) {
                this.orders = ordersResponse.data.orders || [];
            }

            // Load suppliers
            const suppliersResponse = await window.api.request('GET', '/inventory/suppliers');
            if (suppliersResponse.success) {
                this.suppliers = suppliersResponse.data.suppliers || [];
            }

            // Load products
            const productsResponse = await window.api.request('GET', '/inventory/products?limit=100');
            if (productsResponse.success) {
                this.products = productsResponse.data.products || [];
            }

        } catch (error) {
            console.error('Failed to load purchase orders data:', error);
            this.showNotification('Failed to load data', 'error');
        }
    }

    renderOrders() {
        const tbody = document.querySelector('tbody');
        if (!tbody) return;

        if (this.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        <i class="bi bi-cart-x text-3xl mb-2 block"></i>
                        <p>No purchase orders found</p>
                        <button class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onclick="window.purchaseOrderSystem.showCreateOrderModal()">
                            Create First Purchase Order
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.orders.map(order => this.renderOrderRow(order)).join('');
        this.attachRowEventListeners();
    }

    renderOrderRow(order) {
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            'approved': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            'sent': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
            'delivered': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
        };

        return `
            <tr data-order-id="${order.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 font-medium">
                    ${order.po_number}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${order.supplier_name || 'Unknown Supplier'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${new Date(order.order_date).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'TBD'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-medium">
                    £${(order.total_amount || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[order.status] || statusColors.pending}">
                        ${order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-4" 
                            data-action="view" data-order-id="${order.id}" title="View">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-4" 
                            data-action="edit" data-order-id="${order.id}" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-500 mr-4" 
                            data-action="print" data-order-id="${order.id}" title="Print">
                        <i class="bi bi-printer"></i>
                    </button>
                    ${order.status === 'pending' ? `
                        <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-500" 
                                data-action="cancel" data-order-id="${order.id}" title="Cancel">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    attachRowEventListeners() {
        const actionButtons = document.querySelectorAll('button[data-action]');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                const orderId = parseInt(button.dataset.orderId);
                this.handleOrderAction(action, orderId);
            });
        });
    }

    async handleOrderAction(action, orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        switch (action) {
            case 'view':
                this.showOrderDetails(order);
                break;
            case 'edit':
                this.showEditOrderModal(order);
                break;
            case 'print':
                await this.printOrder(order);
                break;
            case 'cancel':
                await this.cancelOrder(orderId);
                break;
        }
    }

    showCreateOrderModal() {
        const modal = this.createOrderModal();
        document.body.appendChild(modal);
        
        // Initialize form
        this.setupOrderForm();
    }

    showEditOrderModal(order) {
        this.currentOrder = order;
        const modal = this.createOrderModal(order);
        document.body.appendChild(modal);
        
        // Initialize form with order data
        this.setupOrderForm(order);
    }

    createOrderModal(order = null) {
        const isEdit = order !== null;
        
        const modal = document.createElement('div');
        modal.id = 'orderModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">
                        ${isEdit ? 'Edit Purchase Order' : 'Create New Purchase Order'}
                    </h2>
                    <button id="closeOrderModal" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        <i class="bi bi-x-lg text-xl"></i>
                    </button>
                </div>
                
                <form id="orderForm" class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label for="supplier_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Supplier *
                            </label>
                            <select id="supplier_id" required 
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                                <option value="">Select Supplier</option>
                                ${this.suppliers.map(supplier => `
                                    <option value="${supplier.id}" ${order && order.supplier_id === supplier.id ? 'selected' : ''}>
                                        ${supplier.company_name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label for="expected_delivery" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Expected Delivery Date
                            </label>
                            <input type="date" id="expected_delivery" 
                                   value="${order ? order.expected_delivery?.split('T')[0] || '' : ''}"
                                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                        </div>
                        
                        <div class="md:col-span-2">
                            <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Notes
                            </label>
                            <textarea id="notes" rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                      placeholder="Additional notes or instructions...">${order ? order.notes || '' : ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- Order Items Section -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Order Items</h3>
                            <button type="button" id="addOrderItem" 
                                    class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                <i class="bi bi-plus mr-2"></i>Add Item
                            </button>
                        </div>
                        
                        <div class="overflow-x-auto">
                            <table class="min-w-full border border-gray-300 dark:border-gray-600">
                                <thead class="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Quantity</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Unit Price</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                                        <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="orderItemsTable" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    <!-- Order items will be added dynamically -->
                                </tbody>
                                <tfoot class="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <td colspan="3" class="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                            Total Amount:
                                        </td>
                                        <td class="px-4 py-2 font-bold text-lg text-gray-800 dark:text-gray-200">
                                            £<span id="totalAmount">0.00</span>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                    <div class="flex justify-end space-x-4">
                        <button type="button" id="cancelOrderForm" 
                                class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" 
                                class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            ${isEdit ? 'Update Order' : 'Create Order'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        return modal;
    }

    setupOrderForm(order = null) {
        const modal = document.getElementById('orderModal');
        
        // Close modal handlers
        const closeBtn = modal.querySelector('#closeOrderModal');
        const cancelBtn = modal.querySelector('#cancelOrderForm');
        
        [closeBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                this.currentOrder = null;
            });
        });
        
        // Add item button
        const addItemBtn = modal.querySelector('#addOrderItem');
        addItemBtn.addEventListener('click', () => this.addOrderItemRow());
        
        // Form submission
        const form = modal.querySelector('#orderForm');
        form.addEventListener('submit', (e) => this.handleOrderSubmit(e));
        
        // If editing, load existing items
        if (order && order.items) {
            order.items.forEach(item => this.addOrderItemRow(item));
        } else {
            // Add one empty row for new orders
            this.addOrderItemRow();
        }
        
        this.updateTotalAmount();
    }

    addOrderItemRow(item = null) {
        const tbody = document.querySelector('#orderItemsTable');
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="px-4 py-2">
                <select class="item-product w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200" required>
                    <option value="">Select Product</option>
                    ${this.products.map(product => `
                        <option value="${product.id}" data-price="${product.cost_price}" ${item && item.product_id === product.id ? 'selected' : ''}>
                            ${product.name} (${product.sku})
                        </option>
                    `).join('')}
                </select>
            </td>
            <td class="px-4 py-2">
                <input type="number" class="item-quantity w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200" 
                       min="1" step="1" value="${item ? item.quantity : 1}" required>
            </td>
            <td class="px-4 py-2">
                <input type="number" class="item-price w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200" 
                       min="0" step="0.01" value="${item ? item.unit_price : 0}" required>
            </td>
            <td class="px-4 py-2">
                <span class="item-total font-medium">£0.00</span>
            </td>
            <td class="px-4 py-2 text-center">
                <button type="button" class="remove-item text-red-600 hover:text-red-800">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Add event listeners
        const productSelect = row.querySelector('.item-product');
        const quantityInput = row.querySelector('.item-quantity');
        const priceInput = row.querySelector('.item-price');
        const removeBtn = row.querySelector('.remove-item');
        
        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            if (selectedOption && selectedOption.dataset.price) {
                priceInput.value = parseFloat(selectedOption.dataset.price).toFixed(2);
                this.updateRowTotal(row);
            }
        });
        
        [quantityInput, priceInput].forEach(input => {
            input.addEventListener('input', () => this.updateRowTotal(row));
        });
        
        removeBtn.addEventListener('click', () => {
            row.remove();
            this.updateTotalAmount();
        });
        
        // Initialize row total
        this.updateRowTotal(row);
    }

    updateRowTotal(row) {
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const total = quantity * price;
        
        row.querySelector('.item-total').textContent = `£${total.toFixed(2)}`;
        this.updateTotalAmount();
    }

    updateTotalAmount() {
        const rows = document.querySelectorAll('#orderItemsTable tr');
        let total = 0;
        
        rows.forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity')?.value) || 0;
            const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
            total += quantity * price;
        });
        
        const totalElement = document.querySelector('#totalAmount');
        if (totalElement) {
            totalElement.textContent = total.toFixed(2);
        }
    }

    async handleOrderSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const supplierId = document.querySelector('#supplier_id').value;
        const expectedDelivery = document.querySelector('#expected_delivery').value;
        const notes = document.querySelector('#notes').value;
        
        // Collect order items
        const items = [];
        const rows = document.querySelectorAll('#orderItemsTable tr');
        
        for (const row of rows) {
            const productId = row.querySelector('.item-product')?.value;
            const quantity = row.querySelector('.item-quantity')?.value;
            const unitPrice = row.querySelector('.item-price')?.value;
            
            if (productId && quantity && unitPrice) {
                items.push({
                    product_id: parseInt(productId),
                    quantity: parseInt(quantity),
                    unit_price: parseFloat(unitPrice)
                });
            }
        }
        
        if (items.length === 0) {
            this.showNotification('Please add at least one item to the order', 'error');
            return;
        }
        
        const orderData = {
            supplier_id: parseInt(supplierId),
            expected_delivery: expectedDelivery || null,
            notes: notes || null,
            items
        };
        
        try {
            let response;
            if (this.currentOrder) {
                // Update existing order
                response = await window.api.request('PUT', `/inventory/purchase-orders/${this.currentOrder.id}`, orderData);
            } else {
                // Create new order
                response = await window.api.request('POST', '/inventory/purchase-orders', orderData);
            }
            
            if (response.success) {
                this.showNotification(
                    this.currentOrder ? 'Purchase order updated successfully' : 'Purchase order created successfully', 
                    'success'
                );
                
                // Close modal and refresh data
                document.getElementById('orderModal').remove();
                this.currentOrder = null;
                await this.loadInitialData();
                this.renderOrders();
            } else {
                throw new Error(response.message || 'Failed to save purchase order');
            }
            
        } catch (error) {
            console.error('Order submission error:', error);
            this.showNotification('Failed to save purchase order: ' + error.message, 'error');
        }
    }

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this purchase order?')) {
            return;
        }
        
        try {
            const response = await window.api.request('PATCH', `/inventory/purchase-orders/${orderId}`, {
                status: 'cancelled'
            });
            
            if (response.success) {
                this.showNotification('Purchase order cancelled successfully', 'success');
                await this.loadInitialData();
                this.renderOrders();
            } else {
                throw new Error(response.message || 'Failed to cancel order');
            }
            
        } catch (error) {
            console.error('Cancel order error:', error);
            this.showNotification('Failed to cancel order: ' + error.message, 'error');
        }
    }

    showOrderDetails(order) {
        // Implementation for showing order details in a modal
        console.log('Show order details:', order);
        this.showNotification('Order details view not implemented yet', 'info');
    }

    async printOrder(order) {
        try {
            const response = await window.api.request('GET', `/inventory/purchase-orders/${order.id}/print`);
            if (response.success) {
                // Open print dialog or download PDF
                window.open(response.data.print_url, '_blank');
            }
        } catch (error) {
            console.error('Print order error:', error);
            this.showNotification('Failed to print order', 'error');
        }
    }

    handleSearch(query) {
        // Filter orders based on search query
        console.log('Search orders:', query);
        // Implementation for search functionality
    }

    showFilterModal() {
        this.showNotification('Filter functionality not implemented yet', 'info');
    }

    async exportOrders() {
        try {
            const response = await window.api.request('GET', '/inventory/purchase-orders/export');
            if (response.success) {
                // Trigger download
                const link = document.createElement('a');
                link.href = response.data.download_url;
                link.download = response.data.filename;
                link.click();
                
                this.showNotification('Orders exported successfully', 'success');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export orders', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize Purchase Order System when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'purchase-orders') {
        window.purchaseOrderSystem = new PurchaseOrderSystem();
    }
});