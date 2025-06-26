/**
 * Recipe Management System
 * Handles recipe creation, editing, and ingredient management
 */

class RecipeManagementSystem {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.recipes = [];
        this.products = [];
        this.categories = [];
        this.currentRecipe = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.renderRecipes();
    }

    setupEventListeners() {
        // Add New Recipe button
        const addRecipeBtn = document.querySelector('.bg-blue-600');
        if (addRecipeBtn && addRecipeBtn.textContent.includes('Add New Recipe')) {
            addRecipeBtn.addEventListener('click', () => this.showCreateRecipeModal());
        }

        // Search functionality
        const searchInput = document.querySelector('input[placeholder*="Search recipes"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filter button
        const filterBtn = document.querySelector('.bg-gray-200:has(.bi-funnel-fill)');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterModal());
        }

        // Export button
        const exportBtn = document.querySelector('.bg-gray-200:has(.bi-box-arrow-up)');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportRecipes());
        }
    }

    async loadInitialData() {
        try {
            // Load recipes
            const recipesResponse = await window.api.request('GET', '/inventory/recipes');
            if (recipesResponse.success) {
                this.recipes = recipesResponse.data.recipes || [];
            }

            // Load products for ingredients
            const productsResponse = await window.api.request('GET', '/inventory/products?limit=100');
            if (productsResponse.success) {
                this.products = productsResponse.data.products || [];
            }

            // Load categories
            const categoriesResponse = await window.api.request('GET', '/inventory/categories');
            if (categoriesResponse.success) {
                this.categories = categoriesResponse.data.categories || [];
            }

        } catch (error) {
            console.error('Failed to load recipes data:', error);
            this.showNotification('Failed to load data', 'error');
        }
    }

    renderRecipes() {
        const tbody = document.querySelector('tbody');
        if (!tbody) return;

        if (this.recipes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        <i class="bi bi-book text-3xl mb-2 block"></i>
                        <p>No recipes found</p>
                        <button class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onclick="window.recipeSystem.showCreateRecipeModal()">
                            Create First Recipe
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.recipes.map(recipe => this.renderRecipeRow(recipe)).join('');
        this.attachRowEventListeners();
    }

    renderRecipeRow(recipe) {
        const statusColors = {
            'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            'inactive': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
            'draft': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
        };

        return `
            <tr data-recipe-id="${recipe.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 font-medium">
                    ${recipe.recipe_code || `RCP${recipe.id.toString().padStart(3, '0')}`}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                        <div class="text-sm font-medium text-gray-900 dark:text-gray-200">${recipe.name}</div>
                        ${recipe.description ? `<div class="text-sm text-gray-500 dark:text-gray-400">${recipe.description.substring(0, 50)}${recipe.description.length > 50 ? '...' : ''}</div>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${recipe.category || 'Uncategorized'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${recipe.ingredient_count || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ${recipe.prep_time ? `${recipe.prep_time} mins` : 'Not set'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[recipe.status] || statusColors.active}">
                        ${recipe.status ? recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1) : 'Active'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-4" 
                            data-action="view" data-recipe-id="${recipe.id}" title="View Recipe">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-500 mr-4" 
                            data-action="edit" data-recipe-id="${recipe.id}" title="Edit Recipe">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-500" 
                            data-action="delete" data-recipe-id="${recipe.id}" title="Delete Recipe">
                        <i class="bi bi-trash"></i>
                    </button>
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
                const recipeId = parseInt(button.dataset.recipeId);
                this.handleRecipeAction(action, recipeId);
            });
        });
    }

    async handleRecipeAction(action, recipeId) {
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        switch (action) {
            case 'view':
                this.showRecipeDetails(recipe);
                break;
            case 'edit':
                this.showEditRecipeModal(recipe);
                break;
            case 'delete':
                await this.deleteRecipe(recipeId);
                break;
        }
    }

    showCreateRecipeModal() {
        const modal = this.createRecipeModal();
        document.body.appendChild(modal);
        this.setupRecipeForm();
    }

    showEditRecipeModal(recipe) {
        this.currentRecipe = recipe;
        const modal = this.createRecipeModal(recipe);
        document.body.appendChild(modal);
        this.setupRecipeForm(recipe);
    }

    createRecipeModal(recipe = null) {
        const isEdit = recipe !== null;
        
        const modal = document.createElement('div');
        modal.id = 'recipeModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">
                        ${isEdit ? 'Edit Recipe' : 'Create New Recipe'}
                    </h2>
                    <button id="closeRecipeModal" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        <i class="bi bi-x-lg text-xl"></i>
                    </button>
                </div>
                
                <form id="recipeForm" class="p-6">
                    <!-- Basic Recipe Information -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label for="recipe_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Recipe Name *
                            </label>
                            <input type="text" id="recipe_name" required 
                                   value="${recipe ? recipe.name || '' : ''}"
                                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                   placeholder="Enter recipe name">
                        </div>
                        
                        <div>
                            <label for="recipe_category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Category
                            </label>
                            <select id="recipe_category" 
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                                <option value="">Select Category</option>
                                <option value="Main Course" ${recipe && recipe.category === 'Main Course' ? 'selected' : ''}>Main Course</option>
                                <option value="Appetizer" ${recipe && recipe.category === 'Appetizer' ? 'selected' : ''}>Appetizer</option>
                                <option value="Dessert" ${recipe && recipe.category === 'Dessert' ? 'selected' : ''}>Dessert</option>
                                <option value="Beverage" ${recipe && recipe.category === 'Beverage' ? 'selected' : ''}>Beverage</option>
                                <option value="Side Dish" ${recipe && recipe.category === 'Side Dish' ? 'selected' : ''}>Side Dish</option>
                                <option value="Sauce" ${recipe && recipe.category === 'Sauce' ? 'selected' : ''}>Sauce</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="prep_time" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Preparation Time (minutes)
                            </label>
                            <input type="number" id="prep_time" min="1" 
                                   value="${recipe ? recipe.prep_time || '' : ''}"
                                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                   placeholder="Enter prep time in minutes">
                        </div>
                        
                        <div>
                            <label for="cook_time" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Cooking Time (minutes)
                            </label>
                            <input type="number" id="cook_time" min="1" 
                                   value="${recipe ? recipe.cook_time || '' : ''}"
                                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                   placeholder="Enter cooking time in minutes">
                        </div>
                        
                        <div>
                            <label for="servings" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Servings
                            </label>
                            <input type="number" id="servings" min="1" 
                                   value="${recipe ? recipe.servings || '' : ''}"
                                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                   placeholder="Number of servings">
                        </div>
                        
                        <div>
                            <label for="recipe_status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Status
                            </label>
                            <select id="recipe_status" 
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                                <option value="active" ${recipe && recipe.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${recipe && recipe.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                <option value="draft" ${recipe && recipe.status === 'draft' ? 'selected' : ''}>Draft</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label for="recipe_description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea id="recipe_description" rows="3" 
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                  placeholder="Brief description of the recipe...">${recipe ? recipe.description || '' : ''}</textarea>
                    </div>
                    
                    <!-- Ingredients Section -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Ingredients</h3>
                            <button type="button" id="addIngredient" 
                                    class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                <i class="bi bi-plus mr-2"></i>Add Ingredient
                            </button>
                        </div>
                        
                        <div class="overflow-x-auto">
                            <table class="min-w-full border border-gray-300 dark:border-gray-600">
                                <thead class="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Quantity</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Unit</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cost</th>
                                        <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="ingredientsTable" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    <!-- Ingredients will be added dynamically -->
                                </tbody>
                                <tfoot class="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <td colspan="3" class="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                            Total Cost:
                                        </td>
                                        <td class="px-4 py-2 font-bold text-lg text-gray-800 dark:text-gray-200">
                                            £<span id="totalCost">0.00</span>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Instructions Section -->
                    <div class="mb-6">
                        <label for="instructions" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Cooking Instructions
                        </label>
                        <textarea id="instructions" rows="6" 
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                  placeholder="Step-by-step cooking instructions...">${recipe ? recipe.instructions || '' : ''}</textarea>
                    </div>
                    
                    <div class="flex justify-end space-x-4">
                        <button type="button" id="cancelRecipeForm" 
                                class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" 
                                class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            ${isEdit ? 'Update Recipe' : 'Create Recipe'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        return modal;
    }

    setupRecipeForm(recipe = null) {
        const modal = document.getElementById('recipeModal');
        
        // Close modal handlers
        const closeBtn = modal.querySelector('#closeRecipeModal');
        const cancelBtn = modal.querySelector('#cancelRecipeForm');
        
        [closeBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                this.currentRecipe = null;
            });
        });
        
        // Add ingredient button
        const addIngredientBtn = modal.querySelector('#addIngredient');
        addIngredientBtn.addEventListener('click', () => this.addIngredientRow());
        
        // Form submission
        const form = modal.querySelector('#recipeForm');
        form.addEventListener('submit', (e) => this.handleRecipeSubmit(e));
        
        // If editing, load existing ingredients
        if (recipe && recipe.ingredients) {
            recipe.ingredients.forEach(ingredient => this.addIngredientRow(ingredient));
        } else {
            // Add one empty row for new recipes
            this.addIngredientRow();
        }
        
        this.updateTotalCost();
    }

    addIngredientRow(ingredient = null) {
        const tbody = document.querySelector('#ingredientsTable');
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="px-4 py-2">
                <select class="ingredient-product w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200" required>
                    <option value="">Select Product</option>
                    ${this.products.map(product => `
                        <option value="${product.id}" data-cost="${product.cost_price}" ${ingredient && ingredient.product_id === product.id ? 'selected' : ''}>
                            ${product.name} (${product.sku})
                        </option>
                    `).join('')}
                </select>
            </td>
            <td class="px-4 py-2">
                <input type="number" class="ingredient-quantity w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200" 
                       min="0" step="0.01" value="${ingredient ? ingredient.quantity : 1}" required>
            </td>
            <td class="px-4 py-2">
                <select class="ingredient-unit w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200">
                    <option value="piece" ${ingredient && ingredient.unit === 'piece' ? 'selected' : ''}>Piece</option>
                    <option value="kg" ${ingredient && ingredient.unit === 'kg' ? 'selected' : ''}>Kg</option>
                    <option value="g" ${ingredient && ingredient.unit === 'g' ? 'selected' : ''}>Grams</option>
                    <option value="l" ${ingredient && ingredient.unit === 'l' ? 'selected' : ''}>Liters</option>
                    <option value="ml" ${ingredient && ingredient.unit === 'ml' ? 'selected' : ''}>ML</option>
                    <option value="cups" ${ingredient && ingredient.unit === 'cups' ? 'selected' : ''}>Cups</option>
                    <option value="tbsp" ${ingredient && ingredient.unit === 'tbsp' ? 'selected' : ''}>Tablespoons</option>
                    <option value="tsp" ${ingredient && ingredient.unit === 'tsp' ? 'selected' : ''}>Teaspoons</option>
                </select>
            </td>
            <td class="px-4 py-2">
                <span class="ingredient-cost font-medium">£0.00</span>
            </td>
            <td class="px-4 py-2 text-center">
                <button type="button" class="remove-ingredient text-red-600 hover:text-red-800">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Add event listeners
        const productSelect = row.querySelector('.ingredient-product');
        const quantityInput = row.querySelector('.ingredient-quantity');
        const removeBtn = row.querySelector('.remove-ingredient');
        
        productSelect.addEventListener('change', () => this.updateIngredientCost(row));
        quantityInput.addEventListener('input', () => this.updateIngredientCost(row));
        
        removeBtn.addEventListener('click', () => {
            row.remove();
            this.updateTotalCost();
        });
        
        // Initialize row cost
        this.updateIngredientCost(row);
    }

    updateIngredientCost(row) {
        const productSelect = row.querySelector('.ingredient-product');
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value) || 0;
        const selectedOption = productSelect.selectedOptions[0];
        
        let cost = 0;
        if (selectedOption && selectedOption.dataset.cost) {
            const unitCost = parseFloat(selectedOption.dataset.cost) || 0;
            cost = quantity * unitCost;
        }
        
        row.querySelector('.ingredient-cost').textContent = `£${cost.toFixed(2)}`;
        this.updateTotalCost();
    }

    updateTotalCost() {
        const rows = document.querySelectorAll('#ingredientsTable tr');
        let total = 0;
        
        rows.forEach(row => {
            const productSelect = row.querySelector('.ingredient-product');
            const quantity = parseFloat(row.querySelector('.ingredient-quantity')?.value) || 0;
            const selectedOption = productSelect?.selectedOptions[0];
            
            if (selectedOption && selectedOption.dataset.cost) {
                const unitCost = parseFloat(selectedOption.dataset.cost) || 0;
                total += quantity * unitCost;
            }
        });
        
        const totalElement = document.querySelector('#totalCost');
        if (totalElement) {
            totalElement.textContent = total.toFixed(2);
        }
    }

    async handleRecipeSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: document.querySelector('#recipe_name').value,
            category: document.querySelector('#recipe_category').value,
            description: document.querySelector('#recipe_description').value,
            prep_time: parseInt(document.querySelector('#prep_time').value) || null,
            cook_time: parseInt(document.querySelector('#cook_time').value) || null,
            servings: parseInt(document.querySelector('#servings').value) || null,
            instructions: document.querySelector('#instructions').value,
            status: document.querySelector('#recipe_status').value
        };
        
        // Collect ingredients
        const ingredients = [];
        const rows = document.querySelectorAll('#ingredientsTable tr');
        
        for (const row of rows) {
            const productId = row.querySelector('.ingredient-product')?.value;
            const quantity = row.querySelector('.ingredient-quantity')?.value;
            const unit = row.querySelector('.ingredient-unit')?.value;
            
            if (productId && quantity) {
                ingredients.push({
                    product_id: parseInt(productId),
                    quantity: parseFloat(quantity),
                    unit: unit
                });
            }
        }
        
        if (ingredients.length === 0) {
            this.showNotification('Please add at least one ingredient to the recipe', 'error');
            return;
        }
        
        formData.ingredients = ingredients;
        
        try {
            let response;
            if (this.currentRecipe) {
                // Update existing recipe
                response = await window.api.request('PUT', `/inventory/recipes/${this.currentRecipe.id}`, formData);
            } else {
                // Create new recipe
                response = await window.api.request('POST', '/inventory/recipes', formData);
            }
            
            if (response.success) {
                this.showNotification(
                    this.currentRecipe ? 'Recipe updated successfully' : 'Recipe created successfully', 
                    'success'
                );
                
                // Close modal and refresh data
                document.getElementById('recipeModal').remove();
                this.currentRecipe = null;
                await this.loadInitialData();
                this.renderRecipes();
            } else {
                throw new Error(response.message || 'Failed to save recipe');
            }
            
        } catch (error) {
            console.error('Recipe submission error:', error);
            this.showNotification('Failed to save recipe: ' + error.message, 'error');
        }
    }

    async deleteRecipe(recipeId) {
        if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await window.api.request('DELETE', `/inventory/recipes/${recipeId}`);
            
            if (response.success) {
                this.showNotification('Recipe deleted successfully', 'success');
                await this.loadInitialData();
                this.renderRecipes();
            } else {
                throw new Error(response.message || 'Failed to delete recipe');
            }
            
        } catch (error) {
            console.error('Delete recipe error:', error);
            this.showNotification('Failed to delete recipe: ' + error.message, 'error');
        }
    }

    showRecipeDetails(recipe) {
        // Create a detailed view modal for the recipe
        const modal = document.createElement('div');
        modal.id = 'recipeDetailsModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">${recipe.name}</h2>
                    <button id="closeDetailsModal" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        <i class="bi bi-x-lg text-xl"></i>
                    </button>
                </div>
                
                <div class="p-6">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${recipe.prep_time || 0}</div>
                            <div class="text-sm text-gray-500">Prep Time (min)</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${recipe.cook_time || 0}</div>
                            <div class="text-sm text-gray-500">Cook Time (min)</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-600">${recipe.servings || 1}</div>
                            <div class="text-sm text-gray-500">Servings</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-orange-600">${recipe.ingredient_count || 0}</div>
                            <div class="text-sm text-gray-500">Ingredients</div>
                        </div>
                    </div>
                    
                    ${recipe.description ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Description</h3>
                            <p class="text-gray-600 dark:text-gray-400">${recipe.description}</p>
                        </div>
                    ` : ''}
                    
                    ${recipe.instructions ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Instructions</h3>
                            <div class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${recipe.instructions}</div>
                        </div>
                    ` : ''}
                    
                    <div class="flex justify-end space-x-4">
                        <button onclick="window.recipeSystem.showEditRecipeModal(${JSON.stringify(recipe).replace(/"/g, '&quot;')})" 
                                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Edit Recipe
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal handler
        modal.querySelector('#closeDetailsModal').addEventListener('click', () => {
            modal.remove();
        });
    }

    handleSearch(query) {
        // Filter recipes based on search query
        if (!query.trim()) {
            this.renderRecipes();
            return;
        }
        
        const filteredRecipes = this.recipes.filter(recipe => 
            recipe.name.toLowerCase().includes(query.toLowerCase()) ||
            (recipe.description && recipe.description.toLowerCase().includes(query.toLowerCase())) ||
            (recipe.category && recipe.category.toLowerCase().includes(query.toLowerCase()))
        );
        
        // Temporarily replace recipes for rendering
        const originalRecipes = this.recipes;
        this.recipes = filteredRecipes;
        this.renderRecipes();
        this.recipes = originalRecipes;
    }

    showFilterModal() {
        this.showNotification('Filter functionality will be implemented soon', 'info');
    }

    async exportRecipes() {
        try {
            const response = await window.api.request('GET', '/inventory/recipes/export');
            if (response.success) {
                // Trigger download
                const link = document.createElement('a');
                link.href = response.data.download_url;
                link.download = response.data.filename;
                link.click();
                
                this.showNotification('Recipes exported successfully', 'success');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export recipes', 'error');
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

// Initialize Recipe Management System when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'recipes') {
        window.recipeSystem = new RecipeManagementSystem();
    }
});