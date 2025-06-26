/**
 * POS (Point of Sale) System JavaScript
 * Handles product menu, shopping cart, and transaction processing
 */

class POSSystem {
    constructor() {
        this.cart = [];
        this.currentCategory = null;
        this.menuData = {};
        this.paymentMethods = [];
        this.taxRate = 0.20; // 20% VAT
        
        this.init();
    }

    async init() {
        await this.loadPaymentMethods();
        await this.loadMenu();
        this.setupEventListeners();
        this.updateCartDisplay();
    }

    async loadMenu() {
        try {
            const response = await window.api.request('GET', '/pos/menu');
            if (response.success) {
                this.menuData = response.data.menu;
                this.renderCategories();
                if (this.menuData.length > 0) {
                    this.selectCategory(this.menuData[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load menu:', error);
            this.showError('Failed to load menu items');
        }
    }

    async loadPaymentMethods() {
        try {
            const response = await window.api.request('GET', '/pos/payment-methods');
            if (response.success) {
                this.paymentMethods = response.data.payment_methods;
                this.renderPaymentMethods();
            }
        } catch (error) {
            console.error('Failed to load payment methods:', error);
        }
    }

    renderCategories() {
        const categoryNav = document.querySelector('#categoryNav');
        if (!categoryNav) return;

        categoryNav.innerHTML = this.menuData.map(category => `
            <a href="#" 
               class="block text-gray-700 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 category-item" 
               data-category-id="${category.id}">
                <i class="bi bi-tag-fill mr-2"></i> ${category.name}
                <span class="text-xs text-gray-500 ml-2">(${category.item_count})</span>
            </a>
        `).join('');
    }

    selectCategory(categoryId) {
        this.currentCategory = categoryId;
        
        // Update active category styling
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-800', 'dark:text-blue-200');
        });
        
        const activeCategory = document.querySelector(`[data-category-id="${categoryId}"]`);
        if (activeCategory) {
            activeCategory.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-800', 'dark:text-blue-200');
        }

        this.renderProducts();
    }

    renderProducts() {
        const productGrid = document.querySelector('#productGrid');
        if (!productGrid) return;

        const category = this.menuData.find(cat => cat.id === this.currentCategory);
        if (!category) return;

        productGrid.innerHTML = category.items.map(product => `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 overflow-hidden">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover">` :
                        `<div class="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <i class="bi bi-image text-3xl"></i>
                        </div>`
                    }
                </div>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">${product.name}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">${product.description || 'No description available'}</p>
                <div class="flex justify-between items-center mb-4">
                    <p class="text-lg font-bold text-gray-800 dark:text-gray-200">£${parseFloat(product.selling_price).toFixed(2)}</p>
                    <span class="text-xs text-gray-500 dark:text-gray-400">Stock: ${product.stock_quantity}</span>
                </div>
                <button 
                    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full transition-colors ${product.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                    onclick="pos.addToCart(${product.id}, '${product.name}', ${product.selling_price}, ${product.stock_quantity})"
                    ${product.stock_quantity <= 0 ? 'disabled' : ''}>
                    ${product.stock_quantity <= 0 ? 'Out of Stock' : 'Add to Order'}
                </button>
            </div>
        `).join('');
    }

    addToCart(productId, name, price, stockQuantity) {
        const existingItem = this.cart.find(item => item.productId === productId);
        
        if (existingItem) {
            if (existingItem.quantity >= stockQuantity) {
                this.showError('Cannot add more items than available in stock');
                return;
            }
            existingItem.quantity += 1;
            existingItem.total = existingItem.quantity * existingItem.price;
        } else {
            this.cart.push({
                productId,
                name,
                price: parseFloat(price),
                quantity: 1,
                total: parseFloat(price)
            });
        }
        
        this.updateCartDisplay();
        this.showSuccess(`${name} added to cart`);
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.productId !== productId);
        this.updateCartDisplay();
    }

    updateQuantity(productId, newQuantity) {
        const item = this.cart.find(item => item.productId === productId);
        if (item) {
            if (newQuantity <= 0) {
                this.removeFromCart(productId);
            } else {
                item.quantity = newQuantity;
                item.total = item.quantity * item.price;
                this.updateCartDisplay();
            }
        }
    }

    updateCartDisplay() {
        const cartItems = document.querySelector('#cartItems');
        const subtotalElement = document.querySelector('#subtotal');
        const taxElement = document.querySelector('#taxAmount');
        const totalElement = document.querySelector('#totalAmount');
        const cartCount = document.querySelector('#cartCount');

        if (!cartItems) return;

        // Calculate totals
        const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
        const taxAmount = subtotal * this.taxRate;
        const total = subtotal + taxAmount;

        // Update cart items display
        cartItems.innerHTML = this.cart.length === 0 ? 
            '<li class="text-center text-gray-500 dark:text-gray-400 py-8">Cart is empty</li>' :
            this.cart.map(item => `
                <li class="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex-1">
                        <p class="text-gray-800 dark:text-gray-200 font-medium">${item.name}</p>
                        <div class="flex items-center mt-1">
                            <button 
                                onclick="pos.updateQuantity(${item.productId}, ${item.quantity - 1})"
                                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <i class="bi bi-dash-circle"></i>
                            </button>
                            <span class="mx-2 text-sm text-gray-600 dark:text-gray-400">Qty: ${item.quantity}</span>
                            <button 
                                onclick="pos.updateQuantity(${item.productId}, ${item.quantity + 1})"
                                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <i class="bi bi-plus-circle"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-800 dark:text-gray-200 font-medium">£${item.total.toFixed(2)}</p>
                        <button 
                            onclick="pos.removeFromCart(${item.productId})"
                            class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-500 text-sm">
                            Remove
                        </button>
                    </div>
                </li>
            `).join('');

        // Update totals
        if (subtotalElement) subtotalElement.textContent = `£${subtotal.toFixed(2)}`;
        if (taxElement) taxElement.textContent = `£${taxAmount.toFixed(2)}`;
        if (totalElement) totalElement.textContent = `£${total.toFixed(2)}`;
        if (cartCount) cartCount.textContent = this.cart.length;

        // Enable/disable complete order button
        const completeOrderBtn = document.querySelector('#completeOrderBtn');
        if (completeOrderBtn) {
            completeOrderBtn.disabled = this.cart.length === 0;
            completeOrderBtn.classList.toggle('opacity-50', this.cart.length === 0);
            completeOrderBtn.classList.toggle('cursor-not-allowed', this.cart.length === 0);
        }
    }

    renderPaymentMethods() {
        const paymentMethodsContainer = document.querySelector('#paymentMethods');
        if (!paymentMethodsContainer) return;

        paymentMethodsContainer.innerHTML = this.paymentMethods.map(method => `
            <label class="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input type="radio" name="paymentMethod" value="${method.id}" class="mr-3">
                <div>
                    <p class="font-medium text-gray-800 dark:text-gray-200">${method.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${method.type}</p>
                </div>
            </label>
        `).join('');
    }

    async completeOrder() {
        if (this.cart.length === 0) {
            this.showError('Cart is empty');
            return;
        }

        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedPaymentMethod) {
            this.showError('Please select a payment method');
            return;
        }

        const customerName = document.querySelector('#customerName')?.value || null;
        const customerEmail = document.querySelector('#customerEmail')?.value || null;
        const customerPhone = document.querySelector('#customerPhone')?.value || null;
        const amountPaid = parseFloat(document.querySelector('#amountPaid')?.value || 0);

        const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
        const taxAmount = subtotal * this.taxRate;
        const total = subtotal + taxAmount;

        if (amountPaid < total) {
            this.showError('Amount paid is insufficient');
            return;
        }

        try {
            this.showLoading(true);

            const transactionData = {
                items: this.cart.map(item => ({
                    product_id: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                payment_method_id: parseInt(selectedPaymentMethod.value),
                amount_paid: amountPaid
            };

            const response = await window.api.request('POST', '/pos/transaction', transactionData);
            
            if (response.success) {
                this.showSuccess('Transaction completed successfully!');
                this.generateReceipt(response.data.transaction);
                this.clearCart();
                this.clearCustomerForm();
            } else {
                this.showError(response.message || 'Transaction failed');
            }
        } catch (error) {
            console.error('Transaction error:', error);
            this.showError('Transaction failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    generateReceipt(transaction) {
        const receiptData = {
            transactionNumber: transaction.transaction_number,
            items: transaction.items,
            subtotal: transaction.subtotal,
            taxAmount: transaction.tax_amount,
            total: transaction.total_amount,
            amountPaid: transaction.amount_paid,
            change: transaction.change_given,
            timestamp: new Date(transaction.created_at).toLocaleString()
        };

        // Open receipt in new window
        const receiptWindow = window.open('', '_blank', 'width=400,height=600');
        receiptWindow.document.write(this.generateReceiptHTML(receiptData));
        receiptWindow.document.close();
        receiptWindow.print();
    }

    generateReceiptHTML(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${data.transactionNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 350px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .item { display: flex; justify-content: space-between; margin: 5px 0; }
                    .total { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; font-weight: bold; }
                    .center { text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>InventoryPro</h2>
                    <p>Transaction: ${data.transactionNumber}</p>
                    <p>${data.timestamp}</p>
                </div>
                <div class="items">
                    ${data.items.map(item => `
                        <div class="item">
                            <span>${item.item_name} x${item.quantity}</span>
                            <span>£${item.total_price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="total">
                    <div class="item">
                        <span>Subtotal:</span>
                        <span>£${data.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="item">
                        <span>Tax (20%):</span>
                        <span>£${data.taxAmount.toFixed(2)}</span>
                    </div>
                    <div class="item">
                        <span><strong>Total:</strong></span>
                        <span><strong>£${data.total.toFixed(2)}</strong></span>
                    </div>
                    <div class="item">
                        <span>Paid:</span>
                        <span>£${data.amountPaid.toFixed(2)}</span>
                    </div>
                    <div class="item">
                        <span>Change:</span>
                        <span>£${data.change.toFixed(2)}</span>
                    </div>
                </div>
                <div class="center" style="margin-top: 20px;">
                    <p>Thank you for your business!</p>
                </div>
            </body>
            </html>
        `;
    }

    clearCart() {
        this.cart = [];
        this.updateCartDisplay();
    }

    clearCustomerForm() {
        const customerName = document.querySelector('#customerName');
        const customerEmail = document.querySelector('#customerEmail');
        const customerPhone = document.querySelector('#customerPhone');
        const amountPaid = document.querySelector('#amountPaid');

        if (customerName) customerName.value = '';
        if (customerEmail) customerEmail.value = '';
        if (customerPhone) customerPhone.value = '';
        if (amountPaid) amountPaid.value = '';

        // Clear payment method selection
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(method => method.checked = false);
    }

    setupEventListeners() {
        // Category navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.category-item')) {
                e.preventDefault();
                const categoryId = parseInt(e.target.closest('.category-item').dataset.categoryId);
                this.selectCategory(categoryId);
            }
        });

        // Complete order button
        const completeOrderBtn = document.querySelector('#completeOrderBtn');
        if (completeOrderBtn) {
            completeOrderBtn.addEventListener('click', () => this.completeOrder());
        }

        // Clear cart button
        const clearCartBtn = document.querySelector('#clearCartBtn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the cart?')) {
                    this.clearCart();
                }
            });
        }

        // Auto-calculate change
        const amountPaidInput = document.querySelector('#amountPaid');
        if (amountPaidInput) {
            amountPaidInput.addEventListener('input', () => {
                const amountPaid = parseFloat(amountPaidInput.value) || 0;
                const total = this.cart.reduce((sum, item) => sum + item.total, 0) * (1 + this.taxRate);
                const change = Math.max(0, amountPaid - total);
                
                const changeElement = document.querySelector('#changeAmount');
                if (changeElement) {
                    changeElement.textContent = `£${change.toFixed(2)}`;
                }
            });
        }
    }

    showLoading(show) {
        const loadingElement = document.querySelector('#loadingOverlay');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize POS system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'pos') {
        window.pos = new POSSystem();
    }
});