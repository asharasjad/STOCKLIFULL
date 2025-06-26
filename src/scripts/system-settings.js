/**
 * System Settings Management
 * Handles application configuration, company settings, and system preferences
 */

class SystemSettingsManager {
    constructor() {
        this.settings = {};
        this.currentSection = 'company';
        this.isDirty = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadSettings();
        this.renderCurrentSection();
    }

    setupEventListeners() {
        // Navigation tabs
        const tabs = document.querySelectorAll('[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(tab.dataset.tab);
            });
        });

        // Save button
        const saveBtn = document.querySelector('#saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Reset button
        const resetBtn = document.querySelector('#resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Form change detection
        document.addEventListener('input', (e) => {
            if (e.target.closest('#settingsForm')) {
                this.markDirty();
            }
        });

        // Backup/restore buttons
        const backupBtn = document.querySelector('#backupDatabase');
        const restoreBtn = document.querySelector('#restoreDatabase');
        
        if (backupBtn) {
            backupBtn.addEventListener('click', () => this.backupDatabase());
        }
        
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.showRestoreModal());
        }
    }

    async loadSettings() {
        try {
            const response = await window.api.request('GET', '/settings');
            if (response.success) {
                this.settings = response.data;
            } else {
                // Initialize with default settings if none exist
                this.settings = this.getDefaultSettings();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = this.getDefaultSettings();
            this.showNotification('Failed to load settings, using defaults', 'warning');
        }
    }

    getDefaultSettings() {
        return {
            company: {
                name: 'InventoryPro Business',
                address: '',
                city: '',
                postal_code: '',
                country: 'United Kingdom',
                phone: '',
                email: '',
                website: '',
                vat_number: '',
                registration_number: ''
            },
            business: {
                currency: 'GBP',
                currency_symbol: '£',
                tax_rate: 20.0,
                business_hours_start: '09:00',
                business_hours_end: '17:00',
                timezone: 'Europe/London',
                date_format: 'DD/MM/YYYY',
                fiscal_year_start: '04-01'
            },
            inventory: {
                auto_reorder: false,
                low_stock_threshold: 10,
                default_supplier_id: null,
                enable_barcode_scanning: true,
                track_expiry_dates: true,
                enable_batch_tracking: false
            },
            pos: {
                auto_print_receipts: true,
                allow_discounts: true,
                max_discount_percent: 20,
                require_manager_approval: true,
                enable_tips: false,
                default_payment_method: 'cash'
            },
            notifications: {
                email_alerts: true,
                low_stock_alerts: true,
                order_notifications: true,
                system_maintenance: true,
                backup_reminders: true
            },
            security: {
                session_timeout: 480, // 8 hours in minutes
                password_min_length: 8,
                require_strong_passwords: true,
                enable_two_factor: false,
                login_attempts_limit: 5,
                auto_logout_idle: true
            },
            backup: {
                auto_backup_enabled: true,
                backup_frequency: 'daily',
                backup_retention_days: 30,
                backup_location: 'local'
            }
        };
    }

    switchSection(section) {
        this.currentSection = section;
        
        // Update active tab
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.remove('bg-blue-600', 'text-white');
            tab.classList.add('text-gray-700', 'dark:text-gray-300');
        });
        
        const activeTab = document.querySelector(`[data-tab="${section}"]`);
        if (activeTab) {
            activeTab.classList.add('bg-blue-600', 'text-white');
            activeTab.classList.remove('text-gray-700', 'dark:text-gray-300');
        }

        this.renderCurrentSection();
    }

    renderCurrentSection() {
        const container = document.querySelector('#settingsContent');
        if (!container) return;

        let content = '';
        
        switch (this.currentSection) {
            case 'company':
                content = this.renderCompanySettings();
                break;
            case 'business':
                content = this.renderBusinessSettings();
                break;
            case 'inventory':
                content = this.renderInventorySettings();
                break;
            case 'pos':
                content = this.renderPOSSettings();
                break;
            case 'notifications':
                content = this.renderNotificationSettings();
                break;
            case 'security':
                content = this.renderSecuritySettings();
                break;
            case 'backup':
                content = this.renderBackupSettings();
                break;
            default:
                content = this.renderCompanySettings();
        }

        container.innerHTML = content;
        this.setupSectionEventListeners();
    }

    renderCompanySettings() {
        const company = this.settings.company || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Company Information</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Company Name *
                        </label>
                        <input type="text" name="company.name" value="${company.name || ''}" required
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Address
                        </label>
                        <input type="email" name="company.email" value="${company.email || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Phone Number
                        </label>
                        <input type="tel" name="company.phone" value="${company.phone || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Website
                        </label>
                        <input type="url" name="company.website" value="${company.website || ''}" placeholder="https://"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Address
                        </label>
                        <textarea name="company.address" rows="3"
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">${company.address || ''}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            City
                        </label>
                        <input type="text" name="company.city" value="${company.city || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Postal Code
                        </label>
                        <input type="text" name="company.postal_code" value="${company.postal_code || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            VAT Number
                        </label>
                        <input type="text" name="company.vat_number" value="${company.vat_number || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Registration Number
                        </label>
                        <input type="text" name="company.registration_number" value="${company.registration_number || ''}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                </div>
            </div>
        `;
    }

    renderBusinessSettings() {
        const business = this.settings.business || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Business Settings</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Currency
                        </label>
                        <select name="business.currency"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                            <option value="GBP" ${business.currency === 'GBP' ? 'selected' : ''}>British Pound (£)</option>
                            <option value="USD" ${business.currency === 'USD' ? 'selected' : ''}>US Dollar ($)</option>
                            <option value="EUR" ${business.currency === 'EUR' ? 'selected' : ''}>Euro (€)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Tax Rate (%)
                        </label>
                        <input type="number" name="business.tax_rate" value="${business.tax_rate || 20}" min="0" max="100" step="0.1"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Business Hours Start
                        </label>
                        <input type="time" name="business.business_hours_start" value="${business.business_hours_start || '09:00'}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Business Hours End
                        </label>
                        <input type="time" name="business.business_hours_end" value="${business.business_hours_end || '17:00'}"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Timezone
                        </label>
                        <select name="business.timezone"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                            <option value="Europe/London" ${business.timezone === 'Europe/London' ? 'selected' : ''}>London (GMT)</option>
                            <option value="America/New_York" ${business.timezone === 'America/New_York' ? 'selected' : ''}>New York (EST)</option>
                            <option value="America/Los_Angeles" ${business.timezone === 'America/Los_Angeles' ? 'selected' : ''}>Los Angeles (PST)</option>
                            <option value="Europe/Paris" ${business.timezone === 'Europe/Paris' ? 'selected' : ''}>Paris (CET)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Date Format
                        </label>
                        <select name="business.date_format"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                            <option value="DD/MM/YYYY" ${business.date_format === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY" ${business.date_format === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD" ${business.date_format === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    renderInventorySettings() {
        const inventory = this.settings.inventory || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Inventory Settings</h3>
                
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Reorder</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Automatically create purchase orders when stock is low</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="inventory.auto_reorder" ${inventory.auto_reorder ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Low Stock Threshold
                        </label>
                        <input type="number" name="inventory.low_stock_threshold" value="${inventory.low_stock_threshold || 10}" min="1"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Default threshold for low stock alerts</p>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Barcode Scanning</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Allow barcode scanning for products</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="inventory.enable_barcode_scanning" ${inventory.enable_barcode_scanning ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Track Expiry Dates</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Monitor product expiration dates</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="inventory.track_expiry_dates" ${inventory.track_expiry_dates ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    renderPOSSettings() {
        const pos = this.settings.pos || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Point of Sale Settings</h3>
                
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Print Receipts</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Automatically print receipts after transactions</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="pos.auto_print_receipts" ${pos.auto_print_receipts ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Allow Discounts</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Enable discount functionality</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="pos.allow_discounts" ${pos.allow_discounts ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Maximum Discount Percentage (%)
                        </label>
                        <input type="number" name="pos.max_discount_percent" value="${pos.max_discount_percent || 20}" min="0" max="100"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Payment Method
                        </label>
                        <select name="pos.default_payment_method"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                            <option value="cash" ${pos.default_payment_method === 'cash' ? 'selected' : ''}>Cash</option>
                            <option value="card" ${pos.default_payment_method === 'card' ? 'selected' : ''}>Card</option>
                            <option value="digital" ${pos.default_payment_method === 'digital' ? 'selected' : ''}>Digital Payment</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    renderBackupSettings() {
        const backup = this.settings.backup || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Backup & Restore</h3>
                
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Backup</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Automatically backup database</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="backup.auto_backup_enabled" ${backup.auto_backup_enabled ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Backup Frequency
                        </label>
                        <select name="backup.backup_frequency"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                            <option value="hourly" ${backup.backup_frequency === 'hourly' ? 'selected' : ''}>Hourly</option>
                            <option value="daily" ${backup.backup_frequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${backup.backup_frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Retention Period (Days)
                        </label>
                        <input type="number" name="backup.backup_retention_days" value="${backup.backup_retention_days || 30}" min="1"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h4 class="text-md font-medium text-gray-800 dark:text-gray-200 mb-4">Manual Backup & Restore</h4>
                        <div class="flex space-x-4">
                            <button id="backupDatabase" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                <i class="bi bi-download mr-2"></i>Create Backup
                            </button>
                            <button id="restoreDatabase" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                                <i class="bi bi-upload mr-2"></i>Restore Database
                            </button>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Create manual backups or restore from backup files
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    renderSecuritySettings() {
        const security = this.settings.security || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Security Settings</h3>
                
                <div class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Session Timeout (minutes)
                        </label>
                        <input type="number" name="security.session_timeout" value="${security.session_timeout || 480}" min="30"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Password Length
                        </label>
                        <input type="number" name="security.password_min_length" value="${security.password_min_length || 8}" min="6" max="32"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Login Attempts Limit
                        </label>
                        <input type="number" name="security.login_attempts_limit" value="${security.login_attempts_limit || 5}" min="3" max="10"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Require Strong Passwords</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Require uppercase, lowercase, numbers, and symbols</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="security.require_strong_passwords" ${security.require_strong_passwords ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Logout on Idle</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Automatically logout users after inactivity</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="security.auto_logout_idle" ${security.auto_logout_idle ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    renderNotificationSettings() {
        const notifications = this.settings.notifications || {};
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Notification Preferences</h3>
                
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Email Alerts</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="notifications.email_alerts" ${notifications.email_alerts ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Low Stock Alerts</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Get notified when products are running low</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="notifications.low_stock_alerts" ${notifications.low_stock_alerts ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Order Notifications</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Receive updates about purchase orders</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="notifications.order_notifications" ${notifications.order_notifications ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">System Maintenance</label>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Get notified about system updates and maintenance</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="notifications.system_maintenance" ${notifications.system_maintenance ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    setupSectionEventListeners() {
        // Re-attach specific event listeners for current section
        const backupBtn = document.querySelector('#backupDatabase');
        const restoreBtn = document.querySelector('#restoreDatabase');
        
        if (backupBtn) {
            backupBtn.addEventListener('click', () => this.backupDatabase());
        }
        
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.showRestoreModal());
        }
    }

    markDirty() {
        this.isDirty = true;
        const saveBtn = document.querySelector('#saveSettings');
        if (saveBtn) {
            saveBtn.classList.remove('bg-gray-400');
            saveBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            saveBtn.disabled = false;
        }
    }

    async saveSettings() {
        const form = document.querySelector('#settingsForm');
        if (!form) return;

        const formData = new FormData(form);
        const settings = {};

        // Parse form data into nested object structure
        for (const [key, value] of formData.entries()) {
            const keys = key.split('.');
            let current = settings;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            const finalKey = keys[keys.length - 1];
            
            // Handle different input types
            if (value === 'on') {
                current[finalKey] = true;
            } else if (value === 'off' || value === '') {
                current[finalKey] = false;
            } else if (!isNaN(value) && value !== '') {
                current[finalKey] = parseFloat(value);
            } else {
                current[finalKey] = value;
            }
        }

        // Handle checkboxes that aren't checked (they don't appear in FormData)
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                const keys = checkbox.name.split('.');
                let current = settings;
                
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!current[keys[i]]) {
                        current[keys[i]] = {};
                    }
                    current = current[keys[i]];
                }
                
                current[keys[keys.length - 1]] = false;
            }
        });

        try {
            const response = await window.api.request('PUT', '/settings', settings);
            
            if (response.success) {
                this.settings = { ...this.settings, ...settings };
                this.isDirty = false;
                
                const saveBtn = document.querySelector('#saveSettings');
                if (saveBtn) {
                    saveBtn.classList.add('bg-gray-400');
                    saveBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    saveBtn.disabled = true;
                }
                
                this.showNotification('Settings saved successfully', 'success');
            } else {
                throw new Error(response.message || 'Failed to save settings');
            }
            
        } catch (error) {
            console.error('Save settings error:', error);
            this.showNotification('Failed to save settings: ' + error.message, 'error');
        }
    }

    resetSettings() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            return;
        }

        this.settings = this.getDefaultSettings();
        this.renderCurrentSection();
        this.markDirty();
        
        this.showNotification('Settings reset to defaults', 'info');
    }

    async backupDatabase() {
        try {
            const response = await window.api.request('POST', '/settings/backup');
            
            if (response.success) {
                // Trigger download
                const link = document.createElement('a');
                link.href = response.data.download_url;
                link.download = response.data.filename;
                link.click();
                
                this.showNotification('Database backup created successfully', 'success');
            } else {
                throw new Error(response.message || 'Failed to create backup');
            }
            
        } catch (error) {
            console.error('Backup error:', error);
            this.showNotification('Failed to create backup: ' + error.message, 'error');
        }
    }

    showRestoreModal() {
        const modal = document.createElement('div');
        modal.id = 'restoreModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96">
                <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Restore Database</h3>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Backup File
                    </label>
                    <input type="file" id="backupFile" accept=".sql,.db,.sqlite" 
                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                </div>
                
                <div class="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md p-4 mb-4">
                    <p class="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>Warning:</strong> This will replace all current data. Make sure you have a backup of your current database.
                    </p>
                </div>
                
                <div class="flex justify-end space-x-4">
                    <button id="cancelRestore" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        Cancel
                    </button>
                    <button id="confirmRestore" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        Restore Database
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        modal.querySelector('#cancelRestore').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('#confirmRestore').addEventListener('click', async () => {
            const fileInput = modal.querySelector('#backupFile');
            if (!fileInput.files[0]) {
                this.showNotification('Please select a backup file', 'error');
                return;
            }
            
            await this.restoreDatabase(fileInput.files[0]);
            modal.remove();
        });
    }

    async restoreDatabase(file) {
        try {
            const formData = new FormData();
            formData.append('backup', file);
            
            const response = await fetch(`${window.api.getBaseURL()}/api/settings/restore`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Database restored successfully', 'success');
                
                // Reload the page after successful restore
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                throw new Error(result.message || 'Failed to restore database');
            }
            
        } catch (error) {
            console.error('Restore error:', error);
            this.showNotification('Failed to restore database: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize System Settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'system-settings') {
        window.systemSettings = new SystemSettingsManager();
    }
});