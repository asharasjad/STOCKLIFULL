/**
 * Staff Management System JavaScript
 * Handles employee management, scheduling, and time tracking
 */

class StaffManagementSystem {
    constructor() {
        this.employees = [];
        this.schedules = [];
        this.currentEmployee = null;
        this.currentWeek = this.getCurrentWeek();
        
        this.init();
    }

    async init() {
        await this.loadEmployees();
        await this.loadSchedules();
        this.updateDashboard();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    async loadEmployees() {
        try {
            const response = await window.api.request('GET', '/staff/employees');
            if (response.success) {
                this.employees = response.data.employees;
                this.renderEmployeesList();
                this.updateEmployeeStats();
            }
        } catch (error) {
            console.error('Failed to load employees:', error);
            this.showError('Failed to load employees');
        }
    }

    async loadSchedules() {
        try {
            const startDate = this.currentWeek.start.toISOString().split('T')[0];
            const endDate = this.currentWeek.end.toISOString().split('T')[0];
            
            const response = await window.api.request('GET', `/staff/schedules?start_date=${startDate}&end_date=${endDate}`);
            if (response.success) {
                this.schedules = response.data.schedules;
                this.renderScheduleTable();
                this.updateScheduleStats();
            }
        } catch (error) {
            console.error('Failed to load schedules:', error);
            this.showError('Failed to load schedules');
        }
    }

    updateDashboard() {
        this.updateEmployeeStats();
        this.updateScheduleStats();
        this.renderActiveEmployees();
    }

    updateEmployeeStats() {
        const activeEmployees = this.employees.filter(emp => emp.status === 'active');
        const totalEmployees = this.employees.length;
        
        // Update dashboard cards
        const activeCountElement = document.querySelector('#activeEmployeesCount');
        const totalCountElement = document.querySelector('#totalEmployeesCount');
        
        if (activeCountElement) activeCountElement.textContent = activeEmployees.length;
        if (totalCountElement) totalCountElement.textContent = totalEmployees;
    }

    updateScheduleStats() {
        const thisWeekSchedules = this.schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.schedule_date);
            return scheduleDate >= this.currentWeek.start && scheduleDate <= this.currentWeek.end;
        });

        const totalShifts = thisWeekSchedules.length;
        const totalHours = thisWeekSchedules.reduce((sum, schedule) => sum + (schedule.scheduled_hours || 0), 0);

        // Update dashboard cards
        const totalShiftsElement = document.querySelector('#totalShifts');
        const totalHoursElement = document.querySelector('#totalHours');
        
        if (totalShiftsElement) totalShiftsElement.textContent = totalShifts;
        if (totalHoursElement) totalHoursElement.textContent = totalHours.toFixed(1);
    }

    renderEmployeesList() {
        const employeesList = document.querySelector('#employeesList');
        if (!employeesList) return;

        if (this.employees.length === 0) {
            employeesList.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="bi bi-people text-3xl mb-2 block"></i>
                    <p>No employees found</p>
                </div>
            `;
            return;
        }

        employeesList.innerHTML = this.employees.map(employee => `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <img src="../../images/anonomous-profile-logo.png" alt="Employee Avatar" class="w-10 h-10 rounded-full">
                        <div>
                            <h4 class="font-medium text-gray-800 dark:text-gray-200">${employee.first_name} ${employee.last_name}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${employee.position}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">ID: ${employee.employee_number}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                            employee.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                            employee.status === 'inactive' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }">
                            ${employee.status}
                        </span>
                        <div class="mt-2">
                            <button onclick="staffManagement.showEmployeeDetails(${employee.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm mr-2">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button onclick="staffManagement.editEmployee(${employee.id})" class="text-green-600 hover:text-green-800 dark:text-green-400 text-sm mr-2">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button onclick="staffManagement.clockInOut(${employee.id})" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 text-sm">
                                <i class="bi bi-clock"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderActiveEmployees() {
        const activeEmployeesList = document.querySelector('#activeEmployeesList');
        if (!activeEmployeesList) return;

        const activeEmployees = this.employees.filter(emp => emp.status === 'active');

        if (activeEmployees.length === 0) {
            activeEmployeesList.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                    <p>No active employees</p>
                </div>
            `;
            return;
        }

        activeEmployeesList.innerHTML = activeEmployees.slice(0, 5).map(employee => `
            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div class="flex items-center space-x-2">
                    <img src="../../images/anonomous-profile-logo.png" alt="Employee Avatar" class="w-6 h-6 rounded-full">
                    <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${employee.first_name} ${employee.last_name}</span>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400">${employee.position}</span>
            </div>
        `).join('');
    }

    renderScheduleTable() {
        const scheduleTableBody = document.querySelector('#scheduleTableBody');
        if (!scheduleTableBody) return;

        if (this.schedules.length === 0) {
            scheduleTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        <i class="bi bi-calendar-x text-3xl mb-2 block"></i>
                        <p>No schedules found for this week</p>
                    </td>
                </tr>
            `;
            return;
        }

        scheduleTableBody.innerHTML = this.schedules.map(schedule => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="../../images/anonomous-profile-logo.png" alt="Employee Avatar" class="w-8 h-8 rounded-full mr-3">
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${schedule.first_name} ${schedule.last_name}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${schedule.position || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${new Date(schedule.schedule_date).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${this.formatTime(schedule.shift_start)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${this.formatTime(schedule.shift_end)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${schedule.scheduled_hours}h
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        schedule.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                        schedule.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                        schedule.status === 'cancelled' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }">
                        ${schedule.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="staffManagement.editSchedule(${schedule.id})" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 mr-3">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button onclick="staffManagement.deleteSchedule(${schedule.id})" class="text-red-600 hover:text-red-900 dark:text-red-400">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async clockInOut(employeeId) {
        try {
            // Check if employee is currently clocked in
            const employee = this.employees.find(emp => emp.id === employeeId);
            if (!employee) return;

            const action = confirm(`Clock ${employee.first_name} ${employee.last_name} in/out?`);
            if (!action) return;

            // For simplicity, we'll always try to clock in first, then clock out if already clocked in
            try {
                const response = await window.api.request('POST', '/staff/clock-in', {
                    employee_id: employeeId
                });
                
                if (response.success) {
                    this.showSuccess(`${employee.first_name} ${employee.last_name} clocked in successfully`);
                }
            } catch (error) {
                if (error.message.includes('already clocked in')) {
                    // Try to clock out
                    const response = await window.api.request('POST', '/staff/clock-out', {
                        employee_id: employeeId
                    });
                    
                    if (response.success) {
                        this.showSuccess(`${employee.first_name} ${employee.last_name} clocked out successfully`);
                    }
                } else {
                    throw error;
                }
            }

        } catch (error) {
            console.error('Clock in/out error:', error);
            this.showError('Failed to clock in/out employee');
        }
    }

    async createEmployee() {
        const modal = document.querySelector('#employeeModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.clearEmployeeForm();
        }
    }

    async createSchedule() {
        const modal = document.querySelector('#scheduleModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.clearScheduleForm();
            this.populateEmployeeDropdown();
        }
    }

    populateEmployeeDropdown() {
        const employeeSelect = document.querySelector('#scheduleEmployeeSelect');
        if (!employeeSelect) return;

        const activeEmployees = this.employees.filter(emp => emp.status === 'active');
        employeeSelect.innerHTML = '<option value="">Select Employee</option>' +
            activeEmployees.map(emp => 
                `<option value="${emp.id}">${emp.first_name} ${emp.last_name} - ${emp.position}</option>`
            ).join('');
    }

    async saveEmployee() {
        const form = document.querySelector('#employeeForm');
        if (!form) return;

        const formData = new FormData(form);
        const employeeData = Object.fromEntries(formData.entries());

        try {
            const response = await window.api.request('POST', '/staff/employees', employeeData);
            if (response.success) {
                this.showSuccess('Employee created successfully');
                this.hideEmployeeModal();
                await this.loadEmployees();
            }
        } catch (error) {
            console.error('Create employee error:', error);
            this.showError('Failed to create employee');
        }
    }

    async saveSchedule() {
        const form = document.querySelector('#scheduleForm');
        if (!form) return;

        const formData = new FormData(form);
        const scheduleData = Object.fromEntries(formData.entries());

        try {
            const response = await window.api.request('POST', '/staff/schedules', scheduleData);
            if (response.success) {
                this.showSuccess('Schedule created successfully');
                this.hideScheduleModal();
                await this.loadSchedules();
            }
        } catch (error) {
            console.error('Create schedule error:', error);
            this.showError('Failed to create schedule');
        }
    }

    hideEmployeeModal() {
        const modal = document.querySelector('#employeeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    hideScheduleModal() {
        const modal = document.querySelector('#scheduleModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    clearEmployeeForm() {
        const form = document.querySelector('#employeeForm');
        if (form) {
            form.reset();
        }
    }

    clearScheduleForm() {
        const form = document.querySelector('#scheduleForm');
        if (form) {
            form.reset();
        }
    }

    formatTime(timeString) {
        if (!timeString) return 'N/A';
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    getCurrentWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        
        const start = new Date(today.setDate(diff));
        const end = new Date(today.setDate(diff + 6));
        
        return { start, end };
    }

    setupEventListeners() {
        // Add employee button
        const addEmployeeBtn = document.querySelector('#addEmployeeBtn');
        if (addEmployeeBtn) {
            addEmployeeBtn.addEventListener('click', () => this.createEmployee());
        }

        // Add schedule button  
        const addScheduleBtn = document.querySelector('#addScheduleBtn');
        if (addScheduleBtn) {
            addScheduleBtn.addEventListener('click', () => this.createSchedule());
        }

        // Save employee button
        const saveEmployeeBtn = document.querySelector('#saveEmployeeBtn');
        if (saveEmployeeBtn) {
            saveEmployeeBtn.addEventListener('click', () => this.saveEmployee());
        }

        // Save schedule button
        const saveScheduleBtn = document.querySelector('#saveScheduleBtn');
        if (saveScheduleBtn) {
            saveScheduleBtn.addEventListener('click', () => this.saveSchedule());
        }

        // Modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            }
        });
    }

    startAutoRefresh() {
        // Refresh every 60 seconds
        this.refreshInterval = setInterval(() => {
            this.loadEmployees();
            this.loadSchedules();
        }, 60000);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize staff management system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'shift-management') {
        window.staffManagement = new StaffManagementSystem();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.staffManagement) {
        window.staffManagement.destroy();
    }
});